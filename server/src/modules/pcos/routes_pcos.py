"""PCOS screening + patient-managed conditions.

Patients run a self-check questionnaire (real ML model behind it), can add PCOS
(or any condition) to their own health record, and — because that record feeds
the cycle predictor — a PCOS flag widens their period-prediction window to match
how PCOS cycles actually behave.
"""
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from . import pcos
from ..auth.auth import current_user
from ...database.db import get_db, utcnow_iso

router = APIRouter()


class ScreeningBody(BaseModel):
    age: float | None = None
    bmi: float | None = None
    irregular: bool = False
    weightGain: bool = False
    hairGrowth: bool = False
    skinDarkening: bool = False
    pimples: bool = False
    fastFood: bool = False
    regExercise: bool = False


BAND_MESSAGE = {
    "low": "Your answers don't point strongly toward PCOS. Keep tracking your cycle — patterns matter more than any single month.",
    "moderate": "Some of your answers are associated with PCOS. This isn't a diagnosis, but it's worth a conversation with a gynaecologist.",
    "high": "Several of your answers are commonly linked to PCOS. We'd gently encourage booking a specialist — early guidance makes a real difference.",
}


@router.post("/me/pcos-screening")
def pcos_screening(body: ScreeningBody, user: dict = Depends(current_user)):
    features = {
        "age": body.age or 25,
        "bmi": body.bmi or 24,
        "irregular": 1 if body.irregular else 0,
        "weightGain": 1 if body.weightGain else 0,
        "hairGrowth": 1 if body.hairGrowth else 0,
        "skinDarkening": 1 if body.skinDarkening else 0,
        "pimples": 1 if body.pimples else 0,
        "fastFood": 1 if body.fastFood else 0,
        "regExercise": 1 if body.regExercise else 0,
    }
    result = pcos.screen(features, model="full")
    result["message"] = BAND_MESSAGE[result["band"]]
    return result


# ---------- patient-managed conditions ----------

def _chart(db, user_id):
    row = db.execute("SELECT * FROM patient_charts WHERE user_id = ?", (user_id,)).fetchone()
    return {
        "allergies": json.loads(row["allergies"]) if row else [],
        "conditions": json.loads(row["conditions"]) if row else [],
        "bloodGroup": row["blood_group"] if row else None,
    }


class ConditionBody(BaseModel):
    condition: str


@router.get("/me/conditions")
def get_conditions(user: dict = Depends(current_user)):
    with get_db() as db:
        chart = _chart(db, user["id"])
    return {"conditions": chart["conditions"], "allergies": chart["allergies"], "bloodGroup": chart["bloodGroup"]}


@router.post("/me/conditions")
def add_condition(body: ConditionBody, user: dict = Depends(current_user)):
    name = body.condition.strip()
    if not name:
        raise HTTPException(400, "Condition name is required.")
    with get_db() as db:
        chart = _chart(db, user["id"])
        conditions = chart["conditions"]
        if not any(c.lower() == name.lower() for c in conditions):
            conditions = [*conditions, name][:40]
        db.execute(
            """INSERT INTO patient_charts (user_id, allergies, conditions, blood_group, updated_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET conditions = excluded.conditions, updated_at = excluded.updated_at""",
            (user["id"], json.dumps(chart["allergies"]), json.dumps(conditions), chart["bloodGroup"], utcnow_iso()),
        )
    return {"conditions": conditions}


@router.delete("/me/conditions/{condition}")
def remove_condition(condition: str, user: dict = Depends(current_user)):
    with get_db() as db:
        chart = _chart(db, user["id"])
        conditions = [c for c in chart["conditions"] if c.lower() != condition.strip().lower()]
        db.execute(
            """INSERT INTO patient_charts (user_id, allergies, conditions, blood_group, updated_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET conditions = excluded.conditions, updated_at = excluded.updated_at""",
            (user["id"], json.dumps(chart["allergies"]), json.dumps(conditions), chart["bloodGroup"], utcnow_iso()),
        )
    return {"conditions": conditions}
