"""Doctor directory and availability-slot management.

Doctors (via the admin portal) publish priced, timed slots; consumers see only
open, future slots. Slot state machine: open → locked (booking initiated,
payment pending) → booked (paid). Locks expire after LOCK_TTL so an abandoned
checkout never blocks a slot.
"""
import json
import re
import time
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .auth import require_admin
from .db import get_db, doctor_json, slot_json

router = APIRouter()

LOCK_TTL = 10 * 60  # seconds a slot stays locked for an unpaid booking

TIME_RE = re.compile(r"^\d{2}:\d{2}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def release_expired_locks(db):
    """Free slots whose pending booking was abandoned, and expire the matching
    unpaid appointments."""
    cutoff = time.time() - LOCK_TTL
    stale = db.execute(
        "SELECT id FROM slots WHERE status = 'locked' AND locked_at < ?", (cutoff,)
    ).fetchall()
    if not stale:
        return
    ids = [r["id"] for r in stale]
    marks = ",".join("?" * len(ids))
    db.execute(f"UPDATE slots SET status = 'open', locked_at = NULL WHERE id IN ({marks})", ids)
    db.execute(
        f"UPDATE appointments SET status = 'cancelled' WHERE slot_id IN ({marks}) AND status = 'pending_payment'",
        ids,
    )


class SlotRange(BaseModel):
    date: str
    start: str = "10:00"          # HH:MM 24h
    end: str = "17:00"
    durationMinutes: int = 30
    price: int | None = None      # rupees; defaults to the doctor's video fee
    mode: str = "video"


class DoctorBody(BaseModel):
    name: str
    specialty: str
    exp: str | None = None
    fee: str | int | None = None       # accepts '₹600', '600', or 600
    chatFee: int | None = None
    meetLink: str | None = None        # legacy field from the admin form; ignored
    phone: str | None = None
    lang: list[str] = []
    avatar: str | None = None
    photo: str | None = None
    bio: str | None = None
    rating: float | None = None
    reviews: int | None = None
    nextSlot: str | None = None        # legacy field; slots are real now


def _fee_to_int(fee) -> int:
    if isinstance(fee, int):
        return fee
    digits = re.sub(r"\D", "", str(fee or ""))
    return int(digits) if digits else 500


def _next_slot_label(db, doctor_id: int) -> str | None:
    """Human label for the doctor's earliest open slot, e.g. 'Today, 4:00 PM'."""
    now = datetime.now()
    row = db.execute(
        """SELECT date, start_time FROM slots
           WHERE doctor_id = ? AND status = 'open'
             AND (date > ? OR (date = ? AND start_time > ?))
           ORDER BY date, start_time LIMIT 1""",
        (doctor_id, now.strftime("%Y-%m-%d"), now.strftime("%Y-%m-%d"), now.strftime("%H:%M")),
    ).fetchone()
    if not row:
        return None
    slot_day = date.fromisoformat(row["date"])
    from .db import to_12h
    if slot_day == date.today():
        day_label = "Today"
    elif slot_day == date.today() + timedelta(days=1):
        day_label = "Tomorrow"
    else:
        day_label = slot_day.strftime("%a, %d %b")
    return f"{day_label}, {to_12h(row['start_time'])}"


@router.get("/doctors")
def list_doctors():
    with get_db() as db:
        release_expired_locks(db)
        rows = db.execute("SELECT * FROM doctors ORDER BY id").fetchall()
        return [{**doctor_json(r), "nextSlot": _next_slot_label(db, r["id"])} for r in rows]


@router.get("/doctors/{doctor_id}")
def get_doctor(doctor_id: int):
    with get_db() as db:
        row = db.execute("SELECT * FROM doctors WHERE id = ?", (doctor_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Doctor not found")
        return {**doctor_json(row), "nextSlot": _next_slot_label(db, doctor_id)}


@router.post("/doctors", status_code=201)
def add_doctor(body: DoctorBody, user: dict = Depends(require_admin)):
    fee = _fee_to_int(body.fee)
    with get_db() as db:
        cur = db.execute(
            """INSERT INTO doctors (name, specialty, exp, fee_inr, chat_fee_inr, phone, lang, avatar, photo, bio, rating, reviews)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (body.name, body.specialty, body.exp, fee,
             body.chatFee if body.chatFee is not None else round(fee / 3),
             body.phone, json.dumps(body.lang), body.avatar or "🩺", body.photo, body.bio,
             body.rating if body.rating is not None else 5.0,
             body.reviews if body.reviews is not None else 0),
        )
        row = db.execute("SELECT * FROM doctors WHERE id = ?", (cur.lastrowid,)).fetchone()
        return {**doctor_json(row), "nextSlot": None}


@router.delete("/doctors/{doctor_id}")
def delete_doctor(doctor_id: int, user: dict = Depends(require_admin)):
    with get_db() as db:
        cur = db.execute("DELETE FROM doctors WHERE id = ?", (doctor_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Doctor not found")
    return {"success": True}


# ---------- slots ----------

@router.get("/doctors/{doctor_id}/slots")
def list_slots(doctor_id: int, all: bool = False):
    """Published availability is public information: open, future slots for
    booking. all=true additionally returns locked and booked slots (the admin
    calendar view — still just times, nothing personal)."""
    now = datetime.now()
    with get_db() as db:
        release_expired_locks(db)
        if not db.execute("SELECT 1 FROM doctors WHERE id = ?", (doctor_id,)).fetchone():
            raise HTTPException(404, "Doctor not found")
        if all:
            rows = db.execute(
                "SELECT * FROM slots WHERE doctor_id = ? AND date >= ? ORDER BY date, start_time",
                (doctor_id, now.strftime("%Y-%m-%d")),
            ).fetchall()
        else:
            rows = db.execute(
                """SELECT * FROM slots WHERE doctor_id = ? AND status = 'open'
                   AND (date > ? OR (date = ? AND start_time > ?))
                   ORDER BY date, start_time""",
                (doctor_id, now.strftime("%Y-%m-%d"), now.strftime("%Y-%m-%d"), now.strftime("%H:%M")),
            ).fetchall()
        return [slot_json(r) for r in rows]


@router.post("/doctors/{doctor_id}/slots", status_code=201)
def create_slots(doctor_id: int, body: SlotRange, user: dict = Depends(require_admin)):
    """Publish availability: expands a time range into bookable slots."""
    if not DATE_RE.match(body.date):
        raise HTTPException(400, "date must be YYYY-MM-DD.")
    if not (TIME_RE.match(body.start) and TIME_RE.match(body.end)):
        raise HTTPException(400, "start/end must be HH:MM (24h).")
    if body.mode not in ("video", "chat"):
        raise HTTPException(400, "mode must be video or chat.")
    if not 10 <= body.durationMinutes <= 120:
        raise HTTPException(400, "durationMinutes must be between 10 and 120.")
    if date.fromisoformat(body.date) < date.today():
        raise HTTPException(400, "Cannot publish slots in the past.")

    with get_db() as db:
        doctor = db.execute("SELECT * FROM doctors WHERE id = ?", (doctor_id,)).fetchone()
        if not doctor:
            raise HTTPException(404, "Doctor not found")
        price = body.price if body.price is not None else doctor["fee_inr"]
        if price <= 0:
            raise HTTPException(400, "price must be positive.")

        created = []
        cursor = datetime.fromisoformat(f"{body.date}T{body.start}")
        end = datetime.fromisoformat(f"{body.date}T{body.end}")
        while cursor + timedelta(minutes=body.durationMinutes) <= end:
            slot_end = cursor + timedelta(minutes=body.durationMinutes)
            cur = db.execute(
                """INSERT OR IGNORE INTO slots (doctor_id, date, start_time, end_time, mode, price_inr)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (doctor_id, body.date, cursor.strftime("%H:%M"), slot_end.strftime("%H:%M"), body.mode, price),
            )
            if cur.rowcount:
                created.append(cur.lastrowid)
            cursor = slot_end

        rows = [db.execute("SELECT * FROM slots WHERE id = ?", (sid,)).fetchone() for sid in created]
        return {"created": len(created), "slots": [slot_json(r) for r in rows]}


@router.delete("/slots/{slot_id}")
def delete_slot(slot_id: int, user: dict = Depends(require_admin)):
    with get_db() as db:
        row = db.execute("SELECT * FROM slots WHERE id = ?", (slot_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Slot not found")
        if row["status"] == "booked":
            raise HTTPException(409, "Slot is booked; cancel the appointment instead.")
        db.execute("DELETE FROM slots WHERE id = ?", (slot_id,))
    return {"success": True}
