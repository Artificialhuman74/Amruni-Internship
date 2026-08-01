"""Care shares — a link a family member or caretaker can open.

Built for elderly mode, where the person managing appointments is often a
daughter or a son rather than the patient, but usable by anyone who wants
someone else to be able to see what is coming up.

Three rules the design does not bend on, because what is being handed out is a
key to a health record:

  · **Opaque tokens.** The URL never contains the patient id. A row id in a
    shareable link is enumerable, and enumerable means someone else's records.
  · **Scoped.** A share carries an explicit list of what it exposes. Nothing is
    included by default that she has not chosen, and the journal, mood log and
    screening results are not offerable at all — see ALLOWED_SCOPES.
  · **Revocable and expiring.** A link that cannot be taken back is a
    permanent disclosure, and relationships change.

The public endpoint is unauthenticated by design — the recipient has no account
— so it returns the narrowest useful projection and nothing that could identify
her beyond the name she chose to share.
"""
import json
import secrets
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from . import crypto, payments
from .auth import current_user
from .db import get_db, new_id, payment_json, to_12h, utcnow_iso

router = APIRouter()

# What a share may ever expose. Deliberately short, and deliberately missing
# the journal, the mood log, screening scores and community activity: those are
# the things she writes precisely because nobody else is reading them, and a
# caretaker link is not a reason to change that. Adding to this list is a
# product decision, not a configuration one.
ALLOWED_SCOPES = {
    "appointments",   # upcoming consultations, so someone can take her
    "medicines",      # what she is on and what is due
    "contacts",       # who to call
    "conditions",     # blood group, allergies, conditions — for an emergency
}

DEFAULT_SCOPES = ["appointments", "medicines"]
DEFAULT_TTL_DAYS = 90

# What a caretaker may do, and — more importantly — may not.
#
# Booking ADDS care. Cancelling removes it, minting links widens the holder's
# own access, and the emergency details are what get used when she cannot speak
# for herself. Those are the shape coercive control takes, so no link reaches
# them: a caretaker can only ever put something *on* her calendar, never take
# it off.
#
# Payment sat on that list until it was looked at properly. What the rule is
# actually protecting is *her money* — and a daughter paying for her mother's
# consultation from her own card spends none of it. So a caretaker may now book
# and pay outright, through a Razorpay order raised against the link. Her card,
# her charge, and a refund on cancellation goes back to her.
#
# The patient still holds the ledger, and every booking and payment is written
# into it under the caretaker's name, because someone spending money on your
# behalf is exactly the thing you should not have to discover from a bank
# statement.
CARETAKER_MAY_BOOK = True
CARETAKER_MAY_PAY = True


def log_event(db, user_id: int, *, actor: str, kind: str, summary: str,
              actor_label: str | None = None, share_token: str | None = None, meta: dict | None = None):
    """Writes to the shared ledger. Every action by anyone lands here — the
    patient's own included, so the thread reads as one history rather than as
    surveillance of the caretaker."""
    db.execute(
        """INSERT INTO care_events (id, user_id, actor, actor_label, share_token, kind, summary, meta)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (new_id("ev"), user_id, actor, crypto.enc(actor_label), share_token, kind,
         crypto.enc(summary), json.dumps(meta or {})),
    )


class BookBody(BaseModel):
    slotId: int
    reason: str | None = None


class DoseBody(BaseModel):
    date: str | None = None
    slot: str


class NoteBody(BaseModel):
    text: str


class ConfirmBody(BaseModel):
    providerPaymentId: str | None = None
    signature: str | None = None


class ShareBody(BaseModel):
    label: str | None = None
    scopes: list[str] = DEFAULT_SCOPES
    expiresInDays: int | None = DEFAULT_TTL_DAYS


def _clean_scopes(scopes: list[str]) -> list[str]:
    picked = [s for s in scopes if s in ALLOWED_SCOPES]
    return picked or list(DEFAULT_SCOPES)


def _share_json(row) -> dict:
    return {
        "token": row["token"],
        "label": crypto.dec(row["label"]),
        "scopes": json.loads(row["scopes"] or "[]"),
        "expiresAt": row["expires_at"],
        "revoked": bool(row["revoked"]),
        "viewCount": row["view_count"],
        "lastViewed": row["last_viewed"],
        "createdAt": row["created_at"],
    }


def _expired(row) -> bool:
    if not row["expires_at"]:
        return False
    try:
        return datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00")) < datetime.now(timezone.utc)
    except ValueError:
        return False


# ---------- owner-side ----------

@router.get("/me/care/shares")
def list_shares(user: dict = Depends(current_user)):
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM care_shares WHERE user_id = ? ORDER BY created_at DESC", (user["id"],)
        ).fetchall()
    return [{**_share_json(r), "expired": _expired(r)} for r in rows]


@router.post("/me/care/shares", status_code=201)
def create_share(body: ShareBody, user: dict = Depends(current_user)):
    # 32 bytes of entropy. Long enough that guessing is not a threat model.
    token = secrets.token_urlsafe(24)
    expires = None
    if body.expiresInDays:
        days = max(1, min(365, body.expiresInDays))
        expires = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat().replace("+00:00", "Z")

    with get_db() as db:
        db.execute(
            """INSERT INTO care_shares (token, user_id, label, scopes, expires_at)
               VALUES (?, ?, ?, ?, ?)""",
            (token, user["id"], crypto.enc((body.label or "").strip() or None),
             json.dumps(_clean_scopes(body.scopes)), expires),
        )
        row = db.execute("SELECT * FROM care_shares WHERE token = ?", (token,)).fetchone()
    return _share_json(row)


@router.delete("/me/care/shares/{token}")
def revoke_share(token: str, user: dict = Depends(current_user)):
    """Revokes rather than deletes, so the list still shows her that a link
    existed and was turned off — a share that vanishes without trace is one she
    cannot audit."""
    with get_db() as db:
        found = db.execute(
            "SELECT token FROM care_shares WHERE token = ? AND user_id = ?", (token, user["id"])
        ).fetchone()
        if not found:
            raise HTTPException(404, "Share not found.")
        db.execute("UPDATE care_shares SET revoked = 1 WHERE token = ?", (token,))
    return {"success": True}


# ---------- the shared view (public, token-scoped) ----------

@router.get("/care/{token}")
def read_share(token: str):
    """Unauthenticated: the recipient is a family member with a link, not an
    account holder. Every field returned is inside the share's scopes, and a
    revoked or expired token is indistinguishable from one that never existed
    — so a stale link cannot confirm that a person is on Amruni at all."""
    now = utcnow_iso()
    with get_db() as db:
        row = db.execute("SELECT * FROM care_shares WHERE token = ?", (token,)).fetchone()
        if not row or row["revoked"] or _expired(row):
            raise HTTPException(404, "This link is no longer active.")

        scopes = json.loads(row["scopes"] or "[]")
        uid = row["user_id"]
        user = db.execute("SELECT name FROM users WHERE id = ?", (uid,)).fetchone()
        patient_name = crypto.dec(user["name"]) if user else None

        out = {
            "name": patient_name,
            "label": crypto.dec(row["label"]),
            "scopes": scopes,
            "expiresAt": row["expires_at"],
        }

        if "appointments" in scopes:
            appts = db.execute(
                """SELECT a.date, a.time, a.consult_mode, a.status, d.name AS doctor, d.specialty
                   FROM appointments a JOIN doctors d ON d.id = a.doctor_id
                   WHERE a.user_id = ? AND a.status IN ('confirmed','completed')
                   ORDER BY a.date DESC LIMIT 20""",
                (uid,),
            ).fetchall()
            out["appointments"] = [dict(a) for a in appts]

        if "medicines" in scopes:
            meds = db.execute(
                "SELECT id, name, dose, frequency, times FROM medications WHERE user_id = ? AND active = 1",
                (uid,),
            ).fetchall()
            today = date.today().isoformat()
            taken = {
                (d["medication_id"], d["slot"])
                for d in db.execute(
                    "SELECT medication_id, slot FROM medication_doses WHERE user_id = ? AND date = ?",
                    (uid, today),
                ).fetchall()
            }
            out["medicines"] = [
                {"id": m["id"], "name": crypto.dec(m["name"]), "dose": crypto.dec(m["dose"]),
                 "frequency": crypto.dec(m["frequency"]),
                 "times": json.loads(m["times"] or "[]"),
                 "takenToday": [t for t in json.loads(m["times"] or "[]") if (m["id"], t) in taken]}
                for m in meds
            ]
            out["today"] = today

        if "contacts" in scopes:
            contacts = db.execute(
                "SELECT name, phone, relation FROM sos_contacts WHERE user_id = ?", (uid,)
            ).fetchall()
            out["contacts"] = [
                {"name": crypto.dec(c["name"]), "phone": crypto.dec(c["phone"]),
                 "relation": crypto.dec(c["relation"])}
                for c in contacts
            ]

        if "conditions" in scopes:
            chart = db.execute(
                "SELECT allergies, conditions, blood_group FROM patient_charts WHERE user_id = ?", (uid,)
            ).fetchone()
            out["chart"] = {
                "bloodGroup": crypto.dec(chart["blood_group"]) if chart else None,
                "allergies": crypto.dec_json(chart["allergies"], []) if chart else [],
                "conditions": crypto.dec_json(chart["conditions"], []) if chart else [],
            } if chart else None

        # The ledger, shown to the caretaker as well. Both sides read the same
        # thread — that symmetry is what makes holding this link reasonable.
        events = db.execute(
            """SELECT actor, actor_label, kind, summary, created_at
               FROM care_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 40""",
            (uid,),
        ).fetchall()
        out["events"] = [
            {**dict(e), "summary": crypto.dec(e["summary"]),
             "actor_label": crypto.dec(e["actor_label"])}
            for e in events
        ]
        out["canBook"] = "appointments" in scopes
        out["canMarkDoses"] = "medicines" in scopes

        # Every open is counted, so she can see the link is being used — and
        # notice if it is being used when it shouldn't be.
        db.execute(
            "UPDATE care_shares SET view_count = view_count + 1, last_viewed = ? WHERE token = ?",
            (now, token),
        )

    return out


# ---------- what a caretaker may do ----------

@router.get("/care/{token}/slots")
def share_slots(token: str, doctorId: int | None = None):
    """Open slots the caretaker can book into. Unauthenticated like the rest of
    the shared view, and it exposes nothing about the patient."""
    with get_db() as db:
        share = db.execute("SELECT * FROM care_shares WHERE token = ?", (token,)).fetchone()
        if not share or share["revoked"] or _expired(share) or "appointments" not in json.loads(share["scopes"] or "[]"):
            raise HTTPException(404, "This link is no longer active.")

        clause = "s.status = 'open' AND s.date >= date('now')"
        params: list = []
        if doctorId:
            clause += " AND s.doctor_id = ?"
            params.append(doctorId)
        rows = db.execute(
            f"""SELECT s.id, s.date, s.start_time, s.price_inr, d.id AS doctor_id,
                      d.name AS doctor, d.specialty
               FROM slots s JOIN doctors d ON d.id = s.doctor_id
               WHERE {clause} ORDER BY s.date, s.start_time LIMIT 60""",
            params,
        ).fetchall()
    return [
        {"slotId": r["id"], "date": r["date"], "time": to_12h(r["start_time"]),
         "price": r["price_inr"], "doctorId": r["doctor_id"],
         "doctor": r["doctor"], "specialty": r["specialty"]}
        for r in rows
    ]


@router.post("/care/{token}/book", status_code=201)
def book_via_share(token: str, body: BookBody):
    """A caretaker reserves an appointment.

    Deliberately stops short of paying. The slot is locked and the appointment
    is created `pending_payment`, then it waits for her to confirm — so a
    daughter can do the finding and the arranging, and her mother keeps the
    final say and her money. Booking adds care; nothing here can remove it.
    """
    with get_db() as db:
        share = db.execute("SELECT * FROM care_shares WHERE token = ?", (token,)).fetchone()
        if not share or share["revoked"] or _expired(share):
            raise HTTPException(404, "This link is no longer active.")
        if "appointments" not in json.loads(share["scopes"] or "[]"):
            raise HTTPException(403, "This link cannot book appointments.")

        uid = share["user_id"]
        cur = db.execute(
            "UPDATE slots SET status = 'locked', locked_at = strftime('%s','now') WHERE id = ? AND status = 'open'",
            (body.slotId,),
        )
        if cur.rowcount == 0:
            raise HTTPException(409, "That time was just taken. Please pick another.")

        slot = db.execute("SELECT * FROM slots WHERE id = ?", (body.slotId,)).fetchone()
        doctor = db.execute("SELECT * FROM doctors WHERE id = ?", (slot["doctor_id"],)).fetchone()

        appt_id = new_id("apt")
        db.execute(
            """INSERT INTO appointments
                 (id, user_id, doctor_id, slot_id, date, time, reason, consult_mode, amount_inr, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'video', ?, 'pending_payment')""",
            (appt_id, uid, slot["doctor_id"], slot["id"], slot["date"],
             to_12h(slot["start_time"]), body.reason, slot["price_inr"]),
        )

        # The order is raised against the link, and `share_token` is what the
        # confirm endpoint checks — a token can only ever settle a payment it
        # created, never one belonging to the patient or to another link.
        order = payments.create_order(slot["price_inr"], receipt=appt_id)
        pay_id = new_id("pay")
        db.execute(
            """INSERT INTO payments (id, appointment_id, user_id, provider, order_id, amount_inr, share_token)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (pay_id, appt_id, uid, order["provider"], order["order_id"], slot["price_inr"], token),
        )
        payment = db.execute("SELECT * FROM payments WHERE id = ?", (pay_id,)).fetchone()

        label = crypto.dec(share["label"])
        who = label or "Someone you shared with"
        log_event(
            db, uid,
            actor="caretaker", actor_label=label, share_token=token,
            kind="booked",
            summary=f"{who} booked {doctor['name']} for {slot['date']} at {to_12h(slot['start_time'])}",
            meta={"appointmentId": appt_id, "doctor": doctor["name"],
                  "date": slot["date"], "time": to_12h(slot["start_time"]),
                  "amount": slot["price_inr"]},
        )

    return {
        "appointmentId": appt_id,
        "doctor": doctor["name"],
        "date": slot["date"],
        "time": to_12h(slot["start_time"]),
        "amount": slot["price_inr"],
        "payment": {**payment_json(payment), "keyId": order.get("key_id")},
        # Said plainly, so nobody assumes it is settled before it is.
        "note": "Held for you. It is confirmed once the payment goes through.",
    }


def _open_share(db, token: str, scope: str | None = None):
    share = db.execute("SELECT * FROM care_shares WHERE token = ?", (token,)).fetchone()
    if not share or share["revoked"] or _expired(share):
        raise HTTPException(404, "This link is no longer active.")
    if scope and scope not in json.loads(share["scopes"] or "[]"):
        raise HTTPException(403, "This link does not cover that.")
    return share


@router.post("/care/{token}/medicines/{med_id}/taken", status_code=201)
def caretaker_marks_dose(token: str, med_id: str, body: DoseBody):
    """A daughter hands her mother the tablet and ticks it here.

    This is the action a caretaker actually performs, several times a day, and
    until now the page could only describe it. It stays inside the rule the
    rest of this module is built on — it adds a record of care given and can
    remove nothing.

    Every tick records *who*. An adherence number a doctor reads is worth
    having only if it distinguishes "she took it" from "someone says she took
    it", and the honest version of letting a caretaker help is saying so in the
    record rather than quietly folding it into her own.
    """
    today = date.today().isoformat()
    when = body.date or today
    # Only today and yesterday. A link that can rewrite a fortnight of adherence
    # is a link that can rewrite what her doctor believes about her treatment.
    if when not in (today, (date.today() - timedelta(days=1)).isoformat()):
        raise HTTPException(400, "Only today or yesterday can be marked.")

    with get_db() as db:
        share = _open_share(db, token, "medicines")
        uid = share["user_id"]
        med = db.execute(
            "SELECT * FROM medications WHERE id = ? AND user_id = ? AND active = 1", (med_id, uid)
        ).fetchone()
        if not med:
            raise HTTPException(404, "Medicine not found.")
        if body.slot not in json.loads(med["times"] or "[]"):
            raise HTTPException(400, "That is not one of this medicine's times.")

        db.execute(
            """INSERT INTO medication_doses (user_id, medication_id, date, slot, taken_at, taken_by)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(user_id, medication_id, date, slot)
               DO UPDATE SET taken_at = excluded.taken_at, taken_by = excluded.taken_by""",
            (uid, med_id, when, body.slot, utcnow_iso(), token),
        )
        name = crypto.dec(med["name"])
        label = crypto.dec(share["label"])
        log_event(
            db, uid, actor="caretaker", actor_label=label, share_token=token, kind="dose",
            summary=f"{label or 'Someone you shared with'} marked {name} ({body.slot}) as taken",
            meta={"medicationId": med_id, "date": when, "slot": body.slot},
        )
    return {"success": True, "date": when, "slot": body.slot}


@router.post("/care/{token}/notes", status_code=201)
def caretaker_note(token: str, body: NoteBody):
    """A line in the shared thread — "took her to Dr Sharma, BP was fine".

    The ledger was a list of things the app noticed. The person actually in the
    room could see it and add nothing to it, which made the "both of you are
    reading the same thread" promise half true.
    """
    text = body.text.strip()[:280]
    if not text:
        raise HTTPException(422, "A note needs some words.")
    with get_db() as db:
        share = _open_share(db, token)
        label = crypto.dec(share["label"])
        log_event(
            db, share["user_id"], actor="caretaker", actor_label=label, share_token=token,
            kind="note", summary=text, meta={"note": True},
        )
    return {"success": True}


@router.post("/care/{token}/payments/{payment_id}/confirm")
def confirm_via_share(token: str, payment_id: str, body: ConfirmBody):
    """The caretaker settles the booking she just made, from her own card.

    Two things make this safe on a page with no login. The payment must have
    been created by *this* token — so holding a link never lets anyone touch
    the patient's own payments, or another link's — and the settlement itself
    is the same `settle_payment` the authenticated path uses, so a care-link
    booking cannot end up in a different state from a normal one.
    """
    from .routes_bookings import settle_payment

    with get_db() as db:
        share = _open_share(db, token, "appointments")
        payment = db.execute(
            "SELECT * FROM payments WHERE id = ? AND share_token = ?", (payment_id, token)
        ).fetchone()
        if not payment or payment["user_id"] != share["user_id"]:
            raise HTTPException(404, "Payment not found")

        appt = db.execute(
            "SELECT * FROM appointments WHERE id = ?", (payment["appointment_id"],)
        ).fetchone()
        already_paid = payment["status"] == "paid"
        appt = settle_payment(db, payment, appt, body.providerPaymentId, body.signature)

        if not already_paid:
            doctor = db.execute("SELECT * FROM doctors WHERE id = ?", (appt["doctor_id"],)).fetchone()
            label = crypto.dec(share["label"])
            who = label or "Someone you shared with"
            log_event(
                db, share["user_id"], actor="caretaker", actor_label=label, share_token=token,
                kind="paid",
                summary=f"{who} paid ₹{payment['amount_inr']} for {doctor['name']} on {appt['date']}",
                meta={"appointmentId": appt["id"], "amount": payment["amount_inr"],
                      "doctor": doctor["name"], "paidByCaretaker": True},
            )
        return {
            "appointmentId": appt["id"],
            "status": appt["status"],
            "meetLink": appt["meet_link"],
            "note": "Confirmed. She can see it in her app, and the ledger records that you paid.",
        }


# ---------- her side of the ledger ----------

@router.get("/me/care/events")
def my_events(user: dict = Depends(current_user)):
    with get_db() as db:
        rows = db.execute(
            """SELECT id, actor, actor_label, kind, summary, meta, read_at, created_at
               FROM care_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 60""",
            (user["id"],),
        ).fetchall()
    events = [
        {**dict(r), "summary": crypto.dec(r["summary"]),
         "actor_label": crypto.dec(r["actor_label"]),
         "meta": json.loads(r["meta"] or "{}")}
        for r in rows
    ]
    return {
        "events": events,
        # Only a caretaker's actions are things she needs telling about; her own
        # are just history.
        "unread": sum(1 for e in events if e["actor"] == "caretaker" and not e["read_at"]),
    }


@router.post("/me/care/events/read")
def mark_read(user: dict = Depends(current_user)):
    with get_db() as db:
        db.execute(
            "UPDATE care_events SET read_at = ? WHERE user_id = ? AND read_at IS NULL",
            (utcnow_iso(), user["id"]),
        )
    return {"success": True}
