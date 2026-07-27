"""State of Mind — the mood log, and the signals derived from it.

Mood is stored as a timestamped stream (see `mood_logs` in db.py) rather than
one row per day, which is what lets the same record serve three callers: the
daily check-in, the mood attached to a journal entry, and the log in Track.

Two scopes, following the Apple Health model the check-in's interaction is
already built on:
  · `day`     — "how was your whole day", at most one per date, re-logging
                overwrites it.
  · `moment`  — "how do you feel right now", unlimited per date.

The day-scope entry is mirrored into `pregnancy_logs` so the cycle/ML readers
that predate this table keep working without a migration.
"""
import json
from collections import defaultdict
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth.auth import current_user
from ...database.db import get_db, new_id, utcnow_iso

router = APIRouter()

LOW_VALENCE = -2
LOW_STREAK_DAYS = 3

MIN_LOGS_FOR_CORRELATION = 8
MIN_LOGS_PER_PHASE = 3


class MoodBody(BaseModel):
    date: str
    loggedAt: str | None = None
    scope: str = "moment"
    valence: int = Field(ge=-3, le=3)
    word: str | None = None
    factors: list[str] = []
    source: str = "checkin"
    journalId: str | None = None


def _mood_json(row) -> dict:
    return {
        "id": row["id"],
        "date": row["date"],
        "loggedAt": row["logged_at"],
        "scope": row["scope"],
        "valence": row["valence"],
        "word": row["word"],
        "factors": json.loads(row["factors"] or "[]"),
        "source": row["source"],
        "journalId": row["journal_id"],
    }


def _valid_day(s: str) -> bool:
    return isinstance(s, str) and len(s) == 10 and s[4] == "-" and s[7] == "-"


@router.get("/mood")
def list_mood(
    since: str | None = None,
    until: str | None = None,
    user: dict = Depends(current_user),
):
    clause, params = "user_id = ?", [user["id"]]
    if since and _valid_day(since):
        clause += " AND date >= ?"
        params.append(since)
    if until and _valid_day(until):
        clause += " AND date <= ?"
        params.append(until)
    with get_db() as db:
        rows = db.execute(
            f"SELECT * FROM mood_logs WHERE {clause} ORDER BY date DESC, logged_at DESC",
            params,
        ).fetchall()
    return [_mood_json(r) for r in rows]


@router.post("/mood", status_code=201)
def create_mood(body: MoodBody, user: dict = Depends(current_user)):
    if not _valid_day(body.date):
        raise HTTPException(422, "date must be YYYY-MM-DD.")
    if body.scope not in ("moment", "day"):
        raise HTTPException(422, "scope must be 'moment' or 'day'.")

    logged_at = body.loggedAt or utcnow_iso()
    with get_db() as db:
        if body.scope == "day":
            existing = db.execute(
                "SELECT id FROM mood_logs WHERE user_id = ? AND date = ? AND scope = 'day'",
                (user["id"], body.date),
            ).fetchone()
            if existing:
                db.execute("DELETE FROM mood_logs WHERE id = ?", (existing["id"],))

        mood_id = new_id("mood")
        db.execute(
            """INSERT INTO mood_logs
                 (id, user_id, date, logged_at, scope, valence, word, factors, source, journal_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (mood_id, user["id"], body.date, logged_at, body.scope, body.valence,
             body.word, json.dumps(body.factors), body.source, body.journalId),
        )

        if body.scope == "day":
            db.execute(
                """INSERT INTO pregnancy_logs (user_id, date, mood, valence, symptoms)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(user_id, date) DO UPDATE SET
                     mood = excluded.mood, valence = excluded.valence""",
                (user["id"], body.date, body.word, body.valence, json.dumps(body.factors)),
            )

        row = db.execute("SELECT * FROM mood_logs WHERE id = ?", (mood_id,)).fetchone()
    return _mood_json(row)


@router.delete("/mood/{mood_id}")
def delete_mood(mood_id: str, user: dict = Depends(current_user)):
    with get_db() as db:
        existing = db.execute(
            "SELECT id FROM mood_logs WHERE id = ? AND user_id = ?", (mood_id, user["id"])
        ).fetchone()
        if not existing:
            raise HTTPException(404, "Mood entry not found.")
        db.execute("DELETE FROM mood_logs WHERE id = ?", (mood_id,))
    return {"success": True}


# ---------- derived signals ----------

def _phase_for(day_index: int, cycle_length: int, period_length: int) -> str:
    if day_index <= period_length:
        return "menstrual"
    if day_index <= cycle_length - 14 - 5:
        return "follicular"
    if day_index <= cycle_length - 14 + 1:
        return "ovulation"
    return "luteal"


PHASE_LABELS = {
    "menstrual": "your period",
    "follicular": "your follicular phase",
    "ovulation": "around ovulation",
    "luteal": "your luteal phase",
}


@router.get("/mood/insights")
def mood_insights(user: dict = Depends(current_user)):
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM mood_logs WHERE user_id = ? ORDER BY date ASC", (user["id"],)
        ).fetchall()
        cycle = db.execute(
            "SELECT * FROM cycle_state WHERE user_id = ?", (user["id"],)
        ).fetchone()

    logs = [_mood_json(r) for r in rows]
    if not logs:
        return {"ready": False, "reason": "Log how you're feeling and your patterns will appear here.",
                "lowStreak": 0, "needsSupport": False, "cycleCorrelation": None, "factorImpact": []}

    by_day: dict[str, list[int]] = defaultdict(list)
    for log in logs:
        by_day[log["date"]].append(log["valence"])
    day_mean = {d: sum(v) / len(v) for d, v in by_day.items()}

    return {
        "ready": True,
        "daysLogged": len(day_mean),
        "totalLogs": len(logs),
        "average": round(sum(day_mean.values()) / len(day_mean), 2),
        "lowStreak": _low_streak(day_mean),
        "needsSupport": _low_streak(day_mean) >= LOW_STREAK_DAYS,
        "cycleCorrelation": _cycle_correlation(day_mean, cycle),
        "factorImpact": _factor_impact(logs),
    }


def _low_streak(day_mean: dict[str, float]) -> int:
    if not day_mean:
        return 0
    today = date.today()
    streak = 0
    for offset in range(0, 60):
        day = (today.toordinal() - offset)
        key = date.fromordinal(day).isoformat()
        if key not in day_mean:
            if offset == 0:
                continue
            break
        if day_mean[key] <= LOW_VALENCE:
            streak += 1
        else:
            break
    return streak


def _cycle_correlation(day_mean: dict[str, float], cycle) -> dict | None:
    if not cycle or not cycle["last_period_start"] or len(day_mean) < MIN_LOGS_FOR_CORRELATION:
        return None
    try:
        start = date.fromisoformat(cycle["last_period_start"])
    except ValueError:
        return None

    cycle_length = cycle["cycle_length"] or 28
    period_length = cycle["period_length"] or 5

    buckets: dict[str, list[float]] = defaultdict(list)
    pre_period: list[float] = []
    for day_str, mean in day_mean.items():
        try:
            day = date.fromisoformat(day_str)
        except ValueError:
            continue
        elapsed = (day - start).days
        if elapsed < 0:
            continue
        day_index = (elapsed % cycle_length) + 1
        buckets[_phase_for(day_index, cycle_length, period_length)].append(mean)
        if day_index > cycle_length - 3:
            pre_period.append(mean)

    phases = {
        phase: {"mean": round(sum(v) / len(v), 2), "days": len(v)}
        for phase, v in buckets.items()
        if len(v) >= MIN_LOGS_PER_PHASE
    }
    if len(phases) < 2:
        return None

    lowest = min(phases, key=lambda p: phases[p]["mean"])
    highest = max(phases, key=lambda p: phases[p]["mean"])
    spread = phases[highest]["mean"] - phases[lowest]["mean"]
    if spread < 0.5:
        return None

    overall = sum(day_mean.values()) / len(day_mean)
    result = {
        "phases": phases,
        "lowest": lowest,
        "lowestLabel": PHASE_LABELS[lowest],
        "highest": highest,
        "highestLabel": PHASE_LABELS[highest],
        "spread": round(spread, 2),
        "text": f"Your mood tends to sit lowest during {PHASE_LABELS[lowest]} "
                f"and highest {PHASE_LABELS[highest]}.",
        "prePeriod": None,
    }
    if len(pre_period) >= MIN_LOGS_PER_PHASE:
        pre_mean = sum(pre_period) / len(pre_period)
        if overall - pre_mean >= 0.5:
            result["prePeriod"] = {
                "mean": round(pre_mean, 2),
                "days": len(pre_period),
                "text": "Your mood dips in the three days before your period. "
                        "That's your own pattern, and it's worth planning around.",
            }
    return result


def _factor_impact(logs: list[dict], limit: int = 4) -> list[dict]:
    if len(logs) < MIN_LOGS_FOR_CORRELATION:
        return []
    overall = sum(log["valence"] for log in logs) / len(logs)
    buckets: dict[str, list[int]] = defaultdict(list)
    for log in logs:
        for factor in log["factors"]:
            buckets[factor].append(log["valence"])

    ranked = []
    for factor, values in buckets.items():
        if len(values) < MIN_LOGS_PER_PHASE:
            continue
        mean = sum(values) / len(values)
        ranked.append({
            "factor": factor,
            "mean": round(mean, 2),
            "count": len(values),
            "delta": round(mean - overall, 2),
        })
    ranked.sort(key=lambda f: f["delta"])
    return ranked[:limit]
