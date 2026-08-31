"""Doctor console API.

Everything a practitioner needs: her consultation queue, availability and
pricing, and the E-medical-record system — per-consultation clinical records,
per-patient charts (allergies, conditions, vitals history), and documents.

Access rule: a doctor can only open charts of patients who have (or had) an
appointment with her. Enforced on every patient-scoped endpoint.
"""
import json
import re
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from . import auth
from .auth import current_doctor
from .routes_community import get_or_create_anon_handle
from .routes_insurance import intake_for_doctor, policy_for_doctor
from .routes_meds import medication_history, sync_from_prescription
from . import crypto
from .db import (
    appointment_json, doctor_json, document_json, get_db, record_json,
    slot_json, utcnow_iso,
)
from .routes_bookings import _is_past
from .routes_doctors import release_expired_locks

router = APIRouter()

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME_RE = re.compile(r"^\d{2}:\d{2}$")


# ---------- auth ----------

class VerifyBody(BaseModel):
    phone: str
    code: str


@router.post("/doctor/verify-otp")
def doctor_verify_otp(body: VerifyBody):
    if not auth.is_valid_phone(body.phone) or not (body.code.isdigit() and len(body.code) == 6):
        raise HTTPException(400, "Invalid phone or code format.")
    result = auth.verify_doctor_otp(body.phone, body.code)
    with get_db() as db:
        doctor = db.execute("SELECT * FROM doctors WHERE id = ?", (result["doctor_id"],)).fetchone()
    return {"token": result["token"], "doctor": doctor_json(doctor)}


# ---------- helpers ----------

def _age(dob: str | None) -> int | None:
    if not dob:
        return None
    try:
        born = date.fromisoformat(dob)
    except ValueError:
        return None
    today = date.today()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


def _patient_summary(user_row) -> dict:
    return {
        "id": user_row["id"],
        "name": crypto.dec(user_row["name"]) or "Unnamed patient",
        "phone": crypto.dec(user_row["phone"]),
        "age": _age(crypto.dec(user_row["dob"])),
        "dob": crypto.dec(user_row["dob"]),
        "lifeStage": user_row["life_stage"],
        # Why she signed up. Chosen at onboarding and, until now, never stored
        # anywhere the person it is most useful to could read it.
        "goal": crypto.dec(user_row["goal"]) if "goal" in user_row.keys() else None,
        "anonymous": False,
    }


def _anonymous_summary(db, user_row) -> dict:
    """What a counsellor sees when she booked without her name.

    The settings toggle has promised "identity hidden from counsellors" since
    the first release and hid nothing — it was stored, synced, and read by one
    line of text describing itself. This is that promise made true.

    Age and life stage stay, because a counsellor treating a 16-year-old and a
    counsellor treating a 60-year-old need to know which; neither identifies
    her. The handle is the same one the community allocates, so she is a
    consistent person across sessions rather than a fresh stranger each time —
    continuity of care without a name.

    `id` is deliberately absent. Every patient-scoped endpoint keys on it, so
    withholding it is what makes the chart genuinely unreachable rather than
    merely unlinked in the interface.
    """
    return {
        "id": None,
        "name": get_or_create_anon_handle(db, user_row["id"]),
        "phone": None,
        "age": _age(crypto.dec(user_row["dob"])),
        "lifeStage": user_row["life_stage"],
        "anonymous": True,
    }


def _require_relationship(db, doctor_id: int, user_id: int):
    """An anonymous consultation grants no access to anything but itself.

    Without this clause the promise would leak through the side door: a
    counsellor could not read her name in the queue but could open the chart
    that carries it, along with her whole history.
    """
    ok = db.execute(
        """SELECT 1 FROM appointments
           WHERE doctor_id = ? AND user_id = ? AND COALESCE(anonymous, 0) = 0 LIMIT 1""",
        (doctor_id, user_id),
    ).fetchone()
    if not ok:
        raise HTTPException(404, "Patient not found")


# ---------- me / dashboard ----------

@router.get("/doctor/me")
def doctor_me(doctor: dict = Depends(current_doctor)):
    today = date.today().isoformat()
    with get_db() as db:
        stats = {
            "todayTotal": db.execute(
                "SELECT COUNT(*) AS n FROM appointments WHERE doctor_id = ? AND date = ? AND status IN ('confirmed','completed')",
                (doctor["id"], today),
            ).fetchone()["n"],
            "todayDone": db.execute(
                "SELECT COUNT(*) AS n FROM appointments WHERE doctor_id = ? AND date = ? AND status = 'completed'",
                (doctor["id"], today),
            ).fetchone()["n"],
            "patients": db.execute(
                """SELECT COUNT(DISTINCT user_id) AS n FROM appointments
                   WHERE doctor_id = ? AND COALESCE(anonymous, 0) = 0""",
                (doctor["id"],),
            ).fetchone()["n"],
            "weekEarnings": db.execute(
                """SELECT COALESCE(SUM(p.amount_inr), 0) AS total FROM payments p
                   JOIN appointments a ON a.id = p.appointment_id
                   WHERE a.doctor_id = ? AND p.status = 'paid' AND p.paid_at >= ?""",
                (doctor["id"], (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%S")),
            ).fetchone()["total"],
        }
    return {"doctor": doctor_json(doctor), "stats": stats}


# ---------- appointments ----------

def _doctor_appointment(db, row) -> dict:
    patient = db.execute("SELECT * FROM users WHERE id = ?", (row["user_id"],)).fetchone()
    has_record = db.execute(
        "SELECT 1 FROM consultation_records WHERE appointment_id = ?", (row["id"],)
    ).fetchone() is not None
    anon = bool(row["anonymous"])
    return {
        **appointment_json(row),
        "patient": (_anonymous_summary(db, patient) if anon else _patient_summary(patient)) if patient else None,
        "anonymous": anon,
        "hasRecord": has_record,
    }


@router.get("/doctor/appointments")
def doctor_appointments(doctor: dict = Depends(current_doctor)):
    with get_db() as db:
        release_expired_locks(db)
        confirmed = db.execute(
            "SELECT * FROM appointments WHERE doctor_id = ? AND status = 'confirmed'", (doctor["id"],)
        ).fetchall()
        for row in confirmed:
            if _is_past(row):
                db.execute("UPDATE appointments SET status = 'completed' WHERE id = ?", (row["id"],))
        rows = db.execute(
            """SELECT * FROM appointments WHERE doctor_id = ? AND status IN ('confirmed','completed')
               ORDER BY date DESC, created_at DESC LIMIT 200""",
            (doctor["id"],),
        ).fetchall()
        return [_doctor_appointment(db, r) for r in rows]


# ---------- availability ----------

class SlotRange(BaseModel):
    date: str
    start: str = "10:00"
    end: str = "17:00"
    durationMinutes: int = 30
    price: int | None = None


@router.get("/doctor/slots")
def doctor_slots(doctor: dict = Depends(current_doctor)):
    with get_db() as db:
        release_expired_locks(db)
        rows = db.execute(
            "SELECT * FROM slots WHERE doctor_id = ? AND date >= ? ORDER BY date, start_time",
            (doctor["id"], date.today().isoformat()),
        ).fetchall()
        return [slot_json(r) for r in rows]


@router.post("/doctor/slots", status_code=201)
def publish_slots(body: SlotRange, doctor: dict = Depends(current_doctor)):
    if not DATE_RE.match(body.date):
        raise HTTPException(400, "date must be YYYY-MM-DD.")
    if not (TIME_RE.match(body.start) and TIME_RE.match(body.end)):
        raise HTTPException(400, "start/end must be HH:MM (24h).")
    if not 10 <= body.durationMinutes <= 120:
        raise HTTPException(400, "durationMinutes must be between 10 and 120.")
    if date.fromisoformat(body.date) < date.today():
        raise HTTPException(400, "Cannot publish slots in the past.")
    price = body.price if body.price is not None else doctor["fee_inr"]
    if price <= 0:
        raise HTTPException(400, "price must be positive.")

    with get_db() as db:
        created = []
        cursor = datetime.fromisoformat(f"{body.date}T{body.start}")
        end = datetime.fromisoformat(f"{body.date}T{body.end}")
        while cursor + timedelta(minutes=body.durationMinutes) <= end:
            slot_end = cursor + timedelta(minutes=body.durationMinutes)
            cur = db.execute(
                """INSERT OR IGNORE INTO slots (doctor_id, date, start_time, end_time, mode, price_inr)
                   VALUES (?, ?, ?, ?, 'video', ?)""",
                (doctor["id"], body.date, cursor.strftime("%H:%M"), slot_end.strftime("%H:%M"), price),
            )
            if cur.rowcount:
                created.append(cur.lastrowid)
            cursor = slot_end
        rows = [db.execute("SELECT * FROM slots WHERE id = ?", (sid,)).fetchone() for sid in created]
        return {"created": len(created), "slots": [slot_json(r) for r in rows]}


@router.delete("/doctor/slots/{slot_id}")
def remove_slot(slot_id: int, doctor: dict = Depends(current_doctor)):
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM slots WHERE id = ? AND doctor_id = ?", (slot_id, doctor["id"])
        ).fetchone()
        if not row:
            raise HTTPException(404, "Slot not found")
        if row["status"] == "booked":
            raise HTTPException(409, "Slot is booked; the patient must cancel first.")
        db.execute("DELETE FROM slots WHERE id = ?", (slot_id,))
    return {"success": True}


# ---------- consultation records ----------

class RecordBody(BaseModel):
    diagnosis: str | None = None
    notes: str | None = None
    vitals: dict = {}
    prescription: list = []
    followUp: str | None = None


@router.get("/doctor/appointments/{appointment_id}/record")
def get_record(appointment_id: str, doctor: dict = Depends(current_doctor)):
    with get_db() as db:
        appt = db.execute(
            "SELECT * FROM appointments WHERE id = ? AND doctor_id = ?", (appointment_id, doctor["id"])
        ).fetchone()
        if not appt:
            raise HTTPException(404, "Appointment not found")
        row = db.execute(
            "SELECT * FROM consultation_records WHERE appointment_id = ?", (appointment_id,)
        ).fetchone()
        patient = db.execute("SELECT * FROM users WHERE id = ?", (appt["user_id"],)).fetchone()
        anon = bool(appt["anonymous"])
        return {
            "appointment": appointment_json(appt),
            "patient": _anonymous_summary(db, patient) if anon else _patient_summary(patient),
            "anonymous": anon,
            "record": record_json(row) if row else None,
        }


@router.put("/doctor/appointments/{appointment_id}/record")
def save_record(appointment_id: str, body: RecordBody, doctor: dict = Depends(current_doctor)):
    if body.followUp and not DATE_RE.match(body.followUp):
        raise HTTPException(400, "followUp must be YYYY-MM-DD.")
    prescription = [
        {
            "name": str(line.get("name", "")).strip(),
            "dose": str(line.get("dose", "")).strip(),
            "frequency": str(line.get("frequency", "")).strip(),
            "duration": str(line.get("duration", "")).strip(),
        }
        for line in body.prescription
        if isinstance(line, dict) and str(line.get("name", "")).strip()
    ]
    with get_db() as db:
        appt = db.execute(
            "SELECT * FROM appointments WHERE id = ? AND doctor_id = ?", (appointment_id, doctor["id"])
        ).fetchone()
        if not appt:
            raise HTTPException(404, "Appointment not found")
        db.execute(
            """INSERT INTO consultation_records
                 (appointment_id, doctor_id, user_id, diagnosis, notes, vitals, prescription, follow_up, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(appointment_id) DO UPDATE SET
                 diagnosis = excluded.diagnosis, notes = excluded.notes,
                 vitals = excluded.vitals, prescription = excluded.prescription,
                 follow_up = excluded.follow_up, updated_at = excluded.updated_at""",
            (appointment_id, doctor["id"], appt["user_id"], crypto.enc(body.diagnosis),
             crypto.enc(body.notes), crypto.enc_json(body.vitals or {}),
             crypto.enc_json(prescription), body.followUp, utcnow_iso()),
        )
        # Writing the record is the natural end of a consultation.
        db.execute(
            "UPDATE appointments SET status = 'completed' WHERE id = ? AND status = 'confirmed'",
            (appointment_id,),
        )
        row = db.execute(
            "SELECT * FROM consultation_records WHERE appointment_id = ?", (appointment_id,)
        ).fetchone()

        # The prescription becomes medicines on her phone, with a schedule
        # derived from the frequency written above. Without this the doctor's
        # instructions end here — readable only inside this record, by someone
        # who thinks to come looking for it.
        sync_from_prescription(db, appt["user_id"], row["id"], prescription, doctor["name"])

        return record_json(row)


def _life_context(db, user_id: int) -> dict | None:
    """Pregnant, or trying to become pregnant — stated at the top of the chart.

    This is the modes reaching the one screen where they change what is safe to
    do. A prescription written for a woman who is pregnant or actively trying
    is the scenario the teratogen categories exist for, and until now the chart
    said nothing: a doctor had to think to ask, every time, for every patient.

    Only the fact is shared. Not her fertile window, not her cycle day, not
    anything from the conceive screen — a doctor needs to know the situation,
    not to read along.
    """
    settings = db.execute("SELECT * FROM user_settings WHERE user_id = ?", (user_id,)).fetchone()
    preg = db.execute("SELECT * FROM pregnancy_state WHERE user_id = ?", (user_id,)).fetchone()
    if not settings:
        return None

    pregnancy_mode = bool(settings["pregnancy_mode"]) if "pregnancy_mode" in settings.keys() else False
    conceive = bool(settings["conceive_mode"]) if "conceive_mode" in settings.keys() else False

    weeks = None
    due = preg["due_date_override"] if preg else None
    if preg and (preg["last_period_start"] or due):
        try:
            lmp = (date.fromisoformat(preg["last_period_start"]) if preg["last_period_start"]
                   else date.fromisoformat(due) - timedelta(days=280))
            due = due or (lmp + timedelta(days=280)).isoformat()
            weeks = max(0, (date.today() - lmp).days // 7)
        except (ValueError, TypeError):
            weeks = None

    overdue = bool(due and due < date.today().isoformat())
    if pregnancy_mode and weeks is not None and not overdue:
        return {"kind": "pregnant", "weeks": weeks,
                "trimester": 1 if weeks <= 13 else 2 if weeks <= 27 else 3,
                "dueDate": due,
                "label": f"Pregnant · {weeks} weeks",
                "caution": "Check every prescription against pregnancy safety."}
    if pregnancy_mode and overdue:
        return {"kind": "recently-pregnant", "dueDate": due,
                "label": "Recently pregnant — due date has passed",
                "caution": "Confirm the outcome before prescribing or assuming."}
    if conceive:
        return {"kind": "trying", "label": "Trying to conceive",
                "caution": "She may be pregnant before she knows it — check prescriptions accordingly."}
    return None


# ---------- patients & charts ----------

@router.get("/doctor/patients")
def doctor_patients(doctor: dict = Depends(current_doctor)):
    with get_db() as db:
        rows = db.execute(
            """SELECT u.*, MAX(a.created_at) AS last_visit, COUNT(a.id) AS visits
               FROM users u JOIN appointments a ON a.user_id = u.id
               WHERE a.doctor_id = ? AND COALESCE(a.anonymous, 0) = 0
               GROUP BY u.id ORDER BY last_visit DESC""",
            (doctor["id"],),
        ).fetchall()
        return [
            {**_patient_summary(r), "lastVisit": r["last_visit"], "visits": r["visits"]}
            for r in rows
        ]


class ChartBody(BaseModel):
    allergies: list[str] = []
    conditions: list[str] = []
    bloodGroup: str | None = None


@router.get("/doctor/patients/{user_id}/chart")
def patient_chart(user_id: int, doctor: dict = Depends(current_doctor)):
    with get_db() as db:
        _require_relationship(db, doctor["id"], user_id)
        user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        chart = db.execute("SELECT * FROM patient_charts WHERE user_id = ?", (user_id,)).fetchone()
        records = db.execute(
            """SELECT r.*, a.date AS appt_date, a.time AS appt_time, d.name AS doctor_name
               FROM consultation_records r
               JOIN appointments a ON a.id = r.appointment_id
               JOIN doctors d ON d.id = r.doctor_id
               WHERE r.user_id = ? AND COALESCE(a.anonymous, 0) = 0
               ORDER BY r.created_at DESC""",
            (user_id,),
        ).fetchall()
        documents = db.execute(
            "SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
        ).fetchall()

        vitals_history = []
        for r in reversed(records):  # chronological
            vitals = crypto.dec_json(r["vitals"], {})
            if any(str(v).strip() for v in vitals.values()):
                vitals_history.append({"date": r["appt_date"], **vitals})

        # Journal entries the patient explicitly flagged to bring to an
        # appointment — and only those. The journal is private by construction;
        # this endpoint is not a window into it. Two independent gates have to
        # be open for a single entry to appear: the doctor must have an
        # appointment with her (_require_relationship above), and she must have
        # marked that specific entry herself. Nothing here is inferred, and
        # unflagging an entry removes it immediately.
        shared = db.execute(
            """SELECT * FROM journal_entries
               WHERE user_id = ? AND bring_to_appointment = 1
               ORDER BY date DESC, created_at DESC""",
            (user_id,),
        ).fetchall()
        mood_by_id = {}
        mood_ids = [j["mood_log_id"] for j in shared if j["mood_log_id"]]
        if mood_ids:
            marks = ",".join("?" * len(mood_ids))
            for m in db.execute(f"SELECT * FROM mood_logs WHERE id IN ({marks})", mood_ids).fetchall():
                mood_by_id[m["id"]] = {
                    "valence": m["valence"],
                    "word": crypto.dec(m["word"]),
                    "factors": crypto.dec_json(m["factors"], []),
                    "scope": m["scope"],
                    "loggedAt": m["logged_at"],
                }

        # What she is actually on — not what this doctor once wrote down.
        #
        # The prescription inside a consultation record is a snapshot of one
        # visit; the medicine list is the live answer, and it includes the
        # tablets another doctor started her on and the supplements she takes
        # on her own. Reading the records alone gives a doctor a confident,
        # incomplete drug list, which is the shape most interaction errors
        # have. Adherence rides along for the same reason: whether a drug was
        # taken changes what "it isn't working" means.
        medications = medication_history(db, user_id)

        return {
            "patient": _patient_summary(user),
            "context": _life_context(db, user_id),
            "chart": {
                "allergies": crypto.dec_json(chart["allergies"], []) if chart else [],
                "conditions": crypto.dec_json(chart["conditions"], []) if chart else [],
                "bloodGroup": crypto.dec(chart["blood_group"]) if chart else None,
                # What she reported herself, at sign-up and since. The same
                # entries also appear in `conditions` — this says which of them
                # are her account rather than a clinician's, which one merged
                # list cannot. A doctor reading "PCOS" should know whether that
                # is a diagnosis or something she was told once and repeated.
                "selfDeclared": crypto.dec_json(chart["self_declared"], []) if chart else [],
            },
            "medications": medications,
            "vitalsHistory": vitals_history,
            "records": [
                {**record_json(r), "date": r["appt_date"], "time": r["appt_time"], "doctorName": r["doctor_name"]}
                for r in records
            ],
            "documents": [document_json(d) for d in documents],
            # The intake form she filled in before this consultation, and who
            # is paying for it. Both come through the same relationship gate as
            # the rest of the chart. Coverage arrives masked: a practitioner
            # writing a summary needs to know a claim is being made and against
            # which insurer, and does not need the policy number to do it.
            "intakeForms": intake_for_doctor(db, user_id),
            "coverage": policy_for_doctor(db, user_id),
            "sharedJournal": [
                {
                    "id": j["id"],
                    "date": j["date"],
                    "text": crypto.dec(j["text"]),
                    "mood": mood_by_id.get(j["mood_log_id"]),
                    "context": crypto.dec_json(j["context"], {}),
                }
                for j in shared
            ],
        }


@router.put("/doctor/patients/{user_id}/chart")
def update_chart(user_id: int, body: ChartBody, doctor: dict = Depends(current_doctor)):
    allergies = [a.strip() for a in body.allergies if a.strip()][:30]
    conditions = [c.strip() for c in body.conditions if c.strip()][:30]
    with get_db() as db:
        _require_relationship(db, doctor["id"], user_id)
        db.execute(
            """INSERT INTO patient_charts (user_id, allergies, conditions, blood_group, updated_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET
                 allergies = excluded.allergies, conditions = excluded.conditions,
                 blood_group = excluded.blood_group, updated_at = excluded.updated_at""",
            (user_id, crypto.enc_json(allergies), crypto.enc_json(conditions),
             crypto.enc(body.bloodGroup), utcnow_iso()),
        )
    return {"success": True}


# ---------- documents ----------

class DocumentBody(BaseModel):
    title: str
    kind: str = "report"
    data: str  # data URL


@router.post("/doctor/patients/{user_id}/documents", status_code=201)
def upload_document(user_id: int, body: DocumentBody, doctor: dict = Depends(current_doctor)):
    if body.kind not in ("lab", "report", "scan", "other"):
        raise HTTPException(400, "kind must be lab, report, scan or other.")
    if not body.data.startswith("data:"):
        raise HTTPException(400, "data must be a data URL.")
    if len(body.data) > 4_000_000:
        raise HTTPException(413, "File too large — keep documents under ~3 MB.")
    if not body.title.strip():
        raise HTTPException(400, "title is required.")
    with get_db() as db:
        _require_relationship(db, doctor["id"], user_id)
        cur = db.execute(
            "INSERT INTO documents (user_id, doctor_id, title, kind, data) VALUES (?, ?, ?, ?, ?)",
            (user_id, doctor["id"], crypto.enc(body.title.strip()), body.kind, crypto.enc(body.data)),
        )
        row = db.execute("SELECT * FROM documents WHERE id = ?", (cur.lastrowid,)).fetchone()
        return document_json(row)


@router.get("/doctor/patients/{user_id}/documents/{doc_id}")
def get_document(user_id: int, doc_id: int, doctor: dict = Depends(current_doctor)):
    with get_db() as db:
        _require_relationship(db, doctor["id"], user_id)
        row = db.execute(
            "SELECT * FROM documents WHERE id = ? AND user_id = ?", (doc_id, user_id)
        ).fetchone()
        if not row:
            raise HTTPException(404, "Document not found")
        return document_json(row, include_data=True)


@router.delete("/doctor/patients/{user_id}/documents/{doc_id}")
def delete_document(user_id: int, doc_id: int, doctor: dict = Depends(current_doctor)):
    with get_db() as db:
        _require_relationship(db, doctor["id"], user_id)
        cur = db.execute("DELETE FROM documents WHERE id = ? AND user_id = ?", (doc_id, user_id))
        if cur.rowcount == 0:
            raise HTTPException(404, "Document not found")
    return {"success": True}
