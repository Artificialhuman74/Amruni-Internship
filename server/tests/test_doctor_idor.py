"""IDOR regression tests for practitioner patient-relationship enforcement."""
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
    os.environ["DB_PATH"] = str(Path(_TMP_DIR.name) / "test_doctor_idor.db")

from app import auth, crypto, db as db_mod, main  # noqa: E402


class DoctorRelationshipIDORTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(main.app)

    def _create_doctor_headers(self, phone: str, name: str) -> tuple[int, dict[str, str]]:
        with db_mod.get_db() as db:
            cur = db.execute(
                "INSERT INTO doctors (name, specialty, phone, fee_inr) VALUES (?, 'gynecology', ?, 500)",
                (name, phone),
            )
            doctor_id = cur.lastrowid

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

    def _create_patient(self, phone: str, name: str) -> tuple[int, int]:
        prev = os.environ.get("TEST_OTP_NUMBERS")
        os.environ["TEST_OTP_NUMBERS"] = f"{phone}:123456"
        try:
            self.assertEqual(self.client.post("/api/auth/request-otp", json={"phone": phone}).status_code, 200)
            res = self.client.post("/api/auth/verify-otp", json={"phone": phone, "code": "123456"})
            self.assertEqual(res.status_code, 200, res.text)
            user_id = auth.verify_otp_uid_for_test if hasattr(auth, "verify_otp_uid_for_test") else None
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
                "INSERT INTO documents (user_id, doctor_id, title, kind, data) VALUES (?, NULL, ?, 'report', ?)",
                (user_id, crypto.enc("Lab Report"), crypto.enc("data:text/plain;base64,SGVsbG8=")),
            )
            doc_id = cur.lastrowid
        return user_id, doc_id

    def _insert_appointment(self, doctor_id: int, user_id: int, status: str, anonymous: int = 0) -> str:
        appt_id = f"appt_{secrets.token_hex(6)}"
        with db_mod.get_db() as db:
            db.execute(
                """INSERT INTO appointments (id, user_id, doctor_id, date, time, consult_mode, amount_inr, status, anonymous)
                   VALUES (?, ?, ?, '2026-12-01', '10:00', 'video', 500, ?, ?)""",
                (appt_id, user_id, doctor_id, status, anonymous),
            )
        return appt_id

    def _assert_all_patient_routes_denied(self, doc_headers: dict[str, str], user_id: int, doc_id: int):
        r_get_chart = self.client.get(f"/api/doctor/patients/{user_id}/chart", headers=doc_headers)
        self.assertEqual(r_get_chart.status_code, 404, r_get_chart.text)

        r_put_chart = self.client.put(
            f"/api/doctor/patients/{user_id}/chart",
            json={"allergies": ["Peanuts"]},
            headers=doc_headers,
        )
        self.assertEqual(r_put_chart.status_code, 404, r_put_chart.text)

        r_post_doc = self.client.post(
            f"/api/doctor/patients/{user_id}/documents",
            json={"title": "Note", "kind": "report", "data": "data:text/plain;base64,QQ=="},
            headers=doc_headers,
        )
        self.assertEqual(r_post_doc.status_code, 404, r_post_doc.text)

        r_get_doc = self.client.get(f"/api/doctor/patients/{user_id}/documents/{doc_id}", headers=doc_headers)
        self.assertEqual(r_get_doc.status_code, 404, r_get_doc.text)

        r_del_doc = self.client.delete(f"/api/doctor/patients/{user_id}/documents/{doc_id}", headers=doc_headers)
        self.assertEqual(r_del_doc.status_code, 404, r_del_doc.text)

    def test_denies_no_appointment_cancelled_pending_and_anonymous(self):
        doc_a_id, doc_a_headers = self._create_doctor_headers("+919900001001", "Dr. A")
        doc_b_id, doc_b_headers = self._create_doctor_headers("+919900001002", "Dr. B")

        # Case 1: No appointment at all
        p_none_id, p_none_doc = self._create_patient("+919900002001", "No Appt")
        self._assert_all_patient_routes_denied(doc_a_headers, p_none_id, p_none_doc)

        # Case 2: Cancelled appointment only
        p_cancel_id, p_cancel_doc = self._create_patient("+919900002002", "Cancelled Appt")
        self._insert_appointment(doc_a_id, p_cancel_id, status="cancelled", anonymous=0)
        self._assert_all_patient_routes_denied(doc_a_headers, p_cancel_id, p_cancel_doc)

        # Case 3: Pending / unpaid appointments only
        p_pending_pay_id, p_pending_pay_doc = self._create_patient("+919900002003", "Pending Payment")
        self._insert_appointment(doc_a_id, p_pending_pay_id, status="pending_payment", anonymous=0)
        self._assert_all_patient_routes_denied(doc_a_headers, p_pending_pay_id, p_pending_pay_doc)

        p_pending_id, p_pending_doc = self._create_patient("+919900002004", "Pending Generic")
        self._insert_appointment(doc_a_id, p_pending_id, status="pending", anonymous=0)
        self._assert_all_patient_routes_denied(doc_a_headers, p_pending_id, p_pending_doc)

        # Case 4: Confirmed or completed anonymous appointments
        p_anon_id, p_anon_doc = self._create_patient("+919900002005", "Anonymous Patient")
        self._insert_appointment(doc_a_id, p_anon_id, status="confirmed", anonymous=1)
        self._insert_appointment(doc_a_id, p_anon_id, status="completed", anonymous=1)
        self._assert_all_patient_routes_denied(doc_a_headers, p_anon_id, p_anon_doc)

        # Doctor B also has no relationship to any of these patients
        self.assertNotEqual(doc_a_id, doc_b_id)
        self._assert_all_patient_routes_denied(doc_b_headers, p_none_id, p_none_doc)

    def test_allows_confirmed_or_completed_non_anonymous_and_blocks_other_doctor(self):
        doc_a_id, doc_a_headers = self._create_doctor_headers("+919900001011", "Dr. Allowed")
        _, doc_b_headers = self._create_doctor_headers("+919900001012", "Dr. Other")

        # Confirmed, non-anonymous appointment grants access to Doctor A only
        p_conf_id, p_conf_doc = self._create_patient("+919900002011", "Confirmed Patient")
        self._insert_appointment(doc_a_id, p_conf_id, status="confirmed", anonymous=0)

        chart_resp = self.client.get(f"/api/doctor/patients/{p_conf_id}/chart", headers=doc_a_headers)
        self.assertEqual(chart_resp.status_code, 200, chart_resp.text)
        self.assertEqual(chart_resp.json()["patient"]["name"], "Confirmed Patient")

        upd_resp = self.client.put(
            f"/api/doctor/patients/{p_conf_id}/chart",
            json={"allergies": ["Latex"], "conditions": ["PCOS"]},
            headers=doc_a_headers,
        )
        self.assertEqual(upd_resp.status_code, 200, upd_resp.text)

        post_doc_resp = self.client.post(
            f"/api/doctor/patients/{p_conf_id}/documents",
            json={"title": "Follow-up Scan", "kind": "scan", "data": "data:text/plain;base64,U2Nhbg=="},
            headers=doc_a_headers,
        )
        self.assertEqual(post_doc_resp.status_code, 201, post_doc_resp.text)
        created_doc_id = post_doc_resp.json()["id"]

        get_doc_resp = self.client.get(
            f"/api/doctor/patients/{p_conf_id}/documents/{created_doc_id}",
            headers=doc_a_headers,
        )
        self.assertEqual(get_doc_resp.status_code, 200, get_doc_resp.text)

        del_doc_resp = self.client.delete(
            f"/api/doctor/patients/{p_conf_id}/documents/{created_doc_id}",
            headers=doc_a_headers,
        )
        self.assertEqual(del_doc_resp.status_code, 200, del_doc_resp.text)

        # Unrelated Doctor B must still be denied on Confirmed Patient
        self._assert_all_patient_routes_denied(doc_b_headers, p_conf_id, p_conf_doc)

        # Completed, non-anonymous appointment also grants chart access
        p_comp_id, _ = self._create_patient("+919900002012", "Completed Patient")
        self._insert_appointment(doc_a_id, p_comp_id, status="completed", anonymous=0)
        comp_chart = self.client.get(f"/api/doctor/patients/{p_comp_id}/chart", headers=doc_a_headers)
        self.assertEqual(comp_chart.status_code, 200, comp_chart.text)
        self.assertEqual(comp_chart.json()["patient"]["name"], "Completed Patient")


if __name__ == "__main__":
    unittest.main()
