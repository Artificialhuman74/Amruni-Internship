"""Cycle intelligence: learned period predictions and symptom forecasting.

The length model trains on the **FedCycle dataset** (Fehring et al.) — 1,665
real charted cycles from 159 women — turned into autoregressive training rows
(each cycle predicted from the woman's preceding cycles). Because FedCycle's
ages span only 21–43, the real rows are augmented with a synthetic cohort that
covers the adolescent and perimenopausal tails, where cycles are longer and far
more variable. Three quantile gradient-boosting models give an honest
prediction window (p15 / p50 / p85) instead of a single guess, and inference
personalizes with each user's own logged periods.

Falls back to synthetic-only if the dataset file is absent, so deployments
without the .sav still work. The trained model is cached at
data/cycle_model.joblib; delete it to retrain.
"""
import os
from pathlib import Path

import joblib
import numpy as np

_DATA_DIR = Path(os.environ.get("DB_PATH", Path(__file__).resolve().parent.parent / "data" / "amruni.db")).parent
MODEL_PATH = _DATA_DIR / "cycle_model.joblib"

# FedCycle .sav. Looks in server/datasets/ first so the server directory is
# self-contained for deployment (Railway root = server/), then falls back to
# the repo-root folder for local development. Override with FEDCYCLE_PATH.
_SERVER_DIR = Path(__file__).resolve().parent.parent
_FEDCYCLE_NAME = "FedCycleData071012__2_.sav"


def _find_dataset(env_var: str, name: str) -> Path:
    override = os.environ.get(env_var)
    if override:
        return Path(override)
    for candidate in (
        _SERVER_DIR / "datasets" / name,
        _SERVER_DIR.parent / "cycle tracking datasets" / name,
    ):
        if candidate.exists():
            return candidate
    return _SERVER_DIR / "datasets" / name  # nonexistent → graceful fallback


FEDCYCLE_PATH = _find_dataset("FEDCYCLE_PATH", _FEDCYCLE_NAME)

FEATURES = ["last_len", "prev_len", "mean_recent", "std_recent", "n_cycles", "age"]
QUANTILES = {"lo": 0.15, "mid": 0.5, "hi": 0.85}
MIN_LEN, MAX_LEN = 17, 70

_models = None


def _rows_from_sequence(lengths, age):
    """Autoregressive rows: predict each cycle from the 1-3 preceding ones."""
    rows, targets = [], []
    for i in range(2, len(lengths)):
        recent = lengths[max(0, i - 3):i]
        rows.append([
            lengths[i - 1], lengths[i - 2],
            float(np.mean(recent)), float(np.std(recent)), i, age,
        ])
        targets.append(lengths[i])
    return rows, targets


def load_fedcycle():
    """Real cycle sequences from FedCycle → (features, next_length) rows.

    Returns (None, None) if the dataset or its reader isn't available.
    """
    if not FEDCYCLE_PATH.exists():
        return None, None
    try:
        import pandas as pd
        import pyreadstat  # noqa: F401
    except ImportError:
        return None, None

    import pandas as pd
    df, _ = __import__("pyreadstat").read_sav(str(FEDCYCLE_PATH))
    df = df.copy()
    df["loc"] = pd.to_numeric(df["LengthofCycle"], errors="coerce")
    df["age"] = pd.to_numeric(df["Age"], errors="coerce")
    df["cyclenum"] = pd.to_numeric(df["CycleNumber"], errors="coerce")

    rows, targets = [], []
    for _, g in df.groupby("ClientID"):
        g = g.sort_values("cyclenum")
        lengths = [float(x) for x in g["loc"] if MIN_LEN <= (x if x == x else -1) <= MAX_LEN]
        if len(lengths) < 3:
            continue
        # Age is a per-woman demographic; fill from any charted value, else 30.
        age_vals = g["age"].dropna()
        age = float(age_vals.iloc[0]) if len(age_vals) else 30.0
        r, t = _rows_from_sequence(lengths, age)
        rows.extend(r)
        targets.extend(t)
    if not rows:
        return None, None
    return np.array(rows), np.array(targets)


# ---------- synthetic cohort ----------

def _age_profile(rng):
    """Sample an age and its cycle-length statistics.

    Grounded in the clinical picture: adolescents run longer and more
    variable; 20s–30s settle around 28–29 ± 2–4; perimenopause (40+) gets
    shorter on average but far more erratic, with more anovulatory spikes.
    """
    age = int(rng.integers(13, 52))
    if age < 20:
        return age, rng.normal(30.5, 2.2), abs(rng.normal(3.6, 1.2)) + 1.2, 0.05
    if age < 40:
        return age, rng.normal(28.6, 1.8), abs(rng.normal(2.2, 0.9)) + 0.7, 0.02
    return age, rng.normal(27.2, 2.6), abs(rng.normal(4.2, 1.6)) + 1.5, 0.07


def generate_cohort(n_users=4000, seed=7, tails_only=False):
    """Simulate per-user cycle sequences and emit (features, next_length) rows.

    tails_only restricts sampled ages to <20 and >43 — the bands FedCycle's
    21–43 range doesn't cover — so synthetic data augments rather than dilutes
    the real signal.
    """
    rng = np.random.default_rng(seed)
    rows, targets = [], []
    made = 0
    while made < n_users:
        age, base, sd, p_anovulatory = _age_profile(rng)
        if tails_only and 20 <= age <= 43:
            continue
        made += 1
        n = int(rng.integers(5, 16))
        rho = rng.uniform(0.25, 0.5)  # consecutive cycles correlate
        lengths = []
        prev_dev = 0.0
        for _ in range(n):
            dev = rho * prev_dev + rng.normal(0, sd)
            length = base + dev
            if rng.random() < p_anovulatory:
                length += rng.uniform(8, 22)  # skipped ovulation → long cycle
            length = float(np.clip(length, MIN_LEN, MAX_LEN))
            lengths.append(length)
            prev_dev = dev
        r, t = _rows_from_sequence(lengths, age)
        rows.extend(r)
        targets.extend(t)
    return np.array(rows), np.array(targets)


# ---------- training / loading ----------

def train(force=False):
    global _models
    if MODEL_PATH.exists() and not force:
        _models = joblib.load(MODEL_PATH)
        return _models

    from sklearn.ensemble import HistGradientBoostingRegressor

    real_X, real_y = load_fedcycle()
    if real_X is not None:
        # Real FedCycle rows are the backbone; synthetic covers only the
        # adolescent/perimenopausal age tails FedCycle lacks. Upweight real
        # rows so the ~4k synthetic tail rows don't outvote them.
        syn_X, syn_y = generate_cohort(tails_only=True)
        X = np.vstack([real_X, syn_X])
        y = np.concatenate([real_y, syn_y])
        weights = np.concatenate([np.full(len(real_X), 3.0), np.ones(len(syn_X))])
        source = f"{len(real_X):,} real (FedCycle) + {len(syn_X):,} synthetic-tail"
    else:
        X, y = generate_cohort(n_users=6000)
        weights = None
        source = f"{len(X):,} synthetic (FedCycle dataset not found)"

    models = {}
    for name, q in QUANTILES.items():
        m = HistGradientBoostingRegressor(
            loss="quantile", quantile=q,
            max_iter=140, max_depth=4, learning_rate=0.08, random_state=7,
        )
        m.fit(X, y, sample_weight=weights)
        models[name] = m
    models["meta"] = {"features": FEATURES, "trained_rows": len(X), "source": source}
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(models, MODEL_PATH)
    _models = models
    print(f"[ml] cycle model trained on {source} → {MODEL_PATH.name}")
    return models


def _get_models():
    global _models
    if _models is None:
        train()
    return _models


def predict_cycle_length(history: list[float], age: int | None, declared_length: int = 28) -> dict:
    """Predict the next cycle length with an uncertainty window.

    history: known cycle lengths in days, oldest → newest (may be empty).
    Cold start (<2 known cycles) leans on the declared length with the
    population's typical spread, honestly labelled low-confidence.
    """
    age = age if age and 10 <= age <= 60 else 30

    if len(history) < 2:
        base = float(declared_length or 28)
        return {
            "lo": base - 3.0, "mid": base, "hi": base + 4.0,
            "confidence": "low", "personalized": False,
        }

    recent = history[-3:]
    x = np.array([[
        history[-1],
        history[-2],
        float(np.mean(recent)),
        float(np.std(recent)),
        len(history),
        age,
    ]])
    models = _get_models()
    lo = float(models["lo"].predict(x)[0])
    mid = float(models["mid"].predict(x)[0])
    hi = float(models["hi"].predict(x)[0])
    lo, hi = min(lo, mid - 0.5), max(hi, mid + 0.5)

    spread = hi - lo
    confidence = "high" if (spread <= 6 and len(history) >= 3) else "medium"
    return {"lo": lo, "mid": mid, "hi": hi, "confidence": confidence, "personalized": True}


# ---------- symptom forecasting ----------

# Population priors: P(symptom on a day in this phase bucket). Smoothing
# anchor when a user has little logged history.
SYMPTOM_PRIORS = {
    "menstrual": {"cramps": 0.55, "fatigue": 0.40, "back_pain": 0.30, "headache": 0.20, "nausea": 0.10, "mood_swings": 0.25},
    "follicular": {"acne": 0.08, "headache": 0.08, "fatigue": 0.10},
    "ovulation": {"cramps": 0.12, "breast_tender": 0.15, "mood_swings": 0.10},
    "luteal": {"mood_swings": 0.40, "bloating": 0.38, "breast_tender": 0.30, "cravings": 0.35, "acne": 0.22, "anxiety": 0.20, "insomnia": 0.15, "fatigue": 0.25},
}
PRIOR_WEIGHT = 6  # pseudo-days of prior evidence


def phase_bucket(cycle_day: int, cycle_len: float, period_len: int) -> str:
    ovu = cycle_len - 14
    if cycle_day <= period_len:
        return "menstrual"
    if cycle_day <= ovu - 2:
        return "follicular"
    if cycle_day <= ovu + 1:
        return "ovulation"
    return "luteal"


def symptom_forecast(day_logs: dict, cycle_starts: list[str], cycle_len: float, period_len: int) -> dict:
    """P(symptom | phase bucket) blended: user's own logged frequencies with
    population priors. day_logs: {'YYYY-MM-DD': {'symptoms': [...]}}.

    Returns {bucket: [{'id', 'p'}]} sorted by probability, top 4 per bucket.
    """
    from datetime import date

    counts = {b: {} for b in SYMPTOM_PRIORS}
    days_in = {b: 0 for b in SYMPTOM_PRIORS}

    starts = sorted(date.fromisoformat(s) for s in cycle_starts)
    for day_str, data in day_logs.items():
        try:
            d = date.fromisoformat(day_str)
        except ValueError:
            continue
        anchor = max((s for s in starts if s <= d), default=None)
        if anchor is None:
            continue
        cycle_day = (d - anchor).days + 1
        if cycle_day > 60:
            continue
        bucket = phase_bucket(cycle_day, cycle_len, period_len)
        days_in[bucket] += 1
        for sym in data.get("symptoms", []):
            counts[bucket][sym] = counts[bucket].get(sym, 0) + 1

    out = {}
    for bucket, priors in SYMPTOM_PRIORS.items():
        seen = set(priors) | set(counts[bucket])
        scored = []
        for sym in seen:
            prior = priors.get(sym, 0.04)
            user_n = counts[bucket].get(sym, 0)
            p = (user_n + PRIOR_WEIGHT * prior) / (days_in[bucket] + PRIOR_WEIGHT)
            scored.append({"id": sym, "p": round(min(p, 0.95), 2), "fromYou": user_n > 0})
        scored.sort(key=lambda s: -s["p"])
        out[bucket] = [s for s in scored if s["p"] >= 0.15][:4]
    return out


# ---------- regularity ----------

def regularity(history: list[float]) -> dict:
    if len(history) < 2:
        return {"label": None, "sd": None}
    sd = float(np.std(history[-6:]))
    if sd < 2:
        label = "very regular"
    elif sd < 4:
        label = "regular"
    elif sd < 7:
        label = "somewhat irregular"
    else:
        label = "irregular"
    return {"label": label, "sd": round(sd, 1)}
