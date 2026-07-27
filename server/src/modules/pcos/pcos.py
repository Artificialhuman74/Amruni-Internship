"""PCOS risk screening — two models, both trained on the Kottarathil clinical
dataset (541 patients, PCOS_data_without_infertility.xlsx).

- full:  logistic regression on 10 self-reportable features (a questionnaire a
         woman can answer without blood tests or an ultrasound). CV AUC ~0.89.
- cycle: logistic regression on menstrual features the app already tracks
         (cycle regularity, cycle length, age, BMI, weight gain). CV AUC ~0.82.
         Powers the passive "your cycles suggest a check" signal on the tracker.

Output is always a risk BAND (low / moderate / high) plus the top contributing
factors — a screening aid that routes to a specialist, never a diagnosis.
Trained once at boot, cached at data/pcos_model.joblib. Falls back to a
transparent rule-based scorer if the dataset or sklearn is unavailable.
"""
import os
from pathlib import Path
import joblib
import numpy as np

from ...config.settings import DB_PATH
from ..ml.ml import _find_dataset

_DATA_DIR = Path(DB_PATH).parent
MODEL_PATH = _DATA_DIR / "pcos_model.joblib"

PCOS_XLSX = _find_dataset(os.environ.get("PCOS_XLSX_PATH"), "PCOS_data_without_infertility.xlsx")

FULL_FEATURES = [
    ("age", "Age (yrs)"),
    ("bmi", "BMI"),
    ("irregular", "Cycle(R/I)"),
    ("weightGain", "Weight gain(Y/N)"),
    ("hairGrowth", "hair growth(Y/N)"),
    ("skinDarkening", "Skin darkening (Y/N)"),
    ("pimples", "Pimples(Y/N)"),
    ("fastFood", "Fast food (Y/N)"),
    ("regExercise", "Reg.Exercise(Y/N)"),
]
CYCLE_FEATURES = [
    ("irregular", "Cycle(R/I)"),
    ("age", "Age (yrs)"),
    ("bmi", "BMI"),
    ("weightGain", "Weight gain(Y/N)"),
]

FACTOR_LABELS = {
    "irregular": "Irregular cycles",
    "weightGain": "Recent weight gain",
    "hairGrowth": "Excess hair growth",
    "skinDarkening": "Skin darkening",
    "pimples": "Persistent acne",
    "bmi": "Elevated BMI",
    "fastFood": "Frequent fast food",
    "regExercise": "Little regular exercise",
    "age": "Age",
}

_models = None


def _dataset_encode(df, feature_map):
    import pandas as pd

    out = {}
    for key, col in feature_map:
        s = pd.to_numeric(df[col], errors="coerce")
        if key == "irregular":
            s = (s >= 3).astype(float)
        out[key] = s
    X = pd.DataFrame(out)
    return X.fillna(X.median())


def train(force=False):
    global _models
    if MODEL_PATH.exists() and not force:
        _models = joblib.load(MODEL_PATH)
        return _models

    models = _train_from_dataset() or _rule_based_models()
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(models, MODEL_PATH)
    _models = models
    print(f"[pcos] risk model ready ({models['meta']['source']}) → {MODEL_PATH.name}")
    return models


def _train_from_dataset():
    if not PCOS_XLSX.exists():
        return None
    try:
        import pandas as pd
        from sklearn.linear_model import LogisticRegression
        from sklearn.preprocessing import StandardScaler
        from sklearn.pipeline import make_pipeline
        from sklearn.model_selection import cross_val_predict, StratifiedKFold
        from sklearn.metrics import roc_auc_score
    except ImportError:
        return None

    df = pd.read_excel(PCOS_XLSX, sheet_name="Full_new")
    df.columns = [c.strip() for c in df.columns]
    y = pd.to_numeric(df["PCOS (Y/N)"], errors="coerce")
    mask = y.notna()
    y = y[mask].astype(int).to_numpy()

    trained = {}
    metrics = {}
    for name, fmap in (("full", FULL_FEATURES), ("cycle", CYCLE_FEATURES)):
        X = _dataset_encode(df, fmap)[mask]
        pipe = make_pipeline(
            StandardScaler(),
            LogisticRegression(max_iter=2000, class_weight="balanced", C=0.5),
        )
        cv = StratifiedKFold(5, shuffle=True, random_state=0)
        proba = cross_val_predict(pipe, X, y, cv=cv, method="predict_proba")[:, 1]
        metrics[name] = round(float(roc_auc_score(y, proba)), 3)
        pipe.fit(X, y)
        trained[name] = pipe

    return {
        "full": trained["full"],
        "cycle": trained["cycle"],
        "meta": {"source": f"clinical dataset, {mask.sum()} patients", "auc": metrics, "prevalence": round(float(y.mean()), 3)},
    }


# ---------- rule-based fallback ----------

_RULE_WEIGHTS = {
    "irregular": 1.4, "weightGain": 0.7, "hairGrowth": 1.1,
    "skinDarkening": 0.9, "pimples": 0.5, "bmi": 0.08, "fastFood": 0.4, "regExercise": -0.5, "age": -0.02,
}


class _RuleModel:
    def __init__(self, features):
        self.features = features

    def predict_proba(self, X):
        import numpy as _np
        z = -2.0
        row = X.iloc[0] if hasattr(X, "iloc") else dict(zip([f[0] for f in self.features], X[0]))
        for key, _ in self.features:
            v = row[key] if hasattr(X, "iloc") else row[key]
            if key == "bmi":
                v = max(0, float(v) - 25)
            z += _RULE_WEIGHTS.get(key, 0) * float(v)
        p = 1 / (1 + _np.exp(-z))
        return _np.array([[1 - p, p]])


def _rule_based_models():
    return {
        "full": _RuleModel(FULL_FEATURES),
        "cycle": _RuleModel(CYCLE_FEATURES),
        "meta": {"source": "rule-based fallback (dataset unavailable)", "auc": {}, "prevalence": 0.33},
    }


def _get_models():
    global _models
    if _models is None:
        train()
    return _models


def _band(p):
    if p < 0.33:
        return "low"
    if p < 0.6:
        return "moderate"
    return "high"


def _top_factors(features_dict, feature_map, k=3):
    present = []
    for key, _ in feature_map:
        v = features_dict.get(key)
        if key == "irregular" and v:
            present.append(("irregular", 3.0))
        elif key == "hairGrowth" and v:
            present.append((key, 2.6))
        elif key == "skinDarkening" and v:
            present.append((key, 2.2))
        elif key == "weightGain" and v:
            present.append((key, 2.0))
        elif key == "pimples" and v:
            present.append((key, 1.4))
        elif key == "fastFood" and v:
            present.append((key, 1.0))
        elif key == "bmi" and v and float(v) >= 25:
            present.append((key, 1.8))
        elif key == "regExercise" and not v:
            present.append(("regExercise", 0.9))
    present.sort(key=lambda t: -t[1])
    return [FACTOR_LABELS[k] for k, _ in present[:k]]


def screen(features: dict, model: str = "full") -> dict:
    import pandas as pd

    models = _get_models()
    fmap = FULL_FEATURES if model == "full" else CYCLE_FEATURES
    row = {key: float(features.get(key, 0) or 0) for key, _ in fmap}
    X = pd.DataFrame([row])
    p = float(models[model].predict_proba(X)[0][1])
    return {
        "probability": round(p, 3),
        "band": _band(p),
        "topFactors": _top_factors(row, fmap),
        "model": model,
        "auc": models["meta"]["auc"].get(model),
    }
