"""Medicines — the list, the schedule, and whether doses were actually taken.

The prescription a doctor writes used to live and die inside one consultation
record. This module is what carries it forward: when a record is saved, every
prescribed medicine becomes a row here with a schedule derived from the
frequency the doctor typed, so it shows up on her phone the same day rather
than waiting to be remembered.

Adherence is recorded as one row per (medicine, date, slot) — present means
taken. Absent means not taken *yet*, never "missed": the difference matters,
because a schedule that starts marking her a failure at 8:01am is one she stops
opening.
"""
import json
import re
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth.auth import current_user
from ...database.db import get_db, new_id, utcnow_iso

router = APIRouter()

DEFAULT_TIMES = {
    1: ["09:00"],
    2: ["09:00", "21:00"],
    3: ["09:00", "14:00", "21:00"],
    4: ["08:00", "12:00", "17:00", "21:00"],
}

_TRIPLE = re.compile(r"^\s*([0-2])\s*[-–]\s*([0-2])\s*[-–]\s*([0-2])\s*$")
_TIMES_A_DAY = re.compile(r"(\d+)\s*(?:x|times?)\s*(?:a\s*|per\s*)?day")


def times_from_frequency(frequency: str | None) -> list[str]:
    """Turns a doctor's free-text frequency into clock times."""
    if not frequency:
        return DEFAULT_TIMES[1]
    f = frequency.strip().lower()

    m = _TRIPLE.match(f)
    if m:
        slots = ["09:00", "14:00", "21:00"]
        return [t for t, n in zip(slots, m.groups()) if int(n) > 0] or DEFAULT_TIMES[1]

    m = _TIMES_A_DAY.search(f)
    if m:
        n = max(1, min(4, int(m.group(1))))
        return DEFAULT_TIMES[n]

    if any(w in f for w in ("once", "od", "daily", "every day")) and "twice" not in f:
        return DEFAULT_TIMES[1]
    if any(w in f for w in ("twice", "bd", "bid")):
        return DEFAULT_TIMES[2]
    if any(w in f for w in ("thrice", "three times", "tds", "tid")):
        return DEFAULT_TIMES[3]
    if any(w in f for w in ("four times", "qid", "qds")):
        return DEFAULT_TIMES[4]
    return DEFAULT_TIMES[1]


_DURATION = re.compile(r"(\d+)\s*(day|week|month)")


def end_date_from_duration(duration: str | None, start: date) -> str | None:
    """A course with an end date stops reminding her when it's over."""
    if not duration:
        return None
    m = _DURATION.search(duration.strip().lower())
    if not m:
        return None
    n, unit = int(m.group(1)), m.group(2)
    days = n * {"day": 1, "week": 7, "month": 30}[unit]
    return (start + timedelta(days=days)).isoformat()


def sync_from_prescription(db, user_id: int, record_id: int, prescription: list[dict], doctor_name: str | None):
    """Mirrors a saved prescription into her medicine list."""
    today = date.today()
    seen = []
    for item in prescription or []:
        name = (item.get("name") or "").strip()
        if not name:
            continue
        seen.append(name)
        times = json.dumps(times_from_frequency(item.get("frequency")))
        ends = end_date_from_duration(item.get("duration"), today)
        existing = db.execute(
            "SELECT id, times FROM medications WHERE user_id = ? AND record_id = ? AND name = ?",
            (user_id, record_id, name),
        ).fetchone()
        if existing:
            db.execute(
                """UPDATE medications SET dose = ?, frequency = ?, ends_on = ?,
                       doctor_name = ?, active = 1 WHERE id = ?""",
                (item.get("dose"), item.get("frequency"), ends, doctor_name, existing["id"]),
            )
        else:
            db.execute(
                """INSERT INTO medications
                     (id, user_id, name, dose, frequency, times, started_on, ends_on,
                      source, record_id, doctor_name, active)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'prescription', ?, ?, 1)""",
                (new_id("med"), user_id, name, item.get("dose"), item.get("frequency"),
                 times, today.isoformat(), ends, record_id, doctor_name),
            )

    if seen:
        marks = ",".join("?" * len(seen))
        db.execute(
            f"""UPDATE medications SET active = 0
                WHERE user_id = ? AND record_id = ? AND name NOT IN ({marks})""",
            (user_id, record_id, *seen),
        )
    else:
        db.execute(
            "UPDATE medications SET active = 0 WHERE user_id = ? AND record_id = ?",
            (user_id, record_id),
        )


# ---------- shapes ----------

class MedBody(BaseModel):
    name: str
    dose: str | None = None
    frequency: str | None = None
    times: list[str] = []
    startedOn: str | None = None
    endsOn: str | None = None


class DoseBody(BaseModel):
    date: str
    slot: str


def _med_json(row, taken_slots: set[tuple[str, str]] | None = None, today: str | None = None) -> dict:
    times = json.loads(row["times"] or "[]")
    out = {
        "id": row["id"],
        "name": row["name"],
        "dose": row["dose"],
        "frequency": row["frequency"],
        "times": times,
        "startedOn": row["started_on"],
        "endsOn": row["ends_on"],
        "source": row["source"],
        "doctorName": row["doctor_name"],
        "active": bool(row["active"]),
    }
    if taken_slots is not None and today:
        out["todayTaken"] = [t for t in times if (row["id"], t) in taken_slots]
    return out


def _is_current(row, today: date) -> bool:
    if not row["active"]:
        return False
    if row["ends_on"]:
        try:
            if date.fromisoformat(row["ends_on"]) < today:
                return False
        except ValueError:
            pass
    return True


# ---------- routes ----------

@router.get("/me/medications")
def list_medications(user: dict = Depends(current_user)):
    today = date.today()
    iso = today.isoformat()
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM medications WHERE user_id = ? ORDER BY active DESC, created_at DESC",
            (user["id"],),
        ).fetchall()
        doses = db.execute(
            "SELECT medication_id, slot FROM medication_doses WHERE user_id = ? AND date = ?",
            (user["id"], iso),
        ).fetchall()

    taken = {(d["medication_id"], d["slot"]) for d in doses}
    current = [r for r in rows if _is_current(r, today)]
    past = [r for r in rows if not _is_current(r, today)]

    schedule = []
    for r in current:
        for t in json.loads(r["times"] or "[]"):
            schedule.append({
                "medicationId": r["id"],
                "name": r["name"],
                "dose": r["dose"],
                "time": t,
                "taken": (r["id"], t) in taken,
            })
    schedule.sort(key=lambda d: d["time"])

    return {
        "date": iso,
        "medications": [_med_json(r, taken, iso) for r in current],
        "past": [_med_json(r) for r in past],
        "today": schedule,
        "dueCount": sum(1 for d in schedule if not d["taken"]),
    }


@router.post("/me/medications", status_code=201)
def add_medication(body: MedBody, user: dict = Depends(current_user)):
    if not body.name.strip():
        raise HTTPException(422, "A medicine needs a name.")
    med_id = new_id("med")
    times = body.times or times_from_frequency(body.frequency)
    with get_db() as db:
        db.execute(
            """INSERT INTO medications
                 (id, user_id, name, dose, frequency, times, started_on, ends_on, source, active)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'self', 1)""",
            (med_id, user["id"], body.name.strip(), body.dose, body.frequency,
             json.dumps(times), body.startedOn or date.today().isoformat(), body.endsOn),
        )
        row = db.execute("SELECT * FROM medications WHERE id = ?", (med_id,)).fetchone()
    return _med_json(row)


@router.patch("/me/medications/{med_id}")
def update_medication(med_id: str, body: MedBody, user: dict = Depends(current_user)):
    with get_db() as db:
        existing = db.execute(
            "SELECT * FROM medications WHERE id = ? AND user_id = ?", (med_id, user["id"])
        ).fetchone()
        if not existing:
            raise HTTPException(404, "Medicine not found.")
        db.execute(
            """UPDATE medications SET name = ?, dose = ?, frequency = ?, times = ?,
                   started_on = ?, ends_on = ? WHERE id = ?""",
            (body.name.strip() or existing["name"], body.dose, body.frequency,
             json.dumps(body.times or json.loads(existing["times"] or "[]")),
             body.startedOn or existing["started_on"], body.endsOn, med_id),
        )
        row = db.execute("SELECT * FROM medications WHERE id = ?", (med_id,)).fetchone()
    return _med_json(row)


@router.post("/me/medications/{med_id}/stop")
def stop_medication(med_id: str, user: dict = Depends(current_user)):
    with get_db() as db:
        found = db.execute(
            "SELECT id FROM medications WHERE id = ? AND user_id = ?", (med_id, user["id"])
        ).fetchone()
        if not found:
            raise HTTPException(404, "Medicine not found.")
        db.execute("UPDATE medications SET active = 0 WHERE id = ?", (med_id,))
    return {"success": True}


@router.post("/me/medications/{med_id}/doses", status_code=201)
def take_dose(med_id: str, body: DoseBody, user: dict = Depends(current_user)):
    with get_db() as db:
        found = db.execute(
            "SELECT id FROM medications WHERE id = ? AND user_id = ?", (med_id, user["id"])
        ).fetchone()
        if not found:
            raise HTTPException(404, "Medicine not found.")
        db.execute(
            """INSERT INTO medication_doses (user_id, medication_id, date, slot, taken_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(user_id, medication_id, date, slot) DO UPDATE SET taken_at = excluded.taken_at""",
            (user["id"], med_id, body.date, body.slot, utcnow_iso()),
        )
    return {"success": True}


@router.delete("/me/medications/{med_id}/doses")
def undo_dose(med_id: str, date: str, slot: str, user: dict = Depends(current_user)):
    with get_db() as db:
        db.execute(
            "DELETE FROM medication_doses WHERE user_id = ? AND medication_id = ? AND date = ? AND slot = ?",
            (user["id"], med_id, date, slot),
        )
    return {"success": True}


@router.get("/me/medications/adherence")
def adherence(days: int = 14, user: dict = Depends(current_user)):
    days = max(1, min(90, days))
    today = date.today()
    since = today - timedelta(days=days - 1)
    with get_db() as db:
        meds = db.execute(
            "SELECT * FROM medications WHERE user_id = ?", (user["id"],)
        ).fetchall()
        doses = db.execute(
            "SELECT medication_id, date, slot FROM medication_doses WHERE user_id = ? AND date >= ?",
            (user["id"], since.isoformat()),
        ).fetchall()

    taken = {(d["medication_id"], d["date"], d["slot"]) for d in doses}
    scheduled = 0
    done = 0
    for offset in range(days):
        day = since + timedelta(days=offset)
        iso = day.isoformat()
        for m in meds:
            start = m["started_on"]
            if start and iso < start:
                continue
            if m["ends_on"] and iso > m["ends_on"]:
                continue
            if not m["active"] and iso == today.isoformat():
                continue
            for slot in json.loads(m["times"] or "[]"):
                if iso == today.isoformat() and slot > datetime.now().strftime("%H:%M"):
                    continue
                scheduled += 1
                if (m["id"], iso, slot) in taken:
                    done += 1

    return {
        "days": days,
        "scheduled": scheduled,
        "taken": done,
        "rate": round(done / scheduled, 3) if scheduled else None,
    }
