"""Booking + payment + appointment lifecycle.

The automatic flow:
  1. POST /bookings           consumer picks a published slot → slot locks
                              atomically, appointment created pending_payment,
                              payment order returned
  2. POST /payments/{id}/confirm
                              payment verified → slot booked, appointment
                              confirmed, Google Meet link generated and stored
  3. DELETE /appointments/{id}
                              cancel → slot reopens, payment marked refunded,
                              calendar event removed

Chat consultations skip slots (instant, priced at the doctor's chat fee) and
use WhatsApp instead of a Meet link.
"""
import re
import time
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ...services import meet, payments
from ..auth.auth import current_user
from ...database.db import get_db, appointment_json, doctor_json, new_id, payment_json, record_json, to_12h, utcnow_iso
from ..doctor.routes_doctors import release_expired_locks

router = APIRouter()


class BookingBody(BaseModel):
    slotId: int | None = None      # required for video
    doctorId: int | None = None    # required for chat
    mode: str = "video"
    reason: str | None = None


class ConfirmBody(BaseModel):
    providerPaymentId: str | None = None
    signature: str | None = None


def _appointment_with_doctor(db, row) -> dict:
    doctor = db.execute("SELECT * FROM doctors WHERE id = ?", (row["doctor_id"],)).fetchone()
    record = db.execute(
        "SELECT * FROM consultation_records WHERE appointment_id = ?", (row["id"],)
    ).fetchone()
    return {
        **appointment_json(row),
        "doctor": doctor_json(doctor) if doctor else None,
        "record": record_json(record) if record else None,
    }


def _own_appointment(db, appointment_id: str, user_id: int):
    row = db.execute(
        "SELECT * FROM appointments WHERE id = ? AND user_id = ?", (appointment_id, user_id)
    ).fetchone()
    if not row:
        raise HTTPException(404, "Appointment not found")
    return row


# ---------- booking ----------

@router.post("/bookings", status_code=201)
def create_booking(body: BookingBody, user: dict = Depends(current_user)):
    if body.mode not in ("video", "chat"):
        raise HTTPException(400, "mode must be video or chat.")

    with get_db() as db:
        release_expired_locks(db)

        if body.mode == "video":
            if not body.slotId:
                raise HTTPException(400, "slotId is required for video consultations.")
            # Atomic lock: only one concurrent booking can win the slot.
            cur = db.execute(
                "UPDATE slots SET status = 'locked', locked_at = ? WHERE id = ? AND status = 'open'",
                (time.time(), body.slotId),
            )
            if cur.rowcount == 0:
                raise HTTPException(409, "That slot was just taken. Please pick another.")
            slot = db.execute("SELECT * FROM slots WHERE id = ?", (body.slotId,)).fetchone()
            doctor_id, amount = slot["doctor_id"], slot["price_inr"]
            appt_date, appt_time, slot_id = slot["date"], to_12h(slot["start_time"]), slot["id"]
        else:
            if not body.doctorId:
                raise HTTPException(400, "doctorId is required for chat consultations.")
            doctor = db.execute("SELECT * FROM doctors WHERE id = ?", (body.doctorId,)).fetchone()
            if not doctor:
                raise HTTPException(404, "Doctor not found")
            doctor_id, amount = doctor["id"], doctor["chat_fee_inr"]
            appt_date, appt_time, slot_id = date.today().isoformat(), "Instant", None

        appt_id = new_id("apt")
        db.execute(
            """INSERT INTO appointments (id, user_id, doctor_id, slot_id, date, time, reason, consult_mode, amount_inr, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment')""",
            (appt_id, user["id"], doctor_id, slot_id, appt_date, appt_time, body.reason, body.mode, amount),
        )

        order = payments.create_order(amount, receipt=appt_id)
        pay_id = new_id("pay")
        db.execute(
            """INSERT INTO payments (id, appointment_id, user_id, provider, order_id, amount_inr)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (pay_id, appt_id, user["id"], order["provider"], order["order_id"], amount),
        )
        payment = db.execute("SELECT * FROM payments WHERE id = ?", (pay_id,)).fetchone()

        return {
            "appointmentId": appt_id,
            "payment": {**payment_json(payment), "keyId": order.get("key_id")},
        }


@router.post("/payments/{payment_id}/confirm")
def confirm_payment(payment_id: str, body: ConfirmBody, user: dict = Depends(current_user)):
    with get_db() as db:
        payment = db.execute(
            "SELECT * FROM payments WHERE id = ? AND user_id = ?", (payment_id, user["id"])
        ).fetchone()
        if not payment:
            raise HTTPException(404, "Payment not found")
        appt = db.execute("SELECT * FROM appointments WHERE id = ?", (payment["appointment_id"],)).fetchone()

        if payment["status"] == "paid":            # idempotent re-confirm
            return _appointment_with_doctor(db, appt)
        if payment["status"] != "created":
            raise HTTPException(400, "This payment can no longer be confirmed.")
        if appt["status"] != "pending_payment":
            raise HTTPException(409, "This booking has expired. Please book again.")

        payments.verify(payment, body.providerPaymentId, body.signature)

        db.execute(
            "UPDATE payments SET status = 'paid', paid_at = ? WHERE id = ?",
            (utcnow_iso(), payment_id),
        )
        if appt["slot_id"]:
            db.execute("UPDATE slots SET status = 'booked', locked_at = NULL WHERE id = ?", (appt["slot_id"],))

        # Payment captured → generate the meeting automatically.
        meet_link = meet_event = meet_provider = None
        if appt["consult_mode"] == "video":
            doctor = db.execute("SELECT * FROM doctors WHERE id = ?", (appt["doctor_id"],)).fetchone()
            slot = db.execute("SELECT * FROM slots WHERE id = ?", (appt["slot_id"],)).fetchone() if appt["slot_id"] else None
            duration = 30
            start_time = "10:00"
            if slot:
                start_time = slot["start_time"]
                sh, sm = map(int, slot["start_time"].split(":"))
                eh, em = map(int, slot["end_time"].split(":"))
                duration = (eh * 60 + em) - (sh * 60 + sm)
            meeting = meet.create_meeting(
                summary=f"Amruni consultation — {doctor['name']}",
                description=f"Video consultation booked via Amruni.\nAppointment: {appt['id']}\n"
                            f"Reason: {appt['reason'] or 'Not specified'}",
                date=appt["date"],
                start_time=start_time,
                duration_minutes=duration,
            )
            meet_link, meet_event, meet_provider = meeting["link"], meeting["event_id"], meeting["provider"]

        db.execute(
            "UPDATE appointments SET status = 'confirmed', meet_link = ?, meet_event_id = ?, meet_provider = ? WHERE id = ?",
            (meet_link, meet_event, meet_provider, appt["id"]),
        )
        appt = db.execute("SELECT * FROM appointments WHERE id = ?", (appt["id"],)).fetchone()
        return _appointment_with_doctor(db, appt)


# ---------- appointments ----------

TIME_DISPLAY_RE = re.compile(r"(\d{1,2}):(\d{2})\s*(AM|PM)", re.I)


def _is_past(row) -> bool:
    """Archiving rules: instant chats complete after 1h, scheduled consults 2h
    past their slot."""
    if row["status"] == "completed":
        return True
    if not row["date"] or not row["time"]:
        return True
    if row["time"] == "Instant":
        created = datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
        return (datetime.now(created.tzinfo) - created).total_seconds() > 3600
    m = TIME_DISPLAY_RE.match(row["time"])
    if not m:
        return True
    hours, minutes, meridiem = int(m.group(1)), int(m.group(2)), m.group(3).upper()
    if meridiem == "PM" and hours != 12:
        hours += 12
    if meridiem == "AM" and hours == 12:
        hours = 0
    when = datetime.fromisoformat(f"{row['date']}T{hours:02d}:{minutes:02d}")
    return (datetime.now() - when).total_seconds() > 2 * 3600


@router.get("/appointments")
def list_appointments(user: dict = Depends(current_user)):
    with get_db() as db:
        release_expired_locks(db)
        rows = db.execute(
            "SELECT * FROM appointments WHERE user_id = ? AND status = 'confirmed'", (user["id"],)
        ).fetchall()
        for row in rows:
            if _is_past(row):
                db.execute("UPDATE appointments SET status = 'completed' WHERE id = ?", (row["id"],))
        rows = db.execute(
            "SELECT * FROM appointments WHERE user_id = ? AND status != 'cancelled' ORDER BY created_at DESC",
            (user["id"],),
        ).fetchall()
        return [_appointment_with_doctor(db, r) for r in rows]


@router.get("/appointments/{appointment_id}")
def get_appointment(appointment_id: str, user: dict = Depends(current_user)):
    with get_db() as db:
        row = _own_appointment(db, appointment_id, user["id"])
        return _appointment_with_doctor(db, row)


@router.delete("/appointments/{appointment_id}")
def cancel_appointment(appointment_id: str, user: dict = Depends(current_user)):
    with get_db() as db:
        row = _own_appointment(db, appointment_id, user["id"])
        if row["slot_id"]:
            db.execute("UPDATE slots SET status = 'open', locked_at = NULL WHERE id = ?", (row["slot_id"],))
        db.execute(
            "UPDATE payments SET status = 'refunded' WHERE appointment_id = ? AND status = 'paid'",
            (appointment_id,),
        )
        db.execute("UPDATE appointments SET status = 'cancelled' WHERE id = ?", (appointment_id,))
        event_id = row["meet_event_id"]
    if event_id:
        meet.cancel_meeting(event_id)
    return {"success": True}


@router.post("/appointments/{appointment_id}/complete")
def complete_appointment(appointment_id: str, user: dict = Depends(current_user)):
    with get_db() as db:
        _own_appointment(db, appointment_id, user["id"])
        db.execute("UPDATE appointments SET status = 'completed' WHERE id = ?", (appointment_id,))
    return {"success": True}


# ---------- video room compatibility ----------

class RoomBody(BaseModel):
    appointmentId: str


@router.post("/video/rooms", status_code=201)
def create_room(body: RoomBody, user: dict = Depends(current_user)):
    with get_db() as db:
        appt = _own_appointment(db, body.appointmentId, user["id"])
    return {
        "meetingId": appt["id"],
        "meetingUrl": appt["meet_link"] or "",
        "status": "active",
        "createdAt": utcnow_iso(),
    }
