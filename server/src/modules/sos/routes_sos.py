"""Emergency contacts and alert history.

Previously the one part of the product living in Firestore, with credentials
that were never configured in production — so the list the SOS button reads
could not be added to at all. It lives here now, alongside everything else, on
one database with one auth path and one failure mode.
"""
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth.auth import current_user
from ...database.db import get_db, new_id, utcnow_iso

router = APIRouter()


class ContactBody(BaseModel):
    name: str
    phone: str
    relation: str | None = None


class AlertBody(BaseModel):
    message: str
    sentTo: list[str] = []
    isTest: bool = False


def _contact_json(row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "phone": row["phone"],
        "relation": row["relation"],
        "createdAt": row["created_at"],
    }


@router.get("/me/sos/contacts")
def list_contacts(user: dict = Depends(current_user)):
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM sos_contacts WHERE user_id = ? ORDER BY created_at ASC", (user["id"],)
        ).fetchall()
    return [_contact_json(r) for r in rows]


@router.post("/me/sos/contacts", status_code=201)
def add_contact(body: ContactBody, user: dict = Depends(current_user)):
    name = body.name.strip()
    phone = body.phone.strip()
    if not name or not phone:
        raise HTTPException(422, "A contact needs a name and a phone number.")
    with get_db() as db:
        existing = db.execute(
            "SELECT id FROM sos_contacts WHERE user_id = ? AND phone = ?", (user["id"], phone)
        ).fetchone()
        if existing:
            db.execute(
                "UPDATE sos_contacts SET name = ?, relation = ? WHERE id = ?",
                (name, body.relation, existing["id"]),
            )
            row = db.execute("SELECT * FROM sos_contacts WHERE id = ?", (existing["id"],)).fetchone()
            return _contact_json(row)

        contact_id = new_id("contact")
        db.execute(
            "INSERT INTO sos_contacts (id, user_id, name, phone, relation) VALUES (?, ?, ?, ?, ?)",
            (contact_id, user["id"], name, phone, body.relation),
        )
        row = db.execute("SELECT * FROM sos_contacts WHERE id = ?", (contact_id,)).fetchone()
    return _contact_json(row)


@router.delete("/me/sos/contacts/{contact_id}")
def delete_contact(contact_id: str, user: dict = Depends(current_user)):
    with get_db() as db:
        db.execute(
            "DELETE FROM sos_contacts WHERE id = ? AND user_id = ?", (contact_id, user["id"])
        )
    return {"success": True}


@router.get("/me/sos/alerts")
def list_alerts(user: dict = Depends(current_user)):
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM sos_alerts WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50",
            (user["id"],),
        ).fetchall()
    return [
        {
            "id": r["id"],
            "message": r["message"],
            "sentTo": json.loads(r["sent_to"] or "[]"),
            "isTest": bool(r["is_test"]),
            "timestamp": r["timestamp"],
        }
        for r in rows
    ]


@router.post("/me/sos/alerts", status_code=201)
def save_alert(body: AlertBody, user: dict = Depends(current_user)):
    alert_id = new_id("alert")
    with get_db() as db:
        db.execute(
            """INSERT INTO sos_alerts (id, user_id, message, sent_to, is_test, timestamp)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (alert_id, user["id"], body.message, json.dumps(body.sentTo),
             int(body.isTest), utcnow_iso()),
        )
    return {"id": alert_id}
