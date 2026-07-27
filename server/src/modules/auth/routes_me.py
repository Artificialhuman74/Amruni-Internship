"""Current-user profile and health state (cycle, pregnancy, settings, screenings)."""
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .auth import current_user
from ...database.db import get_db

router = APIRouter()


def me_payload(user_id: int) -> dict:
    with get_db() as db:
        user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        cycle = db.execute("SELECT * FROM cycle_state WHERE user_id = ?", (user_id,)).fetchone()
        logs = db.execute("SELECT date, flow, symptoms FROM cycle_logs WHERE user_id = ?", (user_id,)).fetchall()
        preg = db.execute("SELECT * FROM pregnancy_state WHERE user_id = ?", (user_id,)).fetchone()
        preg_logs = db.execute(
            "SELECT date, mood, valence, symptoms FROM pregnancy_logs WHERE user_id = ?", (user_id,)
        ).fetchall()
        settings = db.execute("SELECT * FROM user_settings WHERE user_id = ?", (user_id,)).fetchone()
        chart = db.execute("SELECT * FROM patient_charts WHERE user_id = ?", (user_id,)).fetchone()

    return {
        "user": {
            "phone": user["phone"],
            "name": user["name"],
            "dob": user["dob"],
            "lifeStage": user["life_stage"],
            "isOnboarded": bool(user["is_onboarded"]),
        },
        "cycle": {
            "lastPeriodStart": cycle["last_period_start"] if cycle else None,
            "cycleLength": cycle["cycle_length"] if cycle else 28,
            "periodLength": cycle["period_length"] if cycle else 5,
            "loggedDays": {
                log["date"]: {"flow": log["flow"], "symptoms": json.loads(log["symptoms"] or "[]")}
                for log in logs
            },
        },
        "pregnancy": {
            "lastPeriodStart": preg["last_period_start"] if preg else None,
            "dueDateOverride": preg["due_date_override"] if preg else None,
            "prePregnancyWeightKg": preg["pre_pregnancy_weight_kg"] if preg else None,
            "heightCm": preg["height_cm"] if preg else None,
            "trustedContacts": json.loads(preg["trusted_contacts"] or "[]") if preg else [],
            "weightLogs": json.loads(preg["weight_logs"] or "[]") if preg else [],
            "kickCounts": json.loads(preg["kick_counts"] or "{}") if preg else {},
            "loggedDays": {
                log["date"]: {
                    "mood": log["mood"],
                    "valence": log["valence"],
                    "symptoms": json.loads(log["symptoms"] or "[]"),
                }
                for log in preg_logs
            },
        },
        "health": {
            "conditions": json.loads(chart["conditions"]) if chart and chart["conditions"] else [],
            "allergies": json.loads(chart["allergies"]) if chart and chart["allergies"] else [],
            "bloodGroup": chart["blood_group"] if chart else None,
        },
        "settings": {
            "notifications": bool(settings["notifications"]) if settings else True,
            "anonymousMode": bool(settings["anonymous_mode"]) if settings else False,
            "identityWarningSeen": settings["identity_warning_seen"] if settings else 0,
        },
    }


class ProfilePatch(BaseModel):
    name: str | None = None
    dob: str | None = None
    lifeStage: str | None = None
    isOnboarded: bool | None = None


class UserSlice(BaseModel):
    name: str | None = None
    dob: str | None = None
    lifeStage: str | None = None
    isOnboarded: bool | None = None


class CycleSlice(BaseModel):
    lastPeriodStart: str | None = None
    cycleLength: int = 28
    periodLength: int = 5
    loggedDays: dict[str, dict] = {}


class PregnancySlice(BaseModel):
    lastPeriodStart: str | None = None
    dueDateOverride: str | None = None
    prePregnancyWeightKg: float | None = None
    heightCm: float | None = None
    trustedContacts: list = []
    weightLogs: list = []
    kickCounts: dict[str, int] = {}
    loggedDays: dict[str, dict] = {}


class SettingsSlice(BaseModel):
    notifications: bool = True
    anonymousMode: bool = False
    identityWarningSeen: int = 0


class StateBody(BaseModel):
    user: UserSlice = UserSlice()
    cycle: CycleSlice = CycleSlice()
    pregnancy: PregnancySlice = PregnancySlice()
    settings: SettingsSlice = SettingsSlice()


class HealthBody(BaseModel):
    conditions: list[str] = []
    allergies: list[str] = []
    bloodGroup: str | None = None


class ScreeningBody(BaseModel):
    tool: str
    score: int
    answers: list = []


@router.put("/me/health")
def put_health(body: HealthBody, user: dict = Depends(current_user)):
    with get_db() as db:
        db.execute(
            """INSERT INTO patient_charts (user_id, conditions, allergies, blood_group, updated_at)
               VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
               ON CONFLICT(user_id) DO UPDATE SET
                 conditions = excluded.conditions,
                 allergies = excluded.allergies,
                 blood_group = excluded.blood_group,
                 updated_at = excluded.updated_at""",
            (user["id"], json.dumps(body.conditions), json.dumps(body.allergies), body.bloodGroup),
        )
    return me_payload(user["id"])


@router.get("/me")
def get_me(user: dict = Depends(current_user)):
    return me_payload(user["id"])


@router.patch("/me")
def patch_me(body: ProfilePatch, user: dict = Depends(current_user)):
    patch = body.model_dump(exclude_unset=True)
    with get_db() as db:
        db.execute(
            "UPDATE users SET name = ?, dob = ?, life_stage = ?, is_onboarded = ? WHERE id = ?",
            (
                patch.get("name", user["name"]),
                patch.get("dob", user["dob"]),
                patch.get("lifeStage", user["life_stage"]),
                int(patch["isOnboarded"]) if "isOnboarded" in patch else user["is_onboarded"],
                user["id"],
            ),
        )
    return me_payload(user["id"])


@router.put("/me/state")
def put_state(body: StateBody, user: dict = Depends(current_user)):
    u = body.user.model_dump(exclude_unset=True)
    with get_db() as db:
        if u:
            db.execute(
                "UPDATE users SET name = ?, dob = ?, life_stage = ?, is_onboarded = ? WHERE id = ?",
                (
                    u.get("name", user["name"]),
                    u.get("dob", user["dob"]),
                    u.get("lifeStage", user["life_stage"]),
                    int(u["isOnboarded"]) if "isOnboarded" in u else user["is_onboarded"],
                    user["id"],
                ),
            )
        db.execute(
            """INSERT INTO cycle_state (user_id, last_period_start, cycle_length, period_length)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET
                 last_period_start = excluded.last_period_start,
                 cycle_length = excluded.cycle_length,
                 period_length = excluded.period_length""",
            (user["id"], body.cycle.lastPeriodStart, body.cycle.cycleLength, body.cycle.periodLength),
        )
        for day, data in body.cycle.loggedDays.items():
            if len(day) == 10 and day[4] == "-" and day[7] == "-":
                db.execute(
                    """INSERT INTO cycle_logs (user_id, date, flow, symptoms) VALUES (?, ?, ?, ?)
                       ON CONFLICT(user_id, date) DO UPDATE SET flow = excluded.flow, symptoms = excluded.symptoms""",
                    (user["id"], day, data.get("flow"), json.dumps(data.get("symptoms") or [])),
                )
        db.execute(
            """INSERT INTO pregnancy_state
                 (user_id, last_period_start, due_date_override, pre_pregnancy_weight_kg,
                  height_cm, trusted_contacts, weight_logs, kick_counts)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET
                 last_period_start = excluded.last_period_start,
                 due_date_override = excluded.due_date_override,
                 pre_pregnancy_weight_kg = excluded.pre_pregnancy_weight_kg,
                 height_cm = excluded.height_cm,
                 trusted_contacts = excluded.trusted_contacts,
                 weight_logs = excluded.weight_logs,
                 kick_counts = excluded.kick_counts""",
            (user["id"], body.pregnancy.lastPeriodStart, body.pregnancy.dueDateOverride,
             body.pregnancy.prePregnancyWeightKg, body.pregnancy.heightCm,
             json.dumps(body.pregnancy.trustedContacts), json.dumps(body.pregnancy.weightLogs),
             json.dumps(body.pregnancy.kickCounts)),
        )
        for day, data in body.pregnancy.loggedDays.items():
            if len(day) == 10 and day[4] == "-" and day[7] == "-":
                db.execute(
                    """INSERT INTO pregnancy_logs (user_id, date, mood, valence, symptoms) VALUES (?, ?, ?, ?, ?)
                       ON CONFLICT(user_id, date) DO UPDATE SET
                         mood = excluded.mood, valence = excluded.valence, symptoms = excluded.symptoms""",
                    (user["id"], day, data.get("mood"), data.get("valence"), json.dumps(data.get("symptoms") or [])),
                )
        db.execute(
            """INSERT INTO user_settings (user_id, notifications, anonymous_mode, identity_warning_seen) VALUES (?, ?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET
                 notifications = excluded.notifications, anonymous_mode = excluded.anonymous_mode,
                 identity_warning_seen = excluded.identity_warning_seen""",
            (user["id"], int(body.settings.notifications), int(body.settings.anonymousMode), body.settings.identityWarningSeen),
        )
    return {"success": True}


class CycleBody(BaseModel):
    lastPeriodStart: str | None = None
    cycleLength: int = 28
    periodLength: int = 5


class DayLogBody(BaseModel):
    flow: str | None = None
    symptoms: list[str] = []


@router.put("/me/cycle")
def put_cycle(body: CycleBody, user: dict = Depends(current_user)):
    with get_db() as db:
        db.execute(
            """INSERT INTO cycle_state (user_id, last_period_start, cycle_length, period_length)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET
                 last_period_start = excluded.last_period_start,
                 cycle_length = excluded.cycle_length,
                 period_length = excluded.period_length""",
            (user["id"], body.lastPeriodStart, body.cycleLength, body.periodLength),
        )
    return {"success": True}


@router.put("/me/cycle/logs/{day}")
def put_cycle_log(day: str, body: DayLogBody, user: dict = Depends(current_user)):
    if not (len(day) == 10 and day[4] == "-" and day[7] == "-"):
        raise HTTPException(400, "Date must be YYYY-MM-DD.")
    with get_db() as db:
        db.execute(
            """INSERT INTO cycle_logs (user_id, date, flow, symptoms) VALUES (?, ?, ?, ?)
               ON CONFLICT(user_id, date) DO UPDATE SET flow = excluded.flow, symptoms = excluded.symptoms""",
            (user["id"], day, body.flow, json.dumps(body.symptoms)),
        )
    return {"success": True}


@router.post("/me/screenings", status_code=201)
def post_screening(body: ScreeningBody, user: dict = Depends(current_user)):
    if body.tool not in ("phq9", "gad7"):
        raise HTTPException(400, "tool must be phq9 or gad7.")
    with get_db() as db:
        db.execute(
            "INSERT INTO screenings (user_id, tool, score, answers) VALUES (?, ?, ?, ?)",
            (user["id"], body.tool, body.score, json.dumps(body.answers)),
        )
    return {"success": True}


@router.get("/me/screenings")
def get_screenings(user: dict = Depends(current_user)):
    with get_db() as db:
        rows = db.execute(
            "SELECT tool, score, created_at FROM screenings WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
            (user["id"],),
        ).fetchall()
    return [{"tool": r["tool"], "score": r["score"], "createdAt": r["created_at"]} for r in rows]
