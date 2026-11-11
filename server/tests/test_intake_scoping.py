"""Tests scoping intake_for_doctor() by doctor specialty and patient sharing setting."""
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
    os.environ["DB_PATH"] = str(Path(_TMP_DIR.name) / "test_intake_scoping.db")

from app import crypto, db as db_mod, main, routes_insurance  # noqa: E402


class IntakeScopingTests(unittest.TestCase):
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

    def _create_doctor(self, phone: str, name: str, specialty: str) -> tuple[int, dict[str, str]]:
        with db_mod.get_db() as db:
            doctor_id = db.execute(
                "INSERT INTO doctors (name, specialty, phone, fee_inr) VALUES (?, ?, ?, 500)",
                (name, specialty, phone),
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

    def _book_with_share(
        self,
        doctor_id: int,
        user_id: int,
        patient_headers: dict[str, str],
        share_body: dict | None,
    ) -> str:
        appt_id = f"appt_{secrets.token_hex(6)}"
        with db_mod.get_db() as db:
            db.execute(
                """INSERT INTO appointments (id, user_id, doctor_id, date, time, consult_mode, amount_inr, status, anonymous)
                   VALUES (?, ?, ?, '2026-12-01', '10:00', 'video', 500, 'confirmed', 0)""",
                (appt_id, user_id, doctor_id),
            )
        if share_body is not None:
            r = self.client.put(
                f"/api/me/appointments/{appt_id}/history-share",
                json=share_body,
                headers=patient_headers,
            )
            self.assertEqual(r.status_code, 200, r.text)
        return appt_id

    def _submit_all_intake_forms(self, patient_headers: dict[str, str]):
        for form_id, secret_note in (
            ("homeopathy", "Sensitive childhood trauma"),
            ("ayurveda", "Ayurveda digesion history"),
            ("counselling", "Samadhana SRQ-20 distressing thoughts"),
        ):
            res = self.client.post(
                f"/api/intake/{form_id}",
                json={"answers": {"summary": secret_note}, "skippedSections": []},
                headers=patient_headers,
            )
            self.assertEqual(res.status_code, 201, res.text)

    def test_wrong_specialty_gets_nothing_and_matching_specialty_gets_only_its_form(self):
        user_id, p_headers = self._create_patient("+919900004001", "Intake Specialty Patient")
        self._submit_all_intake_forms(p_headers)

        gynae_id, gynae_headers = self._create_doctor("+919900004011", "Dr. Gynae", "Gynaecology")
        yoga_id, yoga_headers = self._create_doctor("+919900004012", "Instructor Yoga", "Yoga")
        homeo_id, homeo_headers = self._create_doctor("+919900004013", "Dr. Homeo", "Homeopathy")
        ayur_id, ayur_headers = self._create_doctor("+919900004014", "Dr. Ayur", "Ayurveda")
        mh_id, mh_headers = self._create_doctor("+919900004015", "Samadhana", "Mental Health")

        for doc_id in (gynae_id, yoga_id, homeo_id, ayur_id, mh_id):
            self._book_with_share(doc_id, user_id, p_headers, {"mode": "all", "categories": [], "documentIds": []})

        for unmapped_headers in (gynae_headers, yoga_headers):
            chart = self.client.get(f"/api/doctor/patients/{user_id}/chart", headers=unmapped_headers)
            self.assertEqual(chart.status_code, 200, chart.text)
            self.assertEqual(chart.json()["intakeForms"], [])

        for doc_headers, expected_form in (
            (homeo_headers, "homeopathy"),
            (ayur_headers, "ayurveda"),
            (mh_headers, "counselling"),
        ):
            chart = self.client.get(f"/api/doctor/patients/{user_id}/chart", headers=doc_headers)
            self.assertEqual(chart.status_code, 200, chart.text)
            forms = chart.json()["intakeForms"]
            self.assertEqual([f["formId"] for f in forms], [expected_form])

    def test_sharing_off_or_partial_gets_nothing_and_fail_closed_defaults(self):
        user_none_id, p_none_headers = self._create_patient("+919900004021", "Share Off Patient")
        self._submit_all_intake_forms(p_none_headers)

        homeo_id, homeo_headers = self._create_doctor("+919900004031", "Dr. Homeo 2", "Homeopathy")
        self._book_with_share(homeo_id, user_none_id, p_none_headers, {"mode": "none", "categories": [], "documentIds": []})

        chart_none = self.client.get(f"/api/doctor/patients/{user_none_id}/chart", headers=homeo_headers)
        self.assertEqual(chart_none.status_code, 200, chart_none.text)
        self.assertEqual(chart_none.json()["intakeForms"], [])

        # Partial category selection excludes uncategorized intake proformas
        user_sel_id, p_sel_headers = self._create_patient("+919900004022", "Selected Share Patient")
        self._submit_all_intake_forms(p_sel_headers)
        self._book_with_share(
            homeo_id,
            user_sel_id,
            p_sel_headers,
            {"mode": "selected", "categories": ["allergies"], "documentIds": []},
        )
        chart_sel = self.client.get(f"/api/doctor/patients/{user_sel_id}/chart", headers=homeo_headers)
        self.assertEqual(chart_sel.status_code, 200, chart_sel.text)
        self.assertEqual(chart_sel.json()["intakeForms"], [])

        # Direct helper calls without specialty or share fail closed
        with db_mod.get_db() as db:
            self.assertEqual(routes_insurance.intake_for_doctor(db, user_none_id), [])
            self.assertEqual(routes_insurance.intake_for_doctor(db, user_none_id, "Homeopathy", None), [])

        # Legacy confirmed booking without history_shares defaults to mode='all' and scopes by specialty
        user_legacy_id, p_leg_headers = self._create_patient("+919900004023", "Legacy Share Patient")
        self._submit_all_intake_forms(p_leg_headers)
        self._book_with_share(homeo_id, user_legacy_id, p_leg_headers, None)
        chart_leg = self.client.get(f"/api/doctor/patients/{user_legacy_id}/chart", headers=homeo_headers)
        self.assertEqual(chart_leg.status_code, 200, chart_leg.text)
        self.assertEqual([f["formId"] for f in chart_leg.json()["intakeForms"]], ["homeopathy"])


if __name__ == "__main__":
    unittest.main()
