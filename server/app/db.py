"""SQLite layer: connection management, schema, and seed data.

Doctors publish priced availability slots; consumers book a slot, pay, and the
appointment is confirmed with a generated Google Meet link. Money is stored as
integer rupees (consultation fees don't need paise).
"""
import json
import os
import sqlite3
import secrets
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

DB_PATH = Path(os.environ.get("DB_PATH", Path(__file__).resolve().parent.parent / "data" / "amruni.db"))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  phone        TEXT NOT NULL UNIQUE,
  name         TEXT,
  dob          TEXT,
  life_stage   TEXT,
  is_onboarded INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS otp_codes (
  phone      TEXT PRIMARY KEY,
  code_hash  TEXT NOT NULL,
  expires_at REAL NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 1,
  last_sent  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS doctors (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  specialty   TEXT NOT NULL,
  exp         TEXT,
  fee_inr     INTEGER NOT NULL DEFAULT 500,
  chat_fee_inr INTEGER NOT NULL DEFAULT 150,
  phone       TEXT,
  lang        TEXT NOT NULL DEFAULT '[]',
  avatar      TEXT DEFAULT '🩺',
  photo       TEXT,
  bio         TEXT,
  rating      REAL NOT NULL DEFAULT 5.0,
  reviews     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS slots (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  doctor_id  INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,            -- YYYY-MM-DD
  start_time TEXT NOT NULL,            -- HH:MM, 24h
  end_time   TEXT NOT NULL,
  mode       TEXT NOT NULL DEFAULT 'video',
  price_inr  INTEGER NOT NULL,
  status     TEXT NOT NULL DEFAULT 'open',   -- open | locked | booked
  locked_at  REAL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(doctor_id, date, start_time, mode)
);
CREATE INDEX IF NOT EXISTS idx_slots_doctor_date ON slots(doctor_id, date);

CREATE TABLE IF NOT EXISTS appointments (
  id           TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id    INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  slot_id      INTEGER REFERENCES slots(id) ON DELETE SET NULL,
  date         TEXT,
  time         TEXT,                   -- display form, e.g. '4:00 PM' or 'Instant'
  reason       TEXT,
  consult_mode TEXT NOT NULL DEFAULT 'video',
  amount_inr   INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'pending_payment',
               -- pending_payment | confirmed | completed | cancelled
  meet_link    TEXT,
  meet_event_id TEXT,
  meet_provider TEXT,                  -- 'google' | 'dev'
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_appointments_user ON appointments(user_id);

CREATE TABLE IF NOT EXISTS payments (
  id             TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL,
  order_id       TEXT NOT NULL,
  amount_inr     INTEGER NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'INR',
  status         TEXT NOT NULL DEFAULT 'created',  -- created | paid | failed | refunded
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  paid_at        TEXT
);

CREATE TABLE IF NOT EXISTS cycle_state (
  user_id           INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_period_start TEXT,
  cycle_length      INTEGER NOT NULL DEFAULT 28,
  period_length     INTEGER NOT NULL DEFAULT 5
);

CREATE TABLE IF NOT EXISTS cycle_logs (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date     TEXT NOT NULL,
  flow     TEXT,
  symptoms TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS pregnancy_state (
  user_id          INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  weeks_pregnant   INTEGER NOT NULL DEFAULT 16,
  due_date         TEXT,
  trusted_contacts TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notifications  INTEGER NOT NULL DEFAULT 1,
  anonymous_mode INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS consultation_records (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id TEXT NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  doctor_id      INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  diagnosis      TEXT,
  notes          TEXT,
  vitals         TEXT NOT NULL DEFAULT '{}',   -- {bp, pulse, temp, weight}
  prescription   TEXT NOT NULL DEFAULT '[]',   -- [{name, dose, frequency, duration}]
  follow_up      TEXT,                          -- YYYY-MM-DD
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_records_user ON consultation_records(user_id);
CREATE INDEX IF NOT EXISTS idx_records_doctor ON consultation_records(doctor_id);

CREATE TABLE IF NOT EXISTS patient_charts (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  allergies   TEXT NOT NULL DEFAULT '[]',
  conditions  TEXT NOT NULL DEFAULT '[]',
  blood_group TEXT,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id  INTEGER REFERENCES doctors(id) ON DELETE SET NULL,
  title      TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'report',   -- lab | report | scan | other
  data       TEXT NOT NULL,                     -- data URL
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);

CREATE TABLE IF NOT EXISTS screenings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool       TEXT NOT NULL,
  score      INTEGER NOT NULL,
  answers    TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_screenings_user ON screenings(user_id);
"""

SEED_DOCTORS = [
    dict(name="Dr. Ananya Sharma", specialty="Gynaecology", exp="14 yrs exp", fee=600, phone="9876543210", lang=["English", "Hindi"], photo="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300&h=300", rating=4.9, reviews=142),
    dict(name="Dr. Sarah D'Souza", specialty="Gynaecology", exp="10 yrs exp", fee=500, phone="9876543211", lang=["English", "Hindi", "Konkani"], photo="https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&q=80&w=300&h=300", rating=4.8, reviews=98),
    dict(name="Dr. Priya Nair", specialty="Fertility", exp="15 yrs exp", fee=800, phone="9876543212", lang=["English", "Malayalam", "Tamil"], photo="https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=300&h=300", rating=4.9, reviews=184),
    dict(name="Dr. Vikram Malhotra", specialty="Fertility", exp="18 yrs exp", fee=900, phone="9876543213", lang=["English", "Hindi", "Punjabi"], photo="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=300&h=300", rating=4.7, reviews=120),
    dict(name="Dr. Shalini Sen", specialty="Mental Health", exp="8 yrs exp", fee=400, phone="9876543214", lang=["English", "Bengali"], photo="https://images.unsplash.com/photo-1651008011680-7798363717df?auto=format&fit=crop&q=80&w=300&h=300", rating=4.8, reviews=75),
    dict(name="Dr. Amit Patel", specialty="Mental Health", exp="12 yrs exp", fee=450, phone="9876543215", lang=["English", "Gujarati", "Hindi"], photo="https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=300&h=300", rating=4.6, reviews=110),
    dict(name="Dr. Meera Krishnan", specialty="Pregnancy", exp="11 yrs exp", fee=700, phone="9876543216", lang=["English", "Kannada", "Hindi"], photo="https://images.unsplash.com/photo-1527613426441-4da17471b66d?auto=format&fit=crop&q=80&w=300&h=300", rating=4.9, reviews=156),
    dict(name="Dr. Sneha Reddy", specialty="Pregnancy", exp="9 yrs exp", fee=550, phone="9876543217", lang=["English", "Telugu"], photo="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300&h=300", rating=4.8, reviews=84),
    dict(name="Dr. Rita Sen", specialty="Menopause", exp="20 yrs exp", fee=750, phone="9876543218", lang=["English", "Hindi", "Bengali"], photo="https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=300&h=300", rating=4.9, reviews=210),
    dict(name="Dr. Clara Oswald", specialty="Menopause", exp="16 yrs exp", fee=650, phone="9876543219", lang=["English", "French"], photo="https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&q=80&w=300&h=300", rating=4.7, reviews=132),
    dict(name="Dr. Hitesh Shah", specialty="Homeopathy", exp="12 yrs exp", fee=350, phone="9876543220", lang=["English", "Hindi", "Gujarati"], photo="https://images.unsplash.com/photo-1622902046580-2b47f47fdb47?auto=format&fit=crop&q=80&w=300&h=300", rating=4.8, reviews=115),
    dict(name="Dr. Neeta Rao", specialty="Homeopathy", exp="10 yrs exp", fee=300, phone="9876543221", lang=["English", "Hindi", "Marathi"], photo="https://images.unsplash.com/photo-1591604021695-0c69b7c05981?auto=format&fit=crop&q=80&w=300&h=300", rating=4.6, reviews=89),
]

# Default consulting-hour template used to seed demo availability. In real use
# doctors manage their own slots through the admin portal / slots API.
SEED_HOURS = ["10:00", "10:30", "11:00", "11:30", "12:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"]
SEED_DAYS_AHEAD = 7
SLOT_MINUTES = 30


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_db():
    conn = connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_db() as db:
        db.executescript(SCHEMA)
        if db.execute("SELECT COUNT(*) AS n FROM doctors").fetchone()["n"] == 0:
            for d in SEED_DOCTORS:
                db.execute(
                    """INSERT INTO doctors (name, specialty, exp, fee_inr, chat_fee_inr, phone, lang, photo, rating, reviews)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (d["name"], d["specialty"], d["exp"], d["fee"], round(d["fee"] / 3),
                     d["phone"], json.dumps(d["lang"]), d["photo"], d["rating"], d["reviews"]),
                )
        seed_slots(db)


def seed_slots(db: sqlite3.Connection):
    """Ensure every doctor has demo availability for the coming week.

    Idempotent: only fills days where the doctor has no slots at all, and skips
    a couple of pseudo-random hours per day so calendars look realistic.
    """
    doctors = db.execute("SELECT id, fee_inr FROM doctors").fetchall()
    today = date.today()
    for doc in doctors:
        for offset in range(SEED_DAYS_AHEAD):
            day = today + timedelta(days=offset)
            day_str = day.isoformat()
            existing = db.execute(
                "SELECT COUNT(*) AS n FROM slots WHERE doctor_id = ? AND date = ?",
                (doc["id"], day_str),
            ).fetchone()["n"]
            if existing:
                continue
            for i, start in enumerate(SEED_HOURS):
                # Deterministic pseudo-random gaps: ~2 of 11 hours "busy".
                if (doc["id"] * 7 + day.toordinal() + i) % 5 == 0:
                    continue
                if offset == 0 and start <= datetime.now().strftime("%H:%M"):
                    continue  # never seed slots already in the past
                h, m = map(int, start.split(":"))
                end_dt = datetime(2000, 1, 1, h, m) + timedelta(minutes=SLOT_MINUTES)
                db.execute(
                    """INSERT OR IGNORE INTO slots (doctor_id, date, start_time, end_time, mode, price_inr)
                       VALUES (?, ?, ?, ?, 'video', ?)""",
                    (doc["id"], day_str, start, end_dt.strftime("%H:%M"), doc["fee_inr"]),
                )


# ---------- serializers ----------

def to_12h(hhmm: str) -> str:
    h, m = map(int, hhmm.split(":"))
    suffix = "AM" if h < 12 else "PM"
    h12 = h % 12 or 12
    return f"{h12}:{m:02d} {suffix}"


def doctor_json(row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "specialty": row["specialty"],
        "exp": row["exp"],
        "fee": f"₹{row['fee_inr']}",          # legacy display string used across the UI
        "videoFee": row["fee_inr"],
        "chatFee": row["chat_fee_inr"],
        "phone": row["phone"],
        "lang": json.loads(row["lang"] or "[]"),
        "avatar": row["avatar"] or "🩺",
        "photo": row["photo"],
        "bio": row["bio"],
        "rating": row["rating"],
        "reviews": row["reviews"],
    }


def slot_json(row) -> dict:
    return {
        "id": row["id"],
        "doctorId": row["doctor_id"],
        "date": row["date"],
        "start": row["start_time"],
        "end": row["end_time"],
        "time": to_12h(row["start_time"]),
        "mode": row["mode"],
        "price": row["price_inr"],
        "status": row["status"],
    }


def appointment_json(row) -> dict:
    return {
        "appointmentId": row["id"],
        "doctorId": row["doctor_id"],
        "slotId": row["slot_id"],
        "date": row["date"],
        "time": row["time"],
        "reason": row["reason"],
        "consultMode": row["consult_mode"],
        "amount": row["amount_inr"],
        "fee": f"₹{row['amount_inr']}" if row["amount_inr"] else "",
        "status": row["status"],
        "meetLink": row["meet_link"],
        "meetProvider": row["meet_provider"],
        "createdAt": row["created_at"],
    }


def payment_json(row) -> dict:
    return {
        "paymentId": row["id"],
        "appointmentId": row["appointment_id"],
        "provider": row["provider"],
        "orderId": row["order_id"],
        "amount": row["amount_inr"],
        "currency": row["currency"],
        "status": row["status"],
    }


def record_json(row) -> dict:
    return {
        "id": row["id"],
        "appointmentId": row["appointment_id"],
        "doctorId": row["doctor_id"],
        "diagnosis": row["diagnosis"],
        "notes": row["notes"],
        "vitals": json.loads(row["vitals"] or "{}"),
        "prescription": json.loads(row["prescription"] or "[]"),
        "followUp": row["follow_up"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def document_json(row, include_data=False) -> dict:
    out = {
        "id": row["id"],
        "title": row["title"],
        "kind": row["kind"],
        "createdAt": row["created_at"],
    }
    if include_data:
        out["data"] = row["data"]
    return out


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(6)}"


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
