"""IDOR regression tests for cross-user journal and mood references."""
import atexit
import os
import secrets
import sys
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

_SERVER_DIR = Path(__file__).resolve().parent.parent
if str(_SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVER_DIR))

_TMP_DIR = None
if "app.db" not in sys.modules and "DB_PATH" not in os.environ:
    _TMP_DIR = tempfile.TemporaryDirectory()
    atexit.register(_TMP_DIR.cleanup)
    os.environ["DB_PATH"] = str(Path(_TMP_DIR.name) / "test_journal_mood_idor.db")

from app import crypto, db as db_mod, main  # noqa: E402


class JournalMoodIDORTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(main.app)

    def _create_patient(self, phone: str, name: str) -> tuple[int, dict[str, str]]:
        prev = os.environ.get("TEST_OTP_NUMBERS")
        os.environ["TEST_OTP_NUMBERS"] = f"{phone}:123456"
        try:
            self.assertEqual(self.client.post("/api/auth/request-otp", json={"phone": phone}).status_code, 200)
            res = self.client.post("/api/auth/verify-otp", json={"phone": phone, "code": "123456"})
            self.assertEqual(res.status_code, 200, res.text)
            headers = {"Authorization": f"Bearer {res.json()['token']}"}
        finally:
            if prev is None:
                os.environ.pop("TEST_OTP_NUMBERS", None)
            else:
                os.environ["TEST_OTP_NUMBERS"] = prev

        with db_mod.get_db() as db:
            row = db.execute("SELECT id FROM users WHERE phone_bidx = ?", (crypto.blind_index(phone),)).fetchone()
            self.assertIsNotNone(row)
            db.execute("UPDATE users SET name = ? WHERE id = ?", (crypto.enc(name), row["id"]))
            return row["id"], headers

    def _create_doctor(self, phone: str, name: str) -> tuple[int, dict[str, str]]:
        with db_mod.get_db() as db:
            doctor_id = db.execute(
                "INSERT INTO doctors (name, specialty, phone, fee_inr) VALUES (?, 'gynecology', ?, 500)",
                (name, phone),
            ).lastrowid

        prev = os.environ.get("TEST_OTP_NUMBERS")
        os.environ["TEST_OTP_NUMBERS"] = f"{phone}:123456"
        try:
            self.assertEqual(self.client.post("/api/auth/request-otp", json={"phone": phone}).status_code, 200)
            res = self.client.post("/api/doctor/verify-otp", json={"phone": phone, "code": "123456"})
            self.assertEqual(res.status_code, 200, res.text)
            return doctor_id, {"Authorization": f"Bearer {res.json()['token']}"}
        finally:
            if prev is None:
                os.environ.pop("TEST_OTP_NUMBERS", None)
            else:
                os.environ["TEST_OTP_NUMBERS"] = prev

    def test_journal_blocks_cross_user_mood_log_id_and_legacy_read_leaks(self):
        _, headers_a = self._create_patient("+919900003001", "Patient A")
        user_b_id, headers_b = self._create_patient("+919900003002", "Patient B")
        doc_id, doc_headers = self._create_doctor("+919900003011", "Dr. Chart")

        mood_resp = self.client.post(
            "/api/mood",
            json={"date": "2026-11-10", "scope": "moment", "valence": -2, "word": "PrivatePanic"},
            headers=headers_a,
        )
        self.assertEqual(mood_resp.status_code, 201, mood_resp.text)
        mood_a_id = mood_resp.json()["id"]

        # Patient B cannot attach Patient A's moodLogId on create or update
        r_create = self.client.post(
            "/api/journal",
            json={"date": "2026-11-10", "text": "My note", "tags": [], "moodLogId": mood_a_id},
            headers=headers_b,
        )
        self.assertEqual(r_create.status_code, 404, r_create.text)

        own_entry_resp = self.client.post(
            "/api/journal",
            json={"date": "2026-11-10", "text": "Own entry", "tags": [], "bringToAppointment": True},
            headers=headers_b,
        )
        self.assertEqual(own_entry_resp.status_code, 201, own_entry_resp.text)
        entry_b_id = own_entry_resp.json()["id"]

        r_patch = self.client.patch(
            f"/api/journal/{entry_b_id}",
            json={"date": "2026-11-10", "text": "Tampered", "tags": [], "moodLogId": mood_a_id},
            headers=headers_b,
        )
        self.assertEqual(r_patch.status_code, 404, r_patch.text)

        # Defense in depth: even if a legacy DB row linked mood_a_id to Patient B's journal entry,
        # neither GET /api/journal nor GET /api/doctor/patients/{id}/chart decrypts Patient A's mood.
        appt_id = f"appt_{secrets.token_hex(6)}"
        with db_mod.get_db() as db:
            db.execute("UPDATE journal_entries SET mood_log_id = ? WHERE id = ?", (mood_a_id, entry_b_id))
            db.execute(
                """INSERT INTO appointments (id, user_id, doctor_id, date, time, consult_mode, amount_inr, status, anonymous)
                   VALUES (?, ?, ?, '2026-12-01', '10:00', 'video', 500, 'confirmed', 0)""",
                (appt_id, user_b_id, doc_id),
            )

        listed = self.client.get("/api/journal", headers=headers_b)
        self.assertEqual(listed.status_code, 200, listed.text)
        self.assertIsNone(listed.json()[0]["mood"])

        chart = self.client.get(f"/api/doctor/patients/{user_b_id}/chart", headers=doc_headers)
        self.assertEqual(chart.status_code, 200, chart.text)
        self.assertEqual(len(chart.json()["sharedJournal"]), 1)
        self.assertIsNone(chart.json()["sharedJournal"][0]["mood"])

        # Owner Patient A can still link and read her own moodLogId
        own_linked = self.client.post(
            "/api/journal",
            json={"date": "2026-11-10", "text": "Mine", "tags": [], "moodLogId": mood_a_id},
            headers=headers_a,
        )
        self.assertEqual(own_linked.status_code, 201, own_linked.text)
        self.assertEqual(own_linked.json()["mood"]["word"], "PrivatePanic")

    def test_mood_blocks_cross_user_journal_id_and_allows_owned(self):
        _, headers_a = self._create_patient("+919900003021", "Journal A")
        _, headers_b = self._create_patient("+919900003022", "Journal B")

        j_a = self.client.post(
            "/api/journal",
            json={"date": "2026-11-10", "text": "Patient A journal", "tags": []},
            headers=headers_a,
        )
        self.assertEqual(j_a.status_code, 201, j_a.text)
        journal_a_id = j_a.json()["id"]

        r_cross = self.client.post(
            "/api/mood",
            json={"date": "2026-11-10", "scope": "moment", "valence": 1, "word": "Calm", "journalId": journal_a_id},
            headers=headers_b,
        )
        self.assertEqual(r_cross.status_code, 404, r_cross.text)

        j_b = self.client.post(
            "/api/journal",
            json={"date": "2026-11-10", "text": "Patient B journal", "tags": []},
            headers=headers_b,
        )
        self.assertEqual(j_b.status_code, 201, j_b.text)
        journal_b_id = j_b.json()["id"]

        r_own = self.client.post(
            "/api/mood",
            json={"date": "2026-11-10", "scope": "moment", "valence": 2, "word": "Hopeful", "journalId": journal_b_id},
            headers=headers_b,
        )
        self.assertEqual(r_own.status_code, 201, r_own.text)
        self.assertEqual(r_own.json()["journalId"], journal_b_id)


if __name__ == "__main__":
    unittest.main()
