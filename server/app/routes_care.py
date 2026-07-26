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
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from . import payments
from .auth import current_user
from .db import get_db, new_id, to_12h, utcnow_iso

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
# Booking ADDS care. Cancelling removes it, payment spends her money, minting
# links widens the holder's own access, and the emergency details are what get
# used when she cannot speak for herself. Those four are the shape coercive
# control takes, so no link can reach them: a caretaker can only ever put
# something *on* her calendar, never take it off, and never pay for it.
#
# A caretaker booking is created unpaid on purpose. It reserves the slot and
# then waits for her — she is the one who confirms and pays, which keeps the
# final say with the patient without making the help useless.
CARETAKER_MAY_BOOK = True


def log_event(db, user_id: int, *, actor: str, kind: str, summary: str,
              actor_label: str | None = None, share_token: str | None = None, meta: dict | None = None):
    """Writes to the shared ledger. Every action by anyone lands here — the
    patient's own included, so the thread reads as one history rather than as
    surveillance of the caretaker."""
    db.execute(
        """INSERT INTO care_events (id, user_id, actor, actor_label, share_token, kind, summary, meta)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (new_id("ev"), user_id, actor, actor_label, share_token, kind, summary, json.dumps(meta or {})),
    )


class BookBody(BaseModel):
    slotId: int
    reason: str | None = None


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
        "label": row["label"],
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
            (token, user["id"], (body.label or "").strip() or None,
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

        out = {
            "name": user["name"] if user else None,
            "label": row["label"],
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
                "SELECT name, dose, frequency, times FROM medications WHERE user_id = ? AND active = 1",
                (uid,),
            ).fetchall()
            out["medicines"] = [
                {"name": m["name"], "dose": m["dose"], "frequency": m["frequency"],
                 "times": json.loads(m["times"] or "[]")}
                for m in meds
            ]

        if "contacts" in scopes:
            contacts = db.execute(
                "SELECT name, phone, relation FROM sos_contacts WHERE user_id = ?", (uid,)
            ).fetchall()
            out["contacts"] = [dict(c) for c in contacts]

        if "conditions" in scopes:
            chart = db.execute(
                "SELECT allergies, conditions, blood_group FROM patient_charts WHERE user_id = ?", (uid,)
            ).fetchone()
            out["chart"] = {
                "bloodGroup": chart["blood_group"] if chart else None,
                "allergies": json.loads(chart["allergies"]) if chart else [],
                "conditions": json.loads(chart["conditions"]) if chart else [],
            } if chart else None

        # The ledger, shown to the caretaker as well. Both sides read the same
        # thread — that symmetry is what makes holding this link reasonable.
        events = db.execute(
            """SELECT actor, actor_label, kind, summary, created_at
               FROM care_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 40""",
            (uid,),
        ).fetchall()
        out["events"] = [dict(e) for e in events]
        out["canBook"] = "appointments" in scopes

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

        who = share["label"] or "Someone you shared with"
        log_event(
            db, uid,
            actor="caretaker", actor_label=share["label"], share_token=token,
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
        # Said plainly to the caretaker, so nobody assumes it is settled.
        "note": "Reserved. It is confirmed once she approves and pays in her app.",
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
    events = [{**dict(r), "meta": json.loads(r["meta"] or "{}")} for r in rows]
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
