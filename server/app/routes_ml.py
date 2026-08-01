"""Cycle predictions endpoint: the ML layer behind the tracker.

Derives the user's real cycle history from her logged flow days, feeds it to
the quantile length model, and returns the period window, fertile window,
cycle history, symptom forecast and plain-language insights in one payload.
"""
import json
from datetime import date, timedelta

from fastapi import APIRouter, Depends

from . import ml, pcos
from .auth import current_user
from . import crypto
from .db import get_db

router = APIRouter()

FLOW_DAY_GAP = 9   # flow days further apart than this start a new period episode
MIN_CYCLE, MAX_CYCLE = 15, 70


def derive_cycle_starts(logs: dict, last_period_start: str | None) -> list[str]:
    """Group logged flow days into period episodes; each episode's first day is
    a cycle start. Spotting alone doesn't start a period — mid-cycle spotting
    would otherwise fabricate short cycles. The profile's lastPeriodStart
    participates as a flow day so setup-only users still anchor a cycle."""
    flow_days = sorted(
        d for d, v in logs.items()
        if v.get("flow") in ("light", "medium", "heavy")
    )
    if last_period_start and last_period_start not in flow_days:
        flow_days = sorted(set(flow_days) | {last_period_start})

    starts, prev = [], None
    for day_str in flow_days:
        try:
            d = date.fromisoformat(day_str)
        except ValueError:
            continue
        if prev is None or (d - prev).days > FLOW_DAY_GAP:
            starts.append(day_str)
        prev = d
    return starts


def _age(dob: str | None) -> int | None:
    if not dob:
        return None
    try:
        born = date.fromisoformat(dob)
    except ValueError:
        return None
    today = date.today()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


INSIGHT_REGULARITY = {
    "very regular": "Your cycles vary by under 2 days — remarkably steady. Predictions here should stay sharp.",
    "regular": "Your cycles hold a steady rhythm, varying by only a few days. That keeps predictions reliable.",
    "somewhat irregular": "Your recent cycles vary more than average. Stress, sleep and travel commonly do this — keep logging so the model can adjust.",
    "irregular": "Your cycle lengths have been swinging widely. That can be completely benign, but it's worth discussing with a gynaecologist — you can book one from the Consult tab.",
}

SYMPTOM_LABELS = {
    "cramps": "cramps", "bloating": "bloating", "headache": "headaches", "fatigue": "fatigue",
    "mood_swings": "mood swings", "breast_tender": "breast tenderness", "acne": "breakouts",
    "back_pain": "back pain", "nausea": "nausea", "cravings": "cravings",
    "insomnia": "restless sleep", "anxiety": "anxiety",
}


@router.get("/me/cycle/predictions")
def cycle_predictions(user: dict = Depends(current_user)):
    with get_db() as db:
        cycle = db.execute("SELECT * FROM cycle_state WHERE user_id = ?", (user["id"],)).fetchone()
        log_rows = db.execute(
            "SELECT date, flow, symptoms FROM cycle_logs WHERE user_id = ?", (user["id"],)
        ).fetchall()
        chart = db.execute("SELECT conditions FROM patient_charts WHERE user_id = ?", (user["id"],)).fetchone()

    conditions = crypto.dec_json(chart["conditions"], []) if chart else []
    # Conditions arrive two ways: structured ids she picked herself during
    # onboarding, and free text a doctor typed into her chart. Both are matched,
    # so a clinician writing "polycystic ovaries" counts the same as her tapping
    # PCOS.
    lowered = [c.lower() for c in conditions]
    has_pcos = "pcos" in conditions or any("pcos" in c or "polycystic" in c for c in lowered)

    # Other conditions with an established effect on menstrual regularity.
    # These widen the window too — less than PCOS, but a thyroid disorder or
    # significant anaemia genuinely makes a body less predictable, and a
    # confident date we can't stand behind is worse than an honest range.
    OTHER_IRREGULAR = {
        "hypothyroid", "hyperthyroid", "endometriosis", "fibroids", "amenorrhea",
        "menorrhagia", "pmdd", "ovarian_cyst", "prediabetes", "diabetes_t2",
        "obesity", "underweight", "eating_disorder", "anaemia", "lupus",
        "bleeding_disorder",
    }
    other_irregular = sorted(OTHER_IRREGULAR.intersection(conditions))

    logs = {
        r["date"]: {"flow": r["flow"], "symptoms": crypto.dec_json(r["symptoms"], [])}
        for r in log_rows
    }
    declared_len = cycle["cycle_length"] if cycle else 28
    period_len = cycle["period_length"] if cycle else 5
    last_period_start = cycle["last_period_start"] if cycle else None

    starts = derive_cycle_starts(logs, last_period_start)
    if not starts:
        return {"ready": False, "reason": "Log the first day of your period to start predictions."}

    # Cycle history: gaps between consecutive starts, sane lengths only.
    history_entries, lengths = [], []
    for i in range(1, len(starts)):
        gap = (date.fromisoformat(starts[i]) - date.fromisoformat(starts[i - 1])).days
        if MIN_CYCLE <= gap <= MAX_CYCLE:
            lengths.append(float(gap))
            history_entries.append({"start": starts[i - 1], "end": starts[i], "length": gap})

    pred = ml.predict_cycle_length(lengths, _age(user["dob"]), declared_len)
    reg = ml.regularity(lengths)

    # PCOS cycles run longer and far more variable. When the patient has flagged
    # PCOS, widen the window around the median and never claim high confidence —
    # honest uncertainty beats a falsely precise date.
    if has_pcos:
        mid = pred["mid"]
        pred["lo"] = min(pred["lo"], mid - max(5.0, (mid - pred["lo"]) * 1.8))
        pred["hi"] = max(pred["hi"], mid + max(7.0, (pred["hi"] - mid) * 1.8))
        pred["confidence"] = "low" if pred["confidence"] == "high" else pred["confidence"]
    elif other_irregular:
        # A gentler widening than PCOS, and it caps confidence at medium
        # rather than dropping it to low.
        mid = pred["mid"]
        pred["lo"] = min(pred["lo"], mid - max(3.0, (mid - pred["lo"]) * 1.35))
        pred["hi"] = max(pred["hi"], mid + max(4.0, (pred["hi"] - mid) * 1.35))
        pred["confidence"] = "medium" if pred["confidence"] == "high" else pred["confidence"]

    anchor = date.fromisoformat(starts[-1])
    next_mid = anchor + timedelta(days=round(pred["mid"]))
    window_start = anchor + timedelta(days=round(pred["lo"]))
    window_end = anchor + timedelta(days=round(pred["hi"]))

    # If the whole predicted window is already behind us (user stopped logging),
    # advance the anchor forward one predicted cycle at a time.
    today = date.today()
    while window_end < today:
        anchor = next_mid
        next_mid = anchor + timedelta(days=round(pred["mid"]))
        window_start = anchor + timedelta(days=round(pred["lo"]))
        window_end = anchor + timedelta(days=round(pred["hi"]))

    ovulation = next_mid - timedelta(days=14)
    fertile = [(ovulation + timedelta(days=off)).isoformat() for off in range(-5, 1)]
    predicted_days = [(window_start + timedelta(days=i)).isoformat()
                      for i in range((window_end - window_start).days + 1)]

    cycle_len_for_phase = pred["mid"]
    cycle_day = (today - anchor).days + 1
    forecast = ml.symptom_forecast(logs, starts, cycle_len_for_phase, period_len)

    # Passive PCOS-from-cycle signal: run the cycle-only model on the user's own
    # derived cycle stats. Only surfaced when they've logged enough and haven't
    # already flagged PCOS — a gentle nudge, computed from menstrual data alone.
    pcos_signal = None
    if len(lengths) >= 2 and not has_pcos:
        mean_len = float(sum(lengths) / len(lengths))
        irregular = reg["label"] in ("somewhat irregular", "irregular")
        risk = pcos.screen({
            "irregular": 1 if irregular else 0,
            "age": _age(user["dob"]) or 25,
            "bmi": 24,  # not collected here; questionnaire refines it
            "weightGain": 0,
        }, model="cycle")
        if risk["band"] in ("moderate", "high"):
            pcos_signal = {"band": risk["band"], "topFactors": risk["topFactors"]}

    # Plain-language insights, most important first.
    insights = []
    days_to = (next_mid - today).days
    if has_pcos:
        insights.append({
            "icon": "🌼",
            "text": "You've noted PCOS, so we widen this window on purpose — PCOS cycles naturally vary more. Logging every period still sharpens it as much as possible.",
        })
    if 0 <= days_to <= 3:
        insights.append({
            "icon": "🌙",
            "text": f"Your period is likely {'today' if days_to == 0 else f'in {days_to} day' + ('s' if days_to > 1 else '')}. A heat pad and iron-rich meals ready now pay off later.",
        })
    if pcos_signal:
        insights.append({
            "iconKey": "care",
            "text": f"Your cycle pattern shows some signs associated with PCOS. It's not a diagnosis — a 2-minute self-check can tell you whether it's worth a specialist's view.",
            "action": "pcos-check",
        })
    if reg["label"]:
        insights.append({"iconKey": "trend", "text": INSIGHT_REGULARITY[reg["label"]]})
    bucket_now = ml.phase_bucket(min(cycle_day, 60), cycle_len_for_phase, period_len)
    top_now = [s for s in forecast.get(bucket_now, []) if s["fromYou"]][:2]
    if top_now:
        names = " and ".join(SYMPTOM_LABELS.get(s["id"], s["id"]) for s in top_now)
        insights.append({"iconKey": "forecast", "text": f"In this phase you've most often logged {names}. Gentle movement and hydration usually take the edge off."})
    if len(lengths) < 3:
        remaining = 3 - len(lengths)
        insights.append({"iconKey": "log", "text": f"Log {remaining} more period{'s' if remaining > 1 else ''} and predictions switch fully to your personal pattern."})

    return {
        "ready": True,
        "nextPeriod": {
            "likely": next_mid.isoformat(),
            "windowStart": window_start.isoformat(),
            "windowEnd": window_end.isoformat(),
            "daysUntil": days_to,
            "confidence": pred["confidence"],
            "personalized": pred["personalized"],
        },
        "cycleLength": {"predicted": round(pred["mid"], 1), "declared": declared_len},
        "ovulationDate": ovulation.isoformat(),
        "fertileDays": fertile,
        "predictedDays": predicted_days,
        "cycleDay": cycle_day if cycle_day >= 1 else None,
        "phase": bucket_now,
        "regularity": reg,
        "history": history_entries[-8:][::-1],  # newest first
        "cyclesKnown": len(lengths),
        "symptomForecast": forecast,
        "insights": insights[:4],
        "hasPcos": has_pcos,
        "irregularConditions": other_irregular,
        "pcosSignal": pcos_signal,
    }
