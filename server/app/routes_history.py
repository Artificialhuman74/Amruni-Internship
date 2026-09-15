"""Her health history, and who gets to read it.

Three pieces.

  1. The vault. Everything a doctor would want to know before meeting her,
     entered once: conditions, allergies and blood group (patient_charts),
     medicines (medications), surgeries and hospital stays, family history
     and free notes (health_history), and documents she uploads herself —
     prescriptions, lab reports, scans, discharge summaries. All encrypted
     at rest by the same layer as everything else.

  2. The share. At booking she chooses, for that appointment: share all of
     it, share some of it, or share none of it. The doctor is TOLD which —
     "limited" and "nothing shared" are stated on the chart, not left for a
     doctor to discover by noticing an empty allergy list and assuming there
     are no allergies. An empty section a doctor believes is complete is the
     dangerous failure here; a section marked "not shared" is not.

  3. The request. A doctor who needs more asks for specific categories with a
     reason. She allows some, all or none. The request grants nothing by
     itself.

The rule a doctor's chart follows is `effective_share`: the share on her most
recent non-anonymous appointment with that doctor, widened by any requests
she granted. What a doctor wrote or uploaded themselves is always visible to
that doctor — hiding a clinician's own notes from them protects nobody.
"""
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from . import crypto
from .auth import current_doctor, current_user
from .db import document_json, get_db, new_id, utcnow_iso

router = APIRouter()

# Stable ids. The client labels them; the server only ever compares ids.
CATEGORIES = (
    "conditions",      # conditions she lives with, and blood group
    "allergies",
    "medications",     # current and past
    "procedures",      # surgeries and hospital stays
    "family",          # illnesses in her family
    "consultations",   # records written by OTHER doctors
    "documents",       # prescriptions, lab reports, scans, discharge summaries
    "notes",           # anything else she wants a doctor to know
)
MODES = ("all", "selected", "none")
ITEM_CATEGORIES = ("procedures", "family", "notes")
DOC_KINDS = ("prescription", "lab", "scan", "discharge", "report", "other")
MAX_ITEM_CHARS = 4000
MAX_DOC_CHARS = 4_000_000


# ── share model ──────────────────────────────────────────────────────────

class ShareBody(BaseModel):
    mode: str = "all"
    categories: list[str] = Field(default_factory=list)
    documentIds: list[int] = Field(default_factory=list)


def clean_share(db, user_id: int, body: ShareBody | dict | None) -> tuple[str, list[str], list[int]]:
    """Validates a share choice against her own data.

    A document id that is not hers is dropped, not trusted: a client could
    otherwise list another woman's document ids and have a doctor shown them.
    """
    if body is None:
        return "all", list(CATEGORIES), []
    if isinstance(body, dict):
        body = ShareBody(**body)
    if body.mode not in MODES:
        raise HTTPException(422, "Sharing must be all, selected or none.")
    if body.mode != "selected":
        return body.mode, (list(CATEGORIES) if body.mode == "all" else []), []
    cats = [c for c in dict.fromkeys(body.categories) if c in CATEGORIES]
    docs: list[int] = []
    if body.documentIds:
        marks = ",".join("?" * len(body.documentIds))
        rows = db.execute(
            f"SELECT id FROM documents WHERE user_id = ? AND id IN ({marks})",
            (user_id, *body.documentIds),
        ).fetchall()
        docs = sorted(r["id"] for r in rows)
    return "selected", cats, docs


def save_share(db, appointment_id: str, user_id: int, doctor_id: int, mode: str, cats: list[str], docs: list[int]):
    db.execute(
        """INSERT INTO history_shares (appointment_id, user_id, doctor_id, mode, categories, document_ids)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(appointment_id) DO UPDATE SET
             mode = excluded.mode, categories = excluded.categories,
             document_ids = excluded.document_ids,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')""",
        (appointment_id, user_id, doctor_id, mode, json.dumps(cats), json.dumps(docs)),
    )


def effective_share(db, doctor_id: int, user_id: int) -> dict:
    """What this doctor may read of her history, right now."""
    appt = db.execute(
        """SELECT id FROM appointments
           WHERE doctor_id = ? AND user_id = ? AND COALESCE(anonymous, 0) = 0
             AND status != 'cancelled'
           ORDER BY created_at DESC LIMIT 1""",
        (doctor_id, user_id),
    ).fetchone()
    share = db.execute(
        "SELECT * FROM history_shares WHERE appointment_id = ?", (appt["id"],)
    ).fetchone() if appt else None

    if not share:
        # Booked before sharing choices existed. Those bookings always showed
        # the whole chart; changing that retroactively would empty the charts
        # doctors are relying on today. Labelled, so nobody mistakes it for a
        # choice she made.
        return {"mode": "all", "categories": list(CATEGORIES), "documentIds": [],
                "legacy": True, "appointmentId": appt["id"] if appt else None}

    cats = json.loads(share["categories"] or "[]")
    docs = json.loads(share["document_ids"] or "[]")
    return {
        "mode": share["mode"],
        "categories": list(CATEGORIES) if share["mode"] == "all" else cats,
        "documentIds": docs,
        "legacy": False,
        "appointmentId": share["appointment_id"],
        "updatedAt": share["updated_at"],
    }


def can_see(share: dict, category: str) -> bool:
    return share["mode"] == "all" or category in share["categories"]


def can_see_document(share: dict, doc_row, doctor_id: int) -> bool:
    if doc_row["doctor_id"] == doctor_id and doc_row["uploaded_by"] != "patient":
        return True
    if can_see(share, "documents"):
        return True
    return doc_row["id"] in share["documentIds"]


def history_items(db, user_id: int) -> dict:
    rows = db.execute(
        "SELECT * FROM health_history WHERE user_id = ? ORDER BY created_at", (user_id,)
    ).fetchall()
    out = {c: [] for c in ITEM_CATEGORIES}
    for r in rows:
        if r["category"] in out:
            out[r["category"]].append({
                "id": r["id"], "category": r["category"],
                **crypto.dec_json(r["data"], {}),
                "updatedAt": r["updated_at"],
            })
    return out


def requests_json(db, where: str, params: tuple) -> list[dict]:
    rows = db.execute(
        f"""SELECT q.*, d.name AS doctor_name, d.specialty AS doctor_specialty
            FROM history_requests q JOIN doctors d ON d.id = q.doctor_id
            WHERE {where} ORDER BY q.created_at DESC""",
        params,
    ).fetchall()
    return [
        {
            "id": r["id"], "appointmentId": r["appointment_id"],
            "doctorId": r["doctor_id"], "doctorName": r["doctor_name"], "doctorSpecialty": r["doctor_specialty"],
            "categories": json.loads(r["categories"] or "[]"),
            "granted": json.loads(r["granted"] or "[]"),
            "message": crypto.dec(r["message"]),
            "status": r["status"], "createdAt": r["created_at"], "respondedAt": r["responded_at"],
        }
        for r in rows
    ]


# ── her vault ────────────────────────────────────────────────────────────

class ItemBody(BaseModel):
    category: str
    data: dict


def _clean_item(body: ItemBody) -> dict:
    if body.category not in ITEM_CATEGORIES:
        raise HTTPException(422, "Unknown history section.")
    data = {k: (v.strip() if isinstance(v, str) else v) for k, v in body.data.items()}
    required = {"procedures": "name", "family": "condition", "notes": "text"}[body.category]
    if not data.get(required):
        raise HTTPException(422, "This entry is missing its main detail.")
    if body.category == "family" and not data.get("relation"):
        raise HTTPException(422, "Say who in the family this was.")
    if len(json.dumps(data)) > MAX_ITEM_CHARS:
        raise HTTPException(413, "That entry is too long.")
    return data


@router.get("/me/history")
def get_history(user: dict = Depends(current_user)):
    from .routes_meds import medication_history
    with get_db() as db:
        chart = db.execute("SELECT * FROM patient_charts WHERE user_id = ?", (user["id"],)).fetchone()
        docs = db.execute(
            "SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC", (user["id"],)
        ).fetchall()
        doctor_names = {r["id"]: r["name"] for r in db.execute("SELECT id, name FROM doctors").fetchall()}
        return {
            "conditions": crypto.dec_json(chart["conditions"], []) if chart else [],
            "allergies": crypto.dec_json(chart["allergies"], []) if chart else [],
            "bloodGroup": crypto.dec(chart["blood_group"]) if chart else None,
            "medications": medication_history(db, user["id"]),
            **history_items(db, user["id"]),
            "documents": [
                {**document_json(d), "doctorName": doctor_names.get(d["doctor_id"]) if d["uploaded_by"] != "patient" else None}
                for d in docs
            ],
            "requests": requests_json(db, "q.user_id = ? AND q.status = 'pending'", (user["id"],)),
        }


@router.post("/me/history/items", status_code=201)
def add_item(body: ItemBody, user: dict = Depends(current_user)):
    data = _clean_item(body)
    item_id = new_id("hist")
    with get_db() as db:
        db.execute(
            "INSERT INTO health_history (id, user_id, category, data) VALUES (?, ?, ?, ?)",
            (item_id, user["id"], body.category, crypto.enc_json(data)),
        )
    return {"id": item_id, "category": body.category, **data}


@router.put("/me/history/items/{item_id}")
def update_item(item_id: str, body: ItemBody, user: dict = Depends(current_user)):
    data = _clean_item(body)
    with get_db() as db:
        cur = db.execute(
            """UPDATE health_history SET data = ?, category = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
               WHERE id = ? AND user_id = ?""",
            (crypto.enc_json(data), body.category, item_id, user["id"]),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "Entry not found")
    return {"id": item_id, "category": body.category, **data}


@router.delete("/me/history/items/{item_id}")
def delete_item(item_id: str, user: dict = Depends(current_user)):
    with get_db() as db:
        cur = db.execute("DELETE FROM health_history WHERE id = ? AND user_id = ?", (item_id, user["id"]))
        if cur.rowcount == 0:
            raise HTTPException(404, "Entry not found")
    return {"success": True}


class MyDocumentBody(BaseModel):
    title: str
    kind: str = "prescription"
    data: str


@router.post("/me/documents", status_code=201)
def upload_my_document(body: MyDocumentBody, user: dict = Depends(current_user)):
    if body.kind not in DOC_KINDS:
        raise HTTPException(422, "Unknown document type.")
    if not body.data.startswith(("data:image/", "data:application/pdf")):
        raise HTTPException(422, "Upload a photo or a PDF.")
    if len(body.data) > MAX_DOC_CHARS:
        raise HTTPException(413, "That file is too large — keep documents under about 3 MB.")
    if not body.title.strip():
        raise HTTPException(422, "Give the document a name.")
    with get_db() as db:
        cur = db.execute(
            "INSERT INTO documents (user_id, doctor_id, title, kind, data, uploaded_by) VALUES (?, NULL, ?, ?, ?, 'patient')",
            (user["id"], crypto.enc(body.title.strip()[:120]), body.kind, crypto.enc(body.data)),
        )
        row = db.execute("SELECT * FROM documents WHERE id = ?", (cur.lastrowid,)).fetchone()
        return document_json(row)


@router.get("/me/documents/{doc_id}")
def get_my_document(doc_id: int, user: dict = Depends(current_user)):
    with get_db() as db:
        row = db.execute("SELECT * FROM documents WHERE id = ? AND user_id = ?", (doc_id, user["id"])).fetchone()
        if not row:
            raise HTTPException(404, "Document not found")
        return document_json(row, include_data=True)


@router.delete("/me/documents/{doc_id}")
def delete_my_document(doc_id: int, user: dict = Depends(current_user)):
    with get_db() as db:
        # Only what she uploaded. A report her doctor added is part of the
        # clinical record; she can decline to share it, not delete it.
        cur = db.execute(
            "DELETE FROM documents WHERE id = ? AND user_id = ? AND uploaded_by = 'patient'",
            (doc_id, user["id"]),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "Document not found, or added by your doctor")
    return {"success": True}


# ── sharing, from her side ───────────────────────────────────────────────

@router.get("/me/appointments/{appointment_id}/history-share")
def get_share(appointment_id: str, user: dict = Depends(current_user)):
    with get_db() as db:
        appt = db.execute(
            "SELECT * FROM appointments WHERE id = ? AND user_id = ?", (appointment_id, user["id"])
        ).fetchone()
        if not appt:
            raise HTTPException(404, "Appointment not found")
        return effective_share(db, appt["doctor_id"], user["id"])


@router.put("/me/appointments/{appointment_id}/history-share")
def put_share(appointment_id: str, body: ShareBody, user: dict = Depends(current_user)):
    with get_db() as db:
        appt = db.execute(
            "SELECT * FROM appointments WHERE id = ? AND user_id = ?", (appointment_id, user["id"])
        ).fetchone()
        if not appt:
            raise HTTPException(404, "Appointment not found")
        mode, cats, docs = clean_share(db, user["id"], body)
        save_share(db, appointment_id, user["id"], appt["doctor_id"], mode, cats, docs)
        return effective_share(db, appt["doctor_id"], user["id"])


@router.get("/me/history-requests")
def my_requests(user: dict = Depends(current_user)):
    with get_db() as db:
        return requests_json(db, "q.user_id = ?", (user["id"],))


class RespondBody(BaseModel):
    allow: bool
    categories: list[str] = Field(default_factory=list)


@router.post("/me/history-requests/{request_id}/respond")
def respond(request_id: str, body: RespondBody, user: dict = Depends(current_user)):
    with get_db() as db:
        req = db.execute(
            "SELECT * FROM history_requests WHERE id = ? AND user_id = ?", (request_id, user["id"])
        ).fetchone()
        if not req:
            raise HTTPException(404, "Request not found")
        if req["status"] != "pending":
            raise HTTPException(409, "You have already answered this request.")

        asked = json.loads(req["categories"] or "[]")
        # She can allow fewer than were asked for, never more than were asked.
        granted = [c for c in (body.categories or asked) if c in asked] if body.allow else []
        status = "granted" if granted else "declined"
        db.execute(
            "UPDATE history_requests SET status = ?, granted = ?, responded_at = ? WHERE id = ?",
            (status, json.dumps(granted), utcnow_iso(), request_id),
        )
        if granted:
            share = db.execute(
                "SELECT * FROM history_shares WHERE appointment_id = ?", (req["appointment_id"],)
            ).fetchone()
            if not share or share["mode"] != "all":
                cats = json.loads(share["categories"] or "[]") if share else []
                docs = json.loads(share["document_ids"] or "[]") if share else []
                merged = list(dict.fromkeys([*cats, *granted]))
                mode = "all" if set(merged) >= set(CATEGORIES) else "selected"
                save_share(db, req["appointment_id"], user["id"], req["doctor_id"], mode, merged, docs)
        return requests_json(db, "q.id = ?", (request_id,))[0]


# ── the doctor's side ────────────────────────────────────────────────────

class RequestBody(BaseModel):
    categories: list[str]
    message: str | None = None


@router.post("/doctor/patients/{user_id}/history-requests", status_code=201)
def request_more(user_id: int, body: RequestBody, doctor: dict = Depends(current_doctor)):
    cats = [c for c in dict.fromkeys(body.categories) if c in CATEGORIES]
    if not cats:
        raise HTTPException(422, "Choose what you would like to see.")
    message = (body.message or "").strip()[:500] or None
    with get_db() as db:
        share = effective_share(db, doctor["id"], user_id)
        if not share["appointmentId"]:
            raise HTTPException(404, "Patient not found")
        missing = [c for c in cats if not can_see(share, c)]
        if not missing:
            raise HTTPException(409, "She has already shared all of that with you.")
        pending = db.execute(
            "SELECT 1 FROM history_requests WHERE doctor_id = ? AND user_id = ? AND status = 'pending'",
            (doctor["id"], user_id),
        ).fetchone()
        if pending:
            # One open question at a time. A doctor who can send ten requests
            # can make declining feel like refusing care.
            raise HTTPException(409, "You already have a request waiting for her answer.")
        req_id = new_id("hreq")
        db.execute(
            """INSERT INTO history_requests (id, appointment_id, user_id, doctor_id, categories, message)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (req_id, share["appointmentId"], user_id, doctor["id"], json.dumps(missing), crypto.enc(message)),
        )
        return requests_json(db, "q.id = ?", (req_id,))[0]
