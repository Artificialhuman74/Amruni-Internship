"""Tests for OTP provider interface, hashing, 5-min TTL, attempt limit, cooldown, and per-phone/per-IP limits."""
import atexit
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

from fastapi.testclient import TestClient

_SERVER_DIR = Path(__file__).resolve().parent.parent
if str(_SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVER_DIR))

_TMP_DIR = None
if "app.db" not in sys.modules and "DB_PATH" not in os.environ:
    _TMP_DIR = tempfile.TemporaryDirectory()
    atexit.register(_TMP_DIR.cleanup)
    os.environ["DB_PATH"] = str(Path(_TMP_DIR.name) / "test_otp.db")

from app import auth, db as db_mod, main  # noqa: E402


class _RecordingProvider:
    def __init__(self):
        self.calls = []

    def send(self, phone: str, code: str, channel: str = "whatsapp") -> bool:
        self.calls.append((phone, code, channel))
        return True


class OtpHardeningTests(unittest.TestCase):
    def setUp(self):
        self.orig_provider = auth.get_otp_provider()

    def tearDown(self):
        auth.set_otp_provider(self.orig_provider)

    def test_provider_interface_delegation_and_prod_devcode_hidden(self):
        self.assertIsInstance(self.orig_provider, auth.ConsoleOtpProvider)
        self.assertTrue(auth.send_otp("+919800001098", "111222", provider=auth.ConsoleOtpProvider()))

        recorder = _RecordingProvider()
        auth.set_otp_provider(recorder)

        phone = "+919800001001"
        client = TestClient(main.app, client=("203.0.113.10", 50000))
        res = client.post("/api/auth/request-otp", json={"phone": phone})
        self.assertEqual(res.status_code, 200, res.text)
        code = res.json().get("devCode")
        self.assertIsNotNone(code)
        self.assertEqual(recorder.calls, [(phone, code, "whatsapp")])

        # In production (IS_PROD=True, EXPOSE_OTP=False), devCode is omitted while send_otp still runs.
        recorder.calls.clear()
        phone_prod = "+919800001002"
        with mock.patch.object(auth, "IS_PROD", True), mock.patch.object(auth, "EXPOSE_OTP", False):
            res_prod = client.post("/api/auth/request-otp", json={"phone": phone_prod})
        self.assertEqual(res_prod.status_code, 200, res_prod.text)
        self.assertNotIn("devCode", res_prod.json())
        self.assertEqual(len(recorder.calls), 1)
        self.assertEqual(recorder.calls[0][0], phone_prod)

        # Direct send_otp also supports an explicit provider override.
        direct_rec = _RecordingProvider()
        self.assertTrue(auth.send_otp("+919800001099", "654321", channel="whatsapp", provider=direct_rec))
        self.assertEqual(direct_rec.calls, [("+919800001099", "654321", "whatsapp")])

    def test_otp_hashed_at_rest_5min_ttl_and_attempt_limit_persists(self):
        recorder = _RecordingProvider()
        auth.set_otp_provider(recorder)
        self.assertEqual(auth.OTP_TTL, 300)
        self.assertEqual(auth.OTP_MAX_ATTEMPTS, 5)

        phone = "+919800001003"
        client = TestClient(main.app, client=("203.0.113.11", 50000))
        req = client.post("/api/auth/request-otp", json={"phone": phone})
        self.assertEqual(req.status_code, 200, req.text)
        real_code = req.json()["devCode"]

        with db_mod.get_db() as db:
            row = db.execute("SELECT * FROM otp_codes WHERE phone = ?", (phone,)).fetchone()
            self.assertIsNotNone(row)
            self.assertNotEqual(row["code_hash"], real_code)
            self.assertEqual(len(row["code_hash"]), 64)
            self.assertEqual(row["code_hash"], auth._hash_code(phone, real_code))

        wrong_code = "000000" if real_code != "000000" else "999999"
        # 5 wrong attempts must persist attempts increments across HTTP errors and lock out on attempt 6.
        for attempt in range(5):
            r = client.post("/api/auth/verify-otp", json={"phone": phone, "code": wrong_code})
            self.assertEqual(r.status_code, 401, f"attempt {attempt + 1}: {r.text}")

        with db_mod.get_db() as db:
            row = db.execute("SELECT attempts FROM otp_codes WHERE phone = ?", (phone,)).fetchone()
            self.assertIsNotNone(row)
            self.assertEqual(row["attempts"], 5)

        # Even providing the real code on attempt 6 is rejected with 429 and deletes the OTP row.
        locked = client.post("/api/auth/verify-otp", json={"phone": phone, "code": real_code})
        self.assertEqual(locked.status_code, 429, locked.text)
        with db_mod.get_db() as db:
            self.assertIsNone(db.execute("SELECT 1 FROM otp_codes WHERE phone = ?", (phone,)).fetchone())

        # Expired OTP (past 5 min) returns 401 and persists deletion of stale row.
        phone_exp = "+919800001004"
        req2 = client.post("/api/auth/request-otp", json={"phone": phone_exp})
        self.assertEqual(req2.status_code, 200)
        code2 = req2.json()["devCode"]
        with db_mod.get_db() as db:
            db.execute("UPDATE otp_codes SET expires_at = ? WHERE phone = ?", (time.time() - 1, phone_exp))

        expired = client.post("/api/auth/verify-otp", json={"phone": phone_exp, "code": code2})
        self.assertEqual(expired.status_code, 401, expired.text)
        with db_mod.get_db() as db:
            self.assertIsNone(db.execute("SELECT 1 FROM otp_codes WHERE phone = ?", (phone_exp,)).fetchone())

    def test_resend_cooldown_persistent_phone_limit_and_per_ip_limit(self):
        auth.set_otp_provider(_RecordingProvider())
        phone = "+919800001005"
        client_a = TestClient(main.app, client=("203.0.113.20", 50000))

        # 1st send succeeds; immediate resend violates 30s cooldown.
        r1 = client_a.post("/api/auth/request-otp", json={"phone": phone})
        self.assertEqual(r1.status_code, 200)
        r_cool = client_a.post("/api/auth/request-otp", json={"phone": phone})
        self.assertEqual(r_cool.status_code, 429)

        # Verify consuming or waiting past 5m does NOT wipe the per-phone hourly limit (OTP_MAX_SENDS = 8).
        v = client_a.post("/api/auth/verify-otp", json={"phone": phone, "code": r1.json()["devCode"]})
        self.assertEqual(v.status_code, 200)

        for idx in range(1, auth.OTP_MAX_SENDS):
            res = client_a.post("/api/auth/request-otp", json={"phone": phone})
            self.assertEqual(res.status_code, 200, f"send {idx + 1}: {res.text}")
            with db_mod.get_db() as db:
                db.execute("UPDATE otp_codes SET last_sent = ? WHERE phone = ?", (time.time() - 60, phone))

        over_phone = client_a.post("/api/auth/request-otp", json={"phone": phone})
        self.assertEqual(over_phone.status_code, 429, over_phone.text)

        # Per-IP limit blocks flooding across distinct phone numbers from the same IP,
        # allows a different IP, and resets when old events expire past 1 hour.
        client_b = TestClient(main.app, client=("203.0.113.21", 50000))
        client_c = TestClient(main.app, client=("203.0.113.22", 50000))
        with mock.patch.object(auth, "OTP_IP_MAX_SENDS", 3):
            for idx in range(3):
                r = client_b.post("/api/auth/request-otp", json={"phone": f"+91980000200{idx}"})
                self.assertEqual(r.status_code, 200, r.text)

            blocked = client_b.post("/api/auth/request-otp", json={"phone": "+919800002009"})
            self.assertEqual(blocked.status_code, 429, blocked.text)

            other_ip = client_c.post("/api/auth/request-otp", json={"phone": "+919800002010"})
            self.assertEqual(other_ip.status_code, 200, other_ip.text)

            with db_mod.get_db() as db:
                oldest = db.execute(
                    "SELECT id FROM otp_rate_limits WHERE scope = 'ip' AND rate_key = '203.0.113.21' ORDER BY created_at ASC LIMIT 1"
                ).fetchone()
                self.assertIsNotNone(oldest)
                db.execute(
                    "UPDATE otp_rate_limits SET created_at = ? WHERE id = ?",
                    (time.time() - auth.OTP_RATE_WINDOW - 60, oldest["id"]),
                )

            recovered = client_b.post("/api/auth/request-otp", json={"phone": "+919800002011"})
            self.assertEqual(recovered.status_code, 200, recovered.text)


if __name__ == "__main__":
    unittest.main()
