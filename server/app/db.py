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
  user_id                 INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_period_start       TEXT,
  due_date_override        TEXT,
  pre_pregnancy_weight_kg REAL,
  height_cm               REAL,
  trusted_contacts        TEXT NOT NULL DEFAULT '[]',
  weight_logs             TEXT NOT NULL DEFAULT '[]',
  kick_counts             TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS pregnancy_logs (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date     TEXT NOT NULL,
  mood     TEXT,
  valence  INTEGER,
  symptoms TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (user_id, date)
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

CREATE TABLE IF NOT EXISTS journal_entries (
  id                TEXT PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date              TEXT NOT NULL,
  text              TEXT NOT NULL,
  tags              TEXT NOT NULL DEFAULT '[]',
  shared_as_post_id TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_journal_user ON journal_entries(user_id, date);

-- State of Mind, modelled on the Apple Health split the check-in already
-- borrows its mechanic from: a `day` entry summarises the whole day (one per
-- date, upserted), while `moment` entries capture how she felt at a point in
-- time (unlimited). `pregnancy_logs.mood` is kept as a mirror of the day-scope
-- entry so the existing cycle/ML readers keep working unchanged.
CREATE TABLE IF NOT EXISTS mood_logs (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,                     -- YYYY-MM-DD, the user's local day
  logged_at  TEXT NOT NULL,                     -- full local ISO timestamp
  scope      TEXT NOT NULL DEFAULT 'moment',    -- moment | day
  valence    INTEGER NOT NULL,                  -- -3..3
  word       TEXT,
  factors    TEXT NOT NULL DEFAULT '[]',
  source     TEXT NOT NULL DEFAULT 'checkin',   -- checkin | journal | track
  journal_id TEXT REFERENCES journal_entries(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_mood_user_date ON mood_logs(user_id, date);
-- At most one day-scope entry per date; a re-log overwrites it (see routes_mood).
CREATE UNIQUE INDEX IF NOT EXISTS idx_mood_user_day
  ON mood_logs(user_id, date) WHERE scope = 'day';

-- Stable per-user anonymous handle for the community, e.g. "VioletHarbor192".
-- Allocated lazily on first community interaction, not at signup.
-- Medicines she is actually on, and whether she is actually taking them.
--
-- A prescription written into a consultation record used to be the end of the
-- line: she could read it inside that past appointment and nowhere else. These
-- two tables are what turn it into something that follows her — a list, a
-- schedule, and a record of what was taken.
--
-- `source` distinguishes a doctor's prescription from something she added
-- herself (an iron tablet, a supplement). Prescribed rows carry `record_id` so
-- a doctor editing the prescription updates her list instead of duplicating it.
CREATE TABLE IF NOT EXISTS medications (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  dose        TEXT,
  frequency   TEXT,                              -- as written: "twice daily"
  times       TEXT NOT NULL DEFAULT '[]',        -- ["08:00","20:00"] — the schedule
  started_on  TEXT,
  ends_on     TEXT,
  source      TEXT NOT NULL DEFAULT 'self',      -- prescription | self
  record_id   INTEGER REFERENCES consultation_records(id) ON DELETE SET NULL,
  doctor_name TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_meds_user ON medications(user_id, active);
-- One row per prescribed medicine per record, so re-saving a record updates.
CREATE UNIQUE INDEX IF NOT EXISTS idx_meds_from_record
  ON medications(user_id, record_id, name) WHERE record_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS medication_doses (
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medication_id TEXT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  date          TEXT NOT NULL,      -- YYYY-MM-DD, local
  slot          TEXT NOT NULL,      -- the scheduled "HH:MM" this satisfies
  taken_at      TEXT NOT NULL,
  PRIMARY KEY (user_id, medication_id, date, slot)
);
CREATE INDEX IF NOT EXISTS idx_doses_user_date ON medication_doses(user_id, date);

-- Emergency contacts and the alerts sent to them.
--
-- These lived in Firestore — the only feature in the product on a second
-- backend, and one whose keys were never set in production, so adding a
-- contact failed silently. The list the SOS button depends on is not somewhere
-- to have a second database and a second failure mode.
CREATE TABLE IF NOT EXISTS sos_contacts (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  relation   TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_sos_contacts_user ON sos_contacts(user_id);

CREATE TABLE IF NOT EXISTS sos_alerts (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message    TEXT NOT NULL,
  sent_to    TEXT NOT NULL DEFAULT '[]',
  is_test    INTEGER NOT NULL DEFAULT 0,
  timestamp  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_user ON sos_alerts(user_id, timestamp);

-- Care shares: a link a family member or caretaker can open.
--
-- The link carries an opaque random token, never the patient id. A URL with a
-- row id in it is enumerable — /care/1, /care/2 — which would turn a
-- convenience feature into a way to read strangers' medical records. The token
-- resolves to `user_id` server-side and the id is never rendered anywhere.
--
-- Every share is scoped, expiring and revocable, because the thing being
-- handed out is a key to someone's health record and none of those three are
-- optional for that.
CREATE TABLE IF NOT EXISTS care_shares (
  token        TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label        TEXT,                              -- "For my daughter"
  scopes       TEXT NOT NULL DEFAULT '[]',        -- ["appointments","medicines"]
  expires_at   TEXT,                              -- ISO; null = no expiry
  revoked      INTEGER NOT NULL DEFAULT 0,
  view_count   INTEGER NOT NULL DEFAULT 0,
  last_viewed  TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_care_shares_user ON care_shares(user_id);

-- The care ledger.
--
-- One chronological spine of everything anyone did to this health record —
-- the patient and any caretaker holding a link, in the same thread, visible to
-- both. That symmetry is the safety property: handing someone a key to your
-- health record is only reasonable if you can see every door they opened.
--
-- It doubles as her notification feed. Events with actor='caretaker' and no
-- read_at are what she has not yet been told about.
CREATE TABLE IF NOT EXISTS care_events (
  id           TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor        TEXT NOT NULL,                     -- patient | caretaker
  actor_label  TEXT,                              -- the share's label, e.g. "Priya"
  share_token  TEXT REFERENCES care_shares(token) ON DELETE SET NULL,
  kind         TEXT NOT NULL,                     -- booked | viewed | ...
  summary      TEXT NOT NULL,
  meta         TEXT NOT NULL DEFAULT '{}',
  read_at      TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_care_events_user ON care_events(user_id, created_at);

CREATE TABLE IF NOT EXISTS anon_handles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  handle  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS community_posts (
  id                TEXT PRIMARY KEY,
  author_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_anonymous      INTEGER NOT NULL DEFAULT 1,
  tags              TEXT NOT NULL DEFAULT '[]',
  type              TEXT NOT NULL DEFAULT 'text',   -- text | poll
  text              TEXT,
  poll_options      TEXT,                            -- JSON list of option labels; tallies are computed live from community_poll_votes
  reply_to_id       TEXT REFERENCES community_posts(id) ON DELETE CASCADE,
  like_count        INTEGER NOT NULL DEFAULT 0,
  reply_count       INTEGER NOT NULL DEFAULT 0,
  moderation_status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_posts_feed ON community_posts(reply_to_id, moderation_status, created_at);

CREATE TABLE IF NOT EXISTS community_likes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS community_poll_votes (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id      TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL,
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS community_reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id     TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS community_blocks (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, blocked_id)
);
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


def _migrate_pregnancy_state(db: sqlite3.Connection):
    """One-time migration for the pre-rebuild `pregnancy_state` schema
    (weeks_pregnant/due_date instead of last_period_start/due_date_override).
    `CREATE TABLE IF NOT EXISTS` never alters an existing table, so a database
    created before this rebuild needs its old table renamed out of the way
    before the new schema can be created, then its salvageable columns
    (due_date, trusted_contacts) copied across.
    """
    cols = {row["name"] for row in db.execute("PRAGMA table_info(pregnancy_state)").fetchall()}
    if not cols or "last_period_start" in cols:
        return  # fresh install, or already migrated
    db.execute("ALTER TABLE pregnancy_state RENAME TO pregnancy_state_legacy")


def _finish_pregnancy_state_migration(db: sqlite3.Connection):
    legacy = db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='pregnancy_state_legacy'"
    ).fetchone()
    if not legacy:
        return
    rows = db.execute("SELECT user_id, due_date, trusted_contacts FROM pregnancy_state_legacy").fetchall()
    for row in rows:
        db.execute(
            """INSERT INTO pregnancy_state (user_id, due_date_override, trusted_contacts)
               VALUES (?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET
                 due_date_override = excluded.due_date_override,
                 trusted_contacts = excluded.trusted_contacts""",
            (row["user_id"], row["due_date"], row["trusted_contacts"]),
        )
    db.execute("DROP TABLE pregnancy_state_legacy")


def _ensure_column(db: sqlite3.Connection, table: str, column: str, decl: str):
    """Adds a column to an existing table if it isn't there yet. `CREATE TABLE
    IF NOT EXISTS` never alters an already-created table, so new columns on a
    long-lived table (like `user_settings`) need this instead."""
    cols = {row["name"] for row in db.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in cols:
        db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {decl}")


def init_db():
    with get_db() as db:
        _migrate_pregnancy_state(db)
        db.executescript(SCHEMA)
        _finish_pregnancy_state_migration(db)
        _ensure_column(db, "user_settings", "identity_warning_seen", "INTEGER NOT NULL DEFAULT 0")
        # Journal entries gained a mood, an auto-captured body/cycle context and
        # a "bring this to my next appointment" flag after the table shipped.
        _ensure_column(db, "journal_entries", "mood_log_id", "TEXT")
        _ensure_column(db, "journal_entries", "context", "TEXT NOT NULL DEFAULT '{}'")
        _ensure_column(db, "journal_entries", "bring_to_appointment", "INTEGER NOT NULL DEFAULT 0")
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
