"""Health camps — organised by the admin, announced to patients.

A camp is an in-person event: a type from the fixed list below, one or more
days, a venue in a city, and the doctors who will be there. The admin creates
and edits them; patients see a notice on Home while a camp is coming up,
running, or was just held, and can open the full list.

Camps are public information (a poster on a clinic wall), so the list needs no
sign-in and nothing here is encrypted. Doctors are linked by id so a camp
always shows each doctor's current name and specialty.
"""
import re
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .auth import require_admin
from .db import get_db, new_id

router = APIRouter()

CAMP_TYPES = (
    "Women's Wellness Camp",
    "Breast Health & Cancer Screening Camp",
    "Menopause Wellness Camp",
    "PCOS/PCOD Camp",
    "Mental Wellness & Counselling Camp",
    "Postnatal Wellness Camp",
    "Diabetes & BP Screening Camp",
    "Heart Health Camp",
    "Yoga & Lifestyle Wellness Camp",
    "General Health Screening Camp",
)

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME_RE = re.compile(r"^\d{2}:\d{2}$")

# What "recent" means on the patient's Home: coming up in the next month,
# running now, or held in the last week.
UPCOMING_DAYS = 30
RECENT_DAYS = 7


class CampBody(BaseModel):
    campType: str
    title: str | None = None
    description: str | None = None
    startsOn: str
    endsOn: str | None = None
    startTime: str | None = None
    endTime: str | None = None
    venue: str
    address: str | None = None
    city: str
    fee: int = Field(default=0, ge=0, le=100000)
    doctorIds: list[int] = Field(default_factory=list, max_length=50)
    cancelled: bool = False


def _clean(body: CampBody) -> dict:
    if body.campType not in CAMP_TYPES:
        raise HTTPException(422, "Choose a camp type from the list.")
    ends = body.endsOn or body.startsOn
    for label, d in (("Start date", body.startsOn), ("End date", ends)):
        if not DATE_RE.match(d or ""):
            raise HTTPException(422, f"{label} must be a date.")
    if ends < body.startsOn:
        raise HTTPException(422, "The camp cannot end before it starts.")
    for label, tm in (("Start time", body.startTime), ("End time", body.endTime)):
        if tm and not TIME_RE.match(tm):
            raise HTTPException(422, f"{label} must be HH:MM.")
    if body.startTime and body.endTime and body.startsOn == ends and body.endTime <= body.startTime:
        raise HTTPException(422, "The camp must end after it starts.")
    venue, city = (body.venue or "").strip(), (body.city or "").strip()
    if not venue or not city:
        raise HTTPException(422, "Add the venue and the city.")
    return {
        "camp_type": body.campType,
        "title": (body.title or "").strip()[:120] or body.campType,
        "description": (body.description or "").strip()[:2000] or None,
        "starts_on": body.startsOn,
        "ends_on": ends,
        "start_time": body.startTime or None,
        "end_time": body.endTime or None,
        "venue": venue[:160],
        "address": (body.address or "").strip()[:300] or None,
        "city": city[:80],
        "fee_inr": body.fee,
        "cancelled": int(body.cancelled),
    }


def _status(row, today: str) -> str:
    if row["cancelled"]:
        return "cancelled"
    if row["ends_on"] < today:
        return "held"
    if row["starts_on"] <= today:
        return "ongoing"
    return "upcoming"


def camp_json(db, row, today: str | None = None) -> dict:
    today = today or date.today().isoformat()
    doctors = db.execute(
        """SELECT d.id, d.name, d.specialty, d.photo, d.avatar FROM camp_doctors cd
           JOIN doctors d ON d.id = cd.doctor_id WHERE cd.camp_id = ? ORDER BY d.name""",
        (row["id"],),
    ).fetchall()
    return {
        "id": row["id"],
        "campType": row["camp_type"],
        "title": row["title"],
        "description": row["description"],
        "startsOn": row["starts_on"],
        "endsOn": row["ends_on"],
        "startTime": row["start_time"],
        "endTime": row["end_time"],
        "venue": row["venue"],
        "address": row["address"],
        "city": row["city"],
        "fee": row["fee_inr"],
        "cancelled": bool(row["cancelled"]),
        "status": _status(row, today),
        "doctors": [dict(d) for d in doctors],
    }


def _set_doctors(db, camp_id: str, doctor_ids: list[int]):
    db.execute("DELETE FROM camp_doctors WHERE camp_id = ?", (camp_id,))
    ids = list(dict.fromkeys(doctor_ids))
    if not ids:
        return
    marks = ",".join("?" * len(ids))
    found = {r["id"] for r in db.execute(f"SELECT id FROM doctors WHERE id IN ({marks})", ids).fetchall()}
    missing = [i for i in ids if i not in found]
    if missing:
        raise HTTPException(422, "One of the chosen doctors no longer exists.")
    db.executemany("INSERT INTO camp_doctors (camp_id, doctor_id) VALUES (?, ?)", [(camp_id, i) for i in ids])


@router.get("/camps/types")
def camp_types():
    return list(CAMP_TYPES)


@router.get("/camps")
def list_camps(scope: str = "recent"):
    """`recent` (default): cancelled camps excluded; held in the last week,
    running, or starting within a month — what patients are shown.
    `all`: every camp, newest first — what the admin manages."""
    today = date.today()
    with get_db() as db:
        if scope == "all":
            rows = db.execute("SELECT * FROM camps ORDER BY starts_on DESC").fetchall()
        else:
            rows = db.execute(
                """SELECT * FROM camps
                   WHERE cancelled = 0 AND ends_on >= ? AND starts_on <= ?
                   ORDER BY starts_on""",
                ((today - timedelta(days=RECENT_DAYS)).isoformat(), (today + timedelta(days=UPCOMING_DAYS)).isoformat()),
            ).fetchall()
        items = [camp_json(db, r, today.isoformat()) for r in rows]
    if scope != "all":
        # Running first, then soonest upcoming, then the just-held ones.
        order = {"ongoing": 0, "upcoming": 1, "held": 2}
        items.sort(key=lambda c: (order[c["status"]], c["startsOn"] if c["status"] != "held" else "~" + c["endsOn"]))
    return items


@router.get("/camps/{camp_id}")
def get_camp(camp_id: str):
    with get_db() as db:
        row = db.execute("SELECT * FROM camps WHERE id = ?", (camp_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Camp not found")
        return camp_json(db, row)


@router.post("/camps", status_code=201)
def create_camp(body: CampBody, _: dict = Depends(require_admin)):
    fields = _clean(body)
    camp_id = new_id("camp")
    with get_db() as db:
        cols = ", ".join(fields)
        db.execute(
            f"INSERT INTO camps (id, {cols}) VALUES (?, {', '.join('?' * len(fields))})",
            (camp_id, *fields.values()),
        )
        _set_doctors(db, camp_id, body.doctorIds)
        return camp_json(db, db.execute("SELECT * FROM camps WHERE id = ?", (camp_id,)).fetchone())


@router.put("/camps/{camp_id}")
def update_camp(camp_id: str, body: CampBody, _: dict = Depends(require_admin)):
    fields = _clean(body)
    with get_db() as db:
        sets = ", ".join(f"{k} = ?" for k in fields)
        cur = db.execute(
            f"UPDATE camps SET {sets}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
            (*fields.values(), camp_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "Camp not found")
        _set_doctors(db, camp_id, body.doctorIds)
        return camp_json(db, db.execute("SELECT * FROM camps WHERE id = ?", (camp_id,)).fetchone())


@router.delete("/camps/{camp_id}")
def delete_camp(camp_id: str, _: dict = Depends(require_admin)):
    with get_db() as db:
        db.execute("DELETE FROM camp_doctors WHERE camp_id = ?", (camp_id,))
        cur = db.execute("DELETE FROM camps WHERE id = ?", (camp_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Camp not found")
    return {"success": True}
