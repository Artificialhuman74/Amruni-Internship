"""Tests for server-side prescription PDF generation and signed verification."""
import atexit
import os
import re
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
    os.environ["DB_PATH"] = str(Path(_TMP_DIR.name) / "test_prescriptions.db")

from app import crypto, db as db_mod, main  # noqa: E402


class PrescriptionPdfAndVerificationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(main.app, client=("203.0.113.55", 50000))

    def _auth_headers(self, phone: str, verify_path: str) -> dict[str, str]:
        prev = os.environ.get("TEST_OTP_NUMBERS")
        os.environ["TEST_OTP_NUMBERS"] = f"{phone}:123456"
        try:
            r_req = self.client.post("/api/auth/request-otp", json={"phone": phone})
            self.assertEqual(r_req.status_code, 200, r_req.text)
            r_ver = self.client.post(verify_path, json={"phone": phone, "code": "123456"})
            self.assertEqual(r_ver.status_code, 200, r_ver.text)
            return {"Authorization": f"Bearer {r_ver.json()['token']}"}
        finally:
            if prev is None:
                os.environ.pop("TEST_OTP_NUMBERS", None)
            else:
                os.environ["TEST_OTP_NUMBERS"] = prev

    def _seed_doctor(self, phone: str, name: str, with_licence: bool = True) -> tuple[int, dict[str, str]]:
        with db_mod.get_db() as db:
            cur = db.execute(
                "INSERT INTO doctors (name, specialty, phone, fee_inr) VALUES (?, 'gynecology', ?, 600)",
                (name, phone),
            )
            doctor_id = cur.lastrowid
            if with_licence:
                db.execute(
                    """INSERT INTO doctor_licences (doctor_id, country, region, authority, number, expires_on)
                       VALUES (?, 'IN', 'KA', 'Karnataka Medical Council', 'KMC-88412', '2099-12-31')""",
                    (doctor_id,),
                )
        headers = self._auth_headers(phone, "/api/doctor/verify-otp")
        return doctor_id, headers

    def _seed_patient(self, phone: str, name: str) -> tuple[int, dict[str, str]]:
        headers = self._auth_headers(phone, "/api/auth/verify-otp")
        with db_mod.get_db() as db:
            row = db.execute("SELECT id FROM users WHERE phone_bidx = ?", (crypto.blind_index(phone),)).fetchone()
            self.assertIsNotNone(row)
            db.execute("UPDATE users SET name = ? WHERE id = ?", (crypto.enc(name), row["id"]))
            return row["id"], headers

    def _seed_appointment(self, doctor_id: int, user_id: int, anonymous: int = 0) -> str:
        appt_id = f"appt_{secrets.token_hex(6)}"
        with db_mod.get_db() as db:
            db.execute(
                """INSERT INTO appointments (id, user_id, doctor_id, date, time, consult_mode, amount_inr, status, anonymous)
                   VALUES (?, ?, ?, '2026-12-01', '10:30 AM', 'video', 600, 'confirmed', ?)""",
                (appt_id, user_id, doctor_id, anonymous),
            )
        return appt_id

    def test_patient_downloads_valid_pdf_with_verification_link_and_no_seal_claim(self):
        doc_id, doc_headers = self._seed_doctor("+919850001001", "Dr. Kavya Rao")
        user_id, pat_headers = self._seed_patient("+919850002001", "Ananya Sharma")
        appt_id = self._seed_appointment(doc_id, user_id)

        save = self.client.put(
            f"/api/doctor/appointments/{appt_id}/record",
            headers=doc_headers,
            json={
                "diagnosis": "Iron deficiency anemia",
                "notes": "Take iron tablet after lunch with vitamin C.",
                "prescription": [
                    {"name": "Ferrous Ascorbate", "dose": "100 mg", "frequency": "0-1-0", "duration": "30 days"},
                    {"name": "Folic Acid", "dose": "5 mg", "frequency": "1-0-0", "duration": "30 days"},
                ],
                "followUp": "2027-01-05",
            },
        )
        self.assertEqual(save.status_code, 200, save.text)

        meta_res = self.client.get(f"/api/appointments/{appt_id}/prescription", headers=pat_headers)
        self.assertEqual(meta_res.status_code, 200, meta_res.text)
        self.assertIn("no-store", meta_res.headers.get("cache-control", ""))
        meta = meta_res.json()
        self.assertEqual(meta["rxId"], f"Rx_{appt_id}")
        self.assertTrue(meta["verificationToken"])
        self.assertIn(meta["verificationToken"], meta["verificationUrl"])

        pdf_res = self.client.get(f"/api/appointments/{appt_id}/prescription.pdf", headers=pat_headers)
        self.assertEqual(pdf_res.status_code, 200, pdf_res.text)
        self.assertEqual(pdf_res.headers.get("content-type"), "application/pdf")
        self.assertIn(f"prescription-{appt_id}.pdf", pdf_res.headers.get("content-disposition", ""))
        self.assertIn("no-store", pdf_res.headers.get("cache-control", ""))

        raw = pdf_res.content
        self.assertTrue(raw.startswith(b"%PDF-1.4"))
        self.assertTrue(raw.rstrip().endswith(b"%%EOF"))
        self.assertIn(b"/Type /Catalog", raw)
        self.assertIn(b"/Type /Page", raw)
        self.assertIn(b"/Subtype /Link", raw)
        self.assertIn(b"/S /URI", raw)
        self.assertIn(b"xref", raw)
        self.assertIn(b"startxref", raw)

        text = raw.decode("latin-1", errors="replace")
        self.assertIn(f"Rx_{appt_id}", text)
        self.assertIn("Dr. Kavya Rao", text)
        self.assertIn("KMC-88412", text)
        self.assertIn("Ferrous Ascorbate", text)
        self.assertIn("Ananya Sharma", text)
        self.assertIn(meta["verificationToken"], text)
        self.assertNotIn("Electronically signed", text)
        self.assertNotIn("digital seal", text.lower())

    def test_prescription_verification_valid_superseded_tampered_deleted_and_no_phi_leak(self):
        doc_id, doc_headers = self._seed_doctor("+919850001002", "Dr. Meera Iyer")
        user_id, pat_headers = self._seed_patient("+919850002002", "Secret Patient Name")
        appt_id = self._seed_appointment(doc_id, user_id)

        self.assertEqual(
            self.client.put(
                f"/api/doctor/appointments/{appt_id}/record",
                headers=doc_headers,
                json={
                    "diagnosis": "PCOS Diagnosis",
                    "notes": "Sensitive clinical instructions",
                    "prescription": [{"name": "Metformin", "dose": "500 mg", "frequency": "1-0-1", "duration": "30 days"}],
                },
            ).status_code,
            200,
        )

        token1 = self.client.get(f"/api/appointments/{appt_id}/prescription", headers=pat_headers).json()["verificationToken"]

        # Unauthenticated verification succeeds without leaking PHI/clinical details.
        ver = self.client.get("/api/prescriptions/verify", params={"token": token1})
        self.assertEqual(ver.status_code, 200, ver.text)
        self.assertIn("no-store", ver.headers.get("cache-control", ""))
        body = ver.json()
        self.assertTrue(body["valid"])
        self.assertEqual(body["status"], "valid")
        self.assertEqual(body["rxId"], f"Rx_{appt_id}")
        self.assertEqual(body["medicineCount"], 1)
        self.assertEqual(body["doctor"]["name"], "Dr. Meera Iyer")
        self.assertIn("KMC-88412", body["doctor"]["registration"] or "")
        for sensitive in ("Secret Patient Name", "+919850002002", "PCOS Diagnosis", "Sensitive clinical", "Metformin"):
            self.assertNotIn(sensitive, ver.text)

        # Missing or tampered token fails closed.
        self.assertEqual(self.client.get("/api/prescriptions/verify", params={"token": ""}).status_code, 400)
        tampered = token1[:-1] + ("A" if token1[-1] != "A" else "B")
        bad = self.client.get("/api/prescriptions/verify", params={"token": tampered})
        self.assertEqual(bad.status_code, 400, bad.text)
        self.assertFalse(bad.json()["valid"])

        # Doctor updates prescription -> token1 becomes superseded, new token2 validates.
        self.assertEqual(
            self.client.put(
                f"/api/doctor/appointments/{appt_id}/record",
                headers=doc_headers,
                json={
                    "diagnosis": "PCOS Diagnosis",
                    "prescription": [
                        {"name": "Metformin", "dose": "500 mg", "frequency": "1-0-1", "duration": "30 days"},
                        {"name": "Myo-inositol", "dose": "2 g", "frequency": "0-0-1", "duration": "30 days"},
                    ],
                },
            ).status_code,
            200,
        )
        sup = self.client.get("/api/prescriptions/verify", params={"token": token1})
        self.assertEqual(sup.status_code, 200, sup.text)
        self.assertFalse(sup.json()["valid"])
        self.assertEqual(sup.json()["status"], "superseded")

        token2 = self.client.get(f"/api/appointments/{appt_id}/prescription", headers=pat_headers).json()["verificationToken"]
        self.assertNotEqual(token1, token2)
        ver2 = self.client.get("/api/prescriptions/verify", params={"token": token2})
        self.assertEqual(ver2.status_code, 200, ver2.text)
        self.assertTrue(ver2.json()["valid"])
        self.assertEqual(ver2.json()["medicineCount"], 2)

        # Deleting the consultation record invalidates token2.
        with db_mod.get_db() as db:
            db.execute("DELETE FROM consultation_records WHERE appointment_id = ?", (appt_id,))
        deleted = self.client.get("/api/prescriptions/verify", params={"token": token2})
        self.assertEqual(deleted.status_code, 404, deleted.text)
        self.assertFalse(deleted.json()["valid"])
        self.assertEqual(deleted.json()["status"], "not_found")

    def test_prescription_endpoints_enforce_ownership_missing_record_and_anonymity(self):
        doc_id, doc_headers = self._seed_doctor("+919850001003", "Dr. Maya Nair", with_licence=False)
        user_a, headers_a = self._seed_patient("+919850002003", "Real Patient A")
        _, headers_b = self._seed_patient("+919850002004", "Patient B")
        appt_id = self._seed_appointment(doc_id, user_a, anonymous=1)

        # Unauthenticated requests fail closed.
        self.assertEqual(self.client.get(f"/api/appointments/{appt_id}/prescription").status_code, 401)
        self.assertEqual(self.client.get(f"/api/appointments/{appt_id}/prescription.pdf").status_code, 401)

        # No record saved yet -> 404 even for owner.
        self.assertEqual(self.client.get(f"/api/appointments/{appt_id}/prescription", headers=headers_a).status_code, 404)
        self.assertEqual(self.client.get(f"/api/appointments/{appt_id}/prescription.pdf", headers=headers_a).status_code, 404)

        self.assertEqual(
            self.client.put(
                f"/api/doctor/appointments/{appt_id}/record",
                headers=doc_headers,
                json={"diagnosis": "Anxiety", "prescription": [{"name": "L-Theanine", "dose": "200 mg"}]},
            ).status_code,
            200,
        )

        # Another patient cannot fetch metadata or PDF (IDOR check).
        self.assertEqual(self.client.get(f"/api/appointments/{appt_id}/prescription", headers=headers_b).status_code, 404)
        self.assertEqual(self.client.get(f"/api/appointments/{appt_id}/prescription.pdf", headers=headers_b).status_code, 404)

        # Anonymous consultation omits patient name from the PDF.
        pdf_res = self.client.get(f"/api/appointments/{appt_id}/prescription.pdf", headers=headers_a)
        self.assertEqual(pdf_res.status_code, 200, pdf_res.text)
        pdf_text = pdf_res.content.decode("latin-1", errors="replace")
        self.assertIn("Confidential Patient", pdf_text)
        self.assertNotIn("Real Patient A", pdf_text)
        self.assertTrue(re.search(r"/api/prescriptions/verify\?token=", pdf_text))


if __name__ == "__main__":
    unittest.main()
