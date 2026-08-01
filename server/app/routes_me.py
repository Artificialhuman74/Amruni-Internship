"""Current-user profile and health state (cycle, pregnancy, settings, screenings)."""
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .auth import current_user
from . import crypto
from .db import get_db

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
            "phone": crypto.dec(user["phone"]),
            "name": crypto.dec(user["name"]),
            "dob": crypto.dec(user["dob"]),
            "lifeStage": user["life_stage"],
            "isOnboarded": bool(user["is_onboarded"]),
        },
        "cycle": {
            "lastPeriodStart": cycle["last_period_start"] if cycle else None,
            "cycleLength": cycle["cycle_length"] if cycle else 28,
            "periodLength": cycle["period_length"] if cycle else 5,
            "loggedDays": {
                log["date"]: {"flow": log["flow"], "symptoms": crypto.dec_json(log["symptoms"], [])}
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
                    # This table is a mirror the mood log also writes to, and it
                    # writes encrypted; a day logged from the pregnancy screen
                    # may still be plaintext. Both readers below tolerate either.
                    "mood": crypto.dec(log["mood"]),
                    "valence": log["valence"],
                    "symptoms": crypto.dec_json(log["symptoms"], []),
                }
                for log in preg_logs
            },
        },
        # Her own health background. Stored in `patient_charts` rather than a
        # parallel table: it is the same fact her doctor reads, and two copies
        # of "does she have PCOS" is exactly the kind of split that ends with
        # the chart and the app disagreeing.
        "health": {
            "conditions": crypto.dec_json(chart["conditions"], []) if chart else [],
            "allergies": crypto.dec_json(chart["allergies"], []) if chart else [],
            "bloodGroup": crypto.dec(chart["blood_group"]) if chart else None,
        },
        "settings": {
            "notifications": bool(settings["notifications"]) if settings else True,
            "anonymousMode": bool(settings["anonymous_mode"]) if settings else True,
            "identityWarningSeen": settings["identity_warning_seen"] if settings else 0,
            "weightTracking": bool(settings["weight_tracking"]) if settings else False,
            "conceiveMode": bool(settings["conceive_mode"]) if settings else False,
            "pregnancyMode": bool(settings["pregnancy_mode"]) if settings else False,
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
    anonymousMode: bool = True
    identityWarningSeen: int = 0
    weightTracking: bool = False
    conceiveMode: bool = False
    pregnancyMode: bool = False


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
    """She declares her own conditions, allergies and blood group.

    Writes the same `patient_charts` row her doctor reads and edits — one
    record, not a patient copy and a clinical copy that drift apart. The
    cycle model reads it too, which is why declaring PCOS or a thyroid
    condition immediately widens her prediction window (see routes_ml).
    """
    with get_db() as db:
        db.execute(
            """INSERT INTO patient_charts (user_id, conditions, allergies, blood_group, updated_at)
               VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
               ON CONFLICT(user_id) DO UPDATE SET
                 conditions = excluded.conditions,
                 allergies = excluded.allergies,
                 blood_group = excluded.blood_group,
                 updated_at = excluded.updated_at""",
            (user["id"], crypto.enc_json(body.conditions), crypto.enc_json(body.allergies),
             crypto.enc(body.bloodGroup)),
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
                crypto.enc(patch["name"]) if "name" in patch else user["name"],
                crypto.enc(patch["dob"]) if "dob" in patch else user["dob"],
                patch.get("lifeStage", user["life_stage"]),
                int(patch["isOnboarded"]) if "isOnboarded" in patch else user["is_onboarded"],
                user["id"],
            ),
        )
    return me_payload(user["id"])


@router.put("/me/state")
def put_state(body: StateBody, user: dict = Depends(current_user)):
    """Bulk sync from the app's state provider: upserts every slice at once."""
    u = body.user.model_dump(exclude_unset=True)
    with get_db() as db:
        if u:
            db.execute(
                "UPDATE users SET name = ?, dob = ?, life_stage = ?, is_onboarded = ? WHERE id = ?",
                (
                    crypto.enc(u["name"]) if "name" in u else user["name"],
                    crypto.enc(u["dob"]) if "dob" in u else user["dob"],
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
                    (user["id"], day, data.get("flow"), crypto.enc_json(data.get("symptoms") or [])),
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
                    (user["id"], day, crypto.enc(data.get("mood")), data.get("valence"),
                     crypto.enc_json(data.get("symptoms") or [])),
                )
        db.execute(
            """INSERT INTO user_settings
                 (user_id, notifications, anonymous_mode, identity_warning_seen, weight_tracking,
                  conceive_mode, pregnancy_mode)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET
                 notifications = excluded.notifications, anonymous_mode = excluded.anonymous_mode,
                 identity_warning_seen = excluded.identity_warning_seen,
                 weight_tracking = excluded.weight_tracking, conceive_mode = excluded.conceive_mode,
                 pregnancy_mode = excluded.pregnancy_mode""",
            (user["id"], int(body.settings.notifications), int(body.settings.anonymousMode),
             body.settings.identityWarningSeen, int(body.settings.weightTracking),
             int(body.settings.conceiveMode), int(body.settings.pregnancyMode)),
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
