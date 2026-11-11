"""SQLite WAL, foreign-key enforcement, and 5-second busy_timeout tests."""
import atexit
import os
import sqlite3
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest import mock

_SERVER_DIR = Path(__file__).resolve().parent.parent
if str(_SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVER_DIR))

_TMP_DIR = None
if "app.db" not in sys.modules and "DB_PATH" not in os.environ:
    _TMP_DIR = tempfile.TemporaryDirectory()
    atexit.register(_TMP_DIR.cleanup)
    os.environ["DB_PATH"] = str(Path(_TMP_DIR.name) / "test_sqlite_tuning.db")

from app import crypto, db as db_mod, main  # noqa: E402


class SqliteTuningTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        _ = main.app

    def test_pragmas_configured_and_configurable(self):
        self.assertEqual(db_mod.BUSY_TIMEOUT_MS, 5000)
        with db_mod.get_db() as db:
            self.assertEqual(db.execute("PRAGMA journal_mode").fetchone()[0].lower(), "wal")
            self.assertEqual(db.execute("PRAGMA foreign_keys").fetchone()[0], 1)
            self.assertEqual(db.execute("PRAGMA busy_timeout").fetchone()[0], 5000)

        # Updating BUSY_TIMEOUT_MS drives both sqlite3 connect timeout and PRAGMA busy_timeout.
        with mock.patch.object(db_mod, "BUSY_TIMEOUT_MS", 4500):
            conn = db_mod.connect()
            try:
                self.assertEqual(conn.execute("PRAGMA busy_timeout").fetchone()[0], 4500)
            finally:
                conn.close()

    def test_foreign_keys_enforce_integrity_and_cascade(self):
        now = db_mod.utcnow_iso()
        with db_mod.get_db() as db:
            with self.assertRaises(sqlite3.IntegrityError) as ctx:
                db.execute(
                    "INSERT INTO mood_logs (id, user_id, date, scope, valence, word, logged_at) "
                    "VALUES (?, ?, '2026-11-11', 'day', 1, 'calm', ?)",
                    (db_mod.new_id("mood"), 99999999, now),
                )
            self.assertIn("FOREIGN KEY", str(ctx.exception).upper())

            phone = "+919900007001"
            cur = db.execute(
                "INSERT INTO users (phone, phone_bidx, name) VALUES (?, ?, ?)",
                (crypto.enc(phone), crypto.blind_index(phone), crypto.enc("FK User")),
            )
            uid = cur.lastrowid
            mid = db_mod.new_id("mood")
            db.execute(
                "INSERT INTO mood_logs (id, user_id, date, scope, valence, word, logged_at) "
                "VALUES (?, ?, '2026-11-11', 'day', 1, 'calm', ?)",
                (mid, uid, now),
            )
            db.execute("DELETE FROM users WHERE id = ?", (uid,))
            leftover = db.execute("SELECT 1 FROM mood_logs WHERE id = ?", (mid,)).fetchone()
            self.assertIsNone(leftover)

    def test_busy_timeout_waits_for_concurrent_writer_lock(self):
        lock_acquired = threading.Event()
        errors = []

        def hold_writer_lock():
            conn = db_mod.connect()
            try:
                conn.execute("BEGIN IMMEDIATE")
                lock_acquired.set()
                time.sleep(0.2)
                conn.commit()
            except Exception as exc:  # noqa: BLE001
                errors.append(exc)
            finally:
                conn.close()

        holder = threading.Thread(target=hold_writer_lock)
        holder.start()
        self.assertTrue(lock_acquired.wait(timeout=2.0))

        with db_mod.get_db() as db:
            db.execute(
                "INSERT OR REPLACE INTO otp_codes (phone, code_hash, expires_at, attempts, sent_count, last_sent) "
                "VALUES ('+919900007099', 'hash', 9999999999, 0, 1, 1)"
            )
            db.execute("DELETE FROM otp_codes WHERE phone = '+919900007099'")

        holder.join(timeout=2.0)
        self.assertEqual(errors, [])


if __name__ == "__main__":
    unittest.main()
