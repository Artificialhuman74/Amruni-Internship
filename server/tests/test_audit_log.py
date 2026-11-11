"""Append-only medical audit log and PHI-minimization tests."""
import atexit
import os
import secrets
import sqlite3
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
    os.environ["DB_PATH"] = str(Path(_TMP_DIR.name) / "test_audit_log.db")

from app import crypto, db as db_mod, main  # noqa: E402


class MedicalAuditLogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(main.app)

    def _create_patient(self, phone: str, name: str) -> tuple[int, int]:
        prev = os.environ.get("TEST_OTP_NUMBERS")
        os.environ["TEST_OTP_NUMBERS"] = f"{phone}:123456"
        try:
            self.assertEqual(self.client.post("/api/auth/request-otp", json={"phone": phone}).status_code, 200)
            res = self.client.post("/api/auth/verify-otp", json={"phone": phone, "code": "123456"})
            self.assertEqual(res.status_code, 200, res.text)
        finally:
            if prev is None:
                os.environ.pop("TEST_OTP_NUMBERS", None)
            else:
                os.environ["TEST_OTP_NUMBERS"] = prev

        with db_mod.get_db() as db:
            row = db.execute("SELECT id FROM users WHERE phone_bidx = ?", (crypto.blind_index(phone),)).fetchone()
            self.assertIsNotNone(row)
            user_id = row["id"]
            db.execute("UPDATE users SET name = ? WHERE id = ?", (crypto.enc(name), user_id))
            cur = db.execute(
                """INSERT INTO documents (user_id, doctor_id, title, kind, data, uploaded_by)
                   VALUES (?, NULL, ?, 'report', ?, 'patient')""",
                (user_id, crypto.enc("Patient Secret Report"), crypto.enc("data:text/plain;base64,UEhJ")),
            )
            return user_id, cur.lastrowid

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

    def _insert_appt(self, doctor_id: int, user_id: int, status: str) -> str:
        appt_id = f"appt_{secrets.token_hex(6)}"
        with db_mod.get_db() as db:
            db.execute(
                """INSERT INTO appointments (id, user_id, doctor_id, date, time, consult_mode, amount_inr, status, anonymous)
                   VALUES (?, ?, ?, '2026-12-01', '10:00', 'video', 500, ?, 0)""",
                (appt_id, user_id, doctor_id, status),
            )
        return appt_id

    def test_triggers_block_update_and_delete(self):
        doc_id, doc_headers = self._create_doctor("+919900005001", "Dr. Trigger")
        patient_id, _ = self._create_patient("+919900005011", "Trigger Patient")
        self._insert_appt(doc_id, patient_id, "confirmed")

        self.assertEqual(self.client.get(f"/api/doctor/patients/{patient_id}/chart", headers=doc_headers).status_code, 200)

        with db_mod.get_db() as db:
            count_before = db.execute("SELECT COUNT(*) AS n FROM medical_audit_logs").fetchone()["n"]
            self.assertGreaterEqual(count_before, 1)
            target = db.execute(
                "SELECT id, outcome FROM medical_audit_logs WHERE actor_id = ? ORDER BY created_at DESC LIMIT 1",
                (doc_id,),
            ).fetchone()
            self.assertIsNotNone(target)

            with self.assertRaises(sqlite3.DatabaseError):
                db.execute("UPDATE medical_audit_logs SET outcome = 'tampered' WHERE id = ?", (target["id"],))
            with self.assertRaises(sqlite3.DatabaseError):
                db.execute("DELETE FROM medical_audit_logs WHERE id = ?", (target["id"],))

            after = db.execute("SELECT outcome FROM medical_audit_logs WHERE id = ?", (target["id"],)).fetchone()
            self.assertEqual(after["outcome"], target["outcome"])

    def test_logs_chart_document_record_granted_and_denied_without_phi(self):
        doc_a_id, doc_a_headers = self._create_doctor("+919900005002", "Dr. Audit A")
        doc_b_id, doc_b_headers = self._create_doctor("+919900005003", "Dr. Audit B")
        patient_id, patient_doc_id = self._create_patient("+919900005012", "Audit Sensitive Name")

        appt_conf = self._insert_appt(doc_a_id, patient_id, "confirmed")
        appt_canc = self._insert_appt(doc_a_id, patient_id, "cancelled")

        phi_markers = (
            "Audit Sensitive Name",
            "+919900005012",
            "UNIQUE_PHI_ALLERGY_LATEX",
            "UNIQUE_PHI_DOC_TITLE_SCAN",
            "UNIQUE_PHI_DIAGNOSIS_PCOS",
            "UNIQUE_PHI_NOTES_CONFIDENTIAL",
            "Patient Secret Report",
        )

        # Granted flow for Doctor A
        self.assertEqual(self.client.get(f"/api/doctor/patients/{patient_id}/chart", headers=doc_a_headers).status_code, 200)
        self.assertEqual(
            self.client.put(
                f"/api/doctor/patients/{patient_id}/chart",
                json={"allergies": ["UNIQUE_PHI_ALLERGY_LATEX"], "conditions": ["PCOS"]},
                headers=doc_a_headers,
            ).status_code,
            200,
        )
        r_up = self.client.post(
            f"/api/doctor/patients/{patient_id}/documents",
            json={"title": "UNIQUE_PHI_DOC_TITLE_SCAN", "kind": "scan", "data": "data:text/plain;base64,U0NBTg=="},
            headers=doc_a_headers,
        )
        self.assertEqual(r_up.status_code, 201, r_up.text)
        doc_uploaded_id = str(r_up.json()["id"])

        self.assertEqual(
            self.client.get(f"/api/doctor/patients/{patient_id}/documents/{doc_uploaded_id}", headers=doc_a_headers).status_code,
            200,
        )
        self.assertEqual(
            self.client.delete(f"/api/doctor/patients/{patient_id}/documents/{doc_uploaded_id}", headers=doc_a_headers).status_code,
            200,
        )
        self.assertEqual(
            self.client.get(f"/api/doctor/appointments/{appt_conf}/record", headers=doc_a_headers).status_code,
            200,
        )
        self.assertEqual(
            self.client.put(
                f"/api/doctor/appointments/{appt_conf}/record",
                json={"diagnosis": "UNIQUE_PHI_DIAGNOSIS_PCOS", "notes": "UNIQUE_PHI_NOTES_CONFIDENTIAL", "prescription": []},
                headers=doc_a_headers,
            ).status_code,
            200,
        )

        # Denied flow for unrelated Doctor B + Doctor A unauthorized targets
        self.assertEqual(self.client.get(f"/api/doctor/patients/{patient_id}/chart", headers=doc_b_headers).status_code, 404)
        self.assertEqual(
            self.client.put(f"/api/doctor/patients/{patient_id}/chart", json={"allergies": []}, headers=doc_b_headers).status_code,
            404,
        )
        self.assertEqual(
            self.client.post(
                f"/api/doctor/patients/{patient_id}/documents",
                json={"title": "Bad", "kind": "report", "data": "data:text/plain;base64,QQ=="},
                headers=doc_b_headers,
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.get(f"/api/doctor/patients/{patient_id}/documents/{patient_doc_id}", headers=doc_b_headers).status_code,
            404,
        )
        self.assertEqual(
            self.client.delete(f"/api/doctor/patients/{patient_id}/documents/{patient_doc_id}", headers=doc_b_headers).status_code,
            404,
        )
        self.assertEqual(self.client.get(f"/api/doctor/appointments/{appt_conf}/record", headers=doc_b_headers).status_code, 404)
        self.assertEqual(
            self.client.put(f"/api/doctor/appointments/{appt_conf}/record", json={"notes": "Nope"}, headers=doc_b_headers).status_code,
            404,
        )
        self.assertEqual(self.client.get(f"/api/doctor/appointments/{appt_canc}/record", headers=doc_a_headers).status_code, 404)
        self.assertEqual(
            self.client.delete(f"/api/doctor/patients/{patient_id}/documents/{patient_doc_id}", headers=doc_a_headers).status_code,
            404,
        )

        with db_mod.get_db() as db:
            rows = db.execute(
                "SELECT * FROM medical_audit_logs WHERE actor_id IN (?, ?) ORDER BY id",
                (doc_a_id, doc_b_id),
            ).fetchall()

        tuples = {(r["actor_id"], r["resource_type"], r["action"], r["outcome"], r["status_code"]) for r in rows}
        expected = {
            (doc_a_id, "chart", "view", "granted", 200),
            (doc_a_id, "chart", "update", "granted", 200),
            (doc_a_id, "document", "upload", "granted", 201),
            (doc_a_id, "document", "view", "granted", 200),
            (doc_a_id, "document", "delete", "granted", 200),
            (doc_a_id, "record", "view", "granted", 200),
            (doc_a_id, "record", "update", "granted", 200),
            (doc_b_id, "chart", "view", "denied", 404),
            (doc_b_id, "chart", "update", "denied", 404),
            (doc_b_id, "document", "upload", "denied", 404),
            (doc_b_id, "document", "view", "denied", 404),
            (doc_b_id, "document", "delete", "denied", 404),
            (doc_b_id, "record", "view", "denied", 404),
            (doc_b_id, "record", "update", "denied", 404),
            (doc_a_id, "record", "view", "denied", 404),
            (doc_a_id, "document", "delete", "denied", 404),
        }
        self.assertTrue(expected.issubset(tuples), f"Missing audit events: {expected - tuples}")

        # Verify zero PHI content leaks into any column of medical_audit_logs
        serialized = " ".join(str(dict(r)) for r in rows)
        for marker in phi_markers:
            self.assertNotIn(marker, serialized)


if __name__ == "__main__":
    unittest.main()
