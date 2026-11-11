"""Tests for OTP-reauthenticated DELETE /api/me/account and clinical retention."""
import atexit
import base64
import os
import secrets
import sys
import tempfile
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient

_SERVER_DIR = Path(__file__).resolve().parent.parent
if str(_SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVER_DIR))

_TMP_DIR = None
if "app.db" not in sys.modules and "DB_PATH" not in os.environ:
    _TMP_DIR = tempfile.TemporaryDirectory()
    atexit.register(_TMP_DIR.cleanup)
    os.environ["DB_PATH"] = str(Path(_TMP_DIR.name) / "test_account_delete.db")

from app import auth, crypto, db as db_mod, main  # noqa: E402


class AccountDeletionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client_a = TestClient(main.app, client=("203.0.113.80", 50000))
        cls.client_b = TestClient(main.app, client=("203.0.113.81", 50000))

    def _sign_in_patient(self, client: TestClient, phone: str, otp: str = "123456") -> tuple[int, dict[str, str]]:
        prev = os.environ.get("TEST_OTP_NUMBERS")
        os.environ["TEST_OTP_NUMBERS"] = f"{phone}:{otp}"
        try:
            self.assertEqual(client.post("/api/auth/request-otp", json={"phone": phone}).status_code, 200)
            res = client.post("/api/auth/verify-otp", json={"phone": phone, "code": otp})
            self.assertEqual(res.status_code, 200, res.text)
            token = res.json()["token"]
        finally:
            if prev is None:
                os.environ.pop("TEST_OTP_NUMBERS", None)
            else:
                os.environ["TEST_OTP_NUMBERS"] = prev

        with db_mod.get_db() as db:
            uid = db.execute("SELECT id FROM users WHERE phone_bidx = ?", (crypto.blind_index(phone),)).fetchone()["id"]
        return uid, {"Authorization": f"Bearer {token}"}

    def _request_fresh_otp(self, client: TestClient, phone: str, fixed_code: str = "654321") -> str:
        prev = os.environ.get("TEST_OTP_NUMBERS")
        os.environ["TEST_OTP_NUMBERS"] = f"{phone}:{fixed_code}"
        try:
            res = client.post("/api/auth/request-otp", json={"phone": phone})
            self.assertEqual(res.status_code, 200, res.text)
            return res.json().get("devCode") or fixed_code
        finally:
            if prev is None:
                os.environ.pop("TEST_OTP_NUMBERS", None)
            else:
                os.environ["TEST_OTP_NUMBERS"] = prev

    def _create_doctor(self, phone: str, name: str) -> tuple[int, dict[str, str]]:
        with db_mod.get_db() as db:
            doctor_id = db.execute(
                "INSERT INTO doctors (name, specialty, phone, fee_inr) VALUES (?, 'Gynaecology', ?, 600)",
                (name, phone),
            ).lastrowid

        prev = os.environ.get("TEST_OTP_NUMBERS")
        os.environ["TEST_OTP_NUMBERS"] = f"{phone}:123456"
        try:
            self.assertEqual(self.client_b.post("/api/auth/request-otp", json={"phone": phone}).status_code, 200)
            res = self.client_b.post("/api/doctor/verify-otp", json={"phone": phone, "code": "123456"})
            self.assertEqual(res.status_code, 200, res.text)
            return doctor_id, {"Authorization": f"Bearer {res.json()['token']}"}
        finally:
            if prev is None:
                os.environ.pop("TEST_OTP_NUMBERS", None)
            else:
                os.environ["TEST_OTP_NUMBERS"] = prev

    def test_requires_auth_and_valid_fresh_otp_reauth(self):
        unauth = self.client_a.request("DELETE", "/api/me/account", json={"code": "123456"})
        self.assertEqual(unauth.status_code, 401)

        phone = "+919866660001"
        uid, headers = self._sign_in_patient(self.client_a, phone)
        self.client_a.patch("/api/me", json={"name": "Stay Alive"}, headers=headers)

        # Missing or malformed code is rejected before touching state or OTPs.
        self.assertEqual(self.client_a.request("DELETE", "/api/me/account", headers=headers).status_code, 400)
        self.assertEqual(
            self.client_a.request("DELETE", "/api/me/account", json={"code": "12ab"}, headers=headers).status_code, 400
        )

        # Login consumed the earlier OTP, so immediate delete without fresh OTP must fail.
        no_otp = self.client_a.request("DELETE", "/api/me/account", json={"code": "123456"}, headers=headers)
        self.assertEqual(no_otp.status_code, 401)

        # Request a fresh OTP; wrong code fails and locks out after OTP_MAX_ATTEMPTS.
        fresh_code = self._request_fresh_otp(self.client_a, phone, "654321")
        for _ in range(auth.OTP_MAX_ATTEMPTS):
            wrong = self.client_a.request("DELETE", "/api/me/account", json={"code": "000000"}, headers=headers)
            self.assertEqual(wrong.status_code, 401)
        locked = self.client_a.request("DELETE", "/api/me/account", json={"code": fresh_code}, headers=headers)
        self.assertEqual(locked.status_code, 429)

        # Account still exists and token still works.
        me = self.client_a.get("/api/me", headers=headers)
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["user"]["name"], "Stay Alive")
        self.assertIsNotNone(uid)

    def test_full_hard_delete_when_no_clinical_records_exist(self):
        # Set up User B with a community post that User A likes & replies to.
        _, headers_b = self._sign_in_patient(self.client_b, "+919866660002")
        parent_post = self.client_b.post(
            "/api/community/posts",
            json={"text": "Parent community thread", "tags": ["menstruation"], "isAnonymous": True},
            headers=headers_b,
        )
        self.assertEqual(parent_post.status_code, 201)
        parent_id = parent_post.json()["id"]

        phone_a = "+919866660003"
        uid_a, headers_a = self._sign_in_patient(self.client_a, phone_a)
        self.assertEqual(
            self.client_a.patch("/api/me", json={"name": "Full Wipe User", "isOnboarded": True}, headers=headers_a).status_code,
            200,
        )
        self.assertEqual(
            self.client_a.post(
                "/api/journal",
                json={"date": "2026-11-01", "text": "TO_BE_DELETED_JOURNAL", "tags": ["menstruation"]},
                headers=headers_a,
            ).status_code,
            201,
        )
        self.assertEqual(
            self.client_a.post(
                "/api/me/documents",
                json={
                    "title": "TO_BE_DELETED_PATIENT_DOC",
                    "kind": "report",
                    "data": "data:application/pdf;base64," + base64.b64encode(b"%PDF-1.4\n").decode(),
                },
                headers=headers_a,
            ).status_code,
            201,
        )
        # Like and reply on B's community post so counters must decrement cleanly.
        self.assertEqual(self.client_a.post(f"/api/community/posts/{parent_id}/like", headers=headers_a).status_code, 200)
        reply = self.client_a.post(
            "/api/community/posts",
            json={"text": "TO_BE_DELETED_REPLY", "tags": ["menstruation"], "replyToId": parent_id},
            headers=headers_a,
        )
        self.assertEqual(reply.status_code, 201)

        # Upcoming unrecorded appointment holding a doctor slot must be deleted & release the slot.
        doc_id, _ = self._create_doctor("+919866660091", "Dr. Slot Release")
        with db_mod.get_db() as db:
            slot_id = db.execute(
                """INSERT INTO slots (doctor_id, date, start_time, end_time, mode, price_inr, status)
                   VALUES (?, '2026-12-20', '11:00', '11:30', 'video', 600, 'booked')""",
                (doc_id,),
            ).lastrowid
            appt_id = f"appt_{secrets.token_hex(6)}"
            db.execute(
                """INSERT INTO appointments (id, user_id, doctor_id, slot_id, date, time, reason, consult_mode, amount_inr, status)
                   VALUES (?, ?, ?, ?, '2026-12-20', '11:00 AM', ?, 'video', 600, 'confirmed')""",
                (appt_id, uid_a, doc_id, slot_id, crypto.enc("TO_BE_DELETED_REASON")),
            )

        code = self._request_fresh_otp(self.client_a, phone_a, "778899")
        del_resp = self.client_a.request("DELETE", "/api/me/account", json={"code": code}, headers=headers_a)
        self.assertEqual(del_resp.status_code, 200, del_resp.text)
        self.assertTrue(del_resp.json()["deleted"])
        self.assertEqual(del_resp.json()["retainedClinicalRecords"], 0)
        self.assertEqual(del_resp.json()["retainedDoctorDocuments"], 0)
        self.assertIn("no-store", del_resp.headers.get("cache-control", "").lower())

        # Replaying same OTP or reusing old JWT fails immediately.
        self.assertEqual(self.client_a.get("/api/me", headers=headers_a).status_code, 401)
        self.assertEqual(self.client_a.get("/api/me/export", headers=headers_a).status_code, 401)

        with db_mod.get_db() as db:
            self.assertIsNone(db.execute("SELECT id FROM users WHERE id = ?", (uid_a,)).fetchone())
            self.assertEqual(db.execute("SELECT COUNT(*) AS n FROM appointments WHERE user_id = ?", (uid_a,)).fetchone()["n"], 0)
            self.assertEqual(db.execute("SELECT COUNT(*) AS n FROM journal_entries WHERE user_id = ?", (uid_a,)).fetchone()["n"], 0)
            self.assertEqual(db.execute("SELECT COUNT(*) AS n FROM documents WHERE user_id = ?", (uid_a,)).fetchone()["n"], 0)
            self.assertEqual(db.execute("SELECT COUNT(*) AS n FROM community_posts WHERE author_id = ?", (uid_a,)).fetchone()["n"], 0)
            self.assertEqual(db.execute("SELECT status FROM slots WHERE id = ?", (slot_id,)).fetchone()["status"], "open")
            parent_row = db.execute("SELECT like_count, reply_count FROM community_posts WHERE id = ?", (parent_id,)).fetchone()
            self.assertEqual(parent_row["like_count"], 0)
            self.assertEqual(parent_row["reply_count"], 0)

        # Re-registering with the same phone produces a clean brand-new account.
        new_uid, new_headers = self._sign_in_patient(self.client_a, phone_a, "112233")
        self.assertNotEqual(new_uid, uid_a)
        self.assertIsNone(self.client_a.get("/api/me", headers=new_headers).json()["user"]["name"])

    def test_retains_deidentified_clinical_and_prescription_records_while_wiping_pii_and_wellness(self):
        phone = "+919866660004"
        uid, headers = self._sign_in_patient(self.client_a, phone)
        doc1_id, doc1_headers = self._create_doctor("+919866660092", "Dr. Retain Primary")
        doc2_id, doc2_headers = self._create_doctor("+919866660093", "Dr. Retain Secondary")

        self.assertEqual(
            self.client_a.put(
                "/api/me/state",
                json={
                    "user": {"name": "PRIYA_DELETE_ME_PII", "dob": "1994-03-10", "lifeStage": "reproductive", "goal": "wellness"},
                    "settings": {"notifications": False, "anonymousMode": False},
                },
                headers=headers,
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client_a.put(
                "/api/me/health",
                json={"conditions": ["WELLNESS_CONDITION_WIPE"], "allergies": ["Penicillin"], "bloodGroup": "O+"},
                headers=headers,
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client_a.post(
                "/api/journal",
                json={"date": "2026-11-01", "text": "PRIVATE_JOURNAL_WIPE", "tags": ["menstruation"]},
                headers=headers,
            ).status_code,
            201,
        )
        self.assertEqual(
            self.client_a.put(
                "/api/insurance",
                json={"country": "IN", "payerType": "private", "insurer": "Star Care", "policyNumber": "POL_WIPE_123", "memberId": "MEM_WIPE_123"},
                headers=headers,
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client_a.post(
                "/api/me/sos/contacts",
                json={"name": "SOS_WIPE", "phone": "+919800000999", "relation": "Sister"},
                headers=headers,
            ).status_code,
            201,
        )
        # Patient-uploaded document MUST be deleted; doctor-uploaded doc MUST be retained.
        self.assertEqual(
            self.client_a.post(
                "/api/me/documents",
                json={
                    "title": "PATIENT_UPLOAD_WIPE",
                    "kind": "lab",
                    "data": "data:application/pdf;base64," + base64.b64encode(b"%PDF-1.4\nPATIENT").decode(),
                },
                headers=headers,
            ).status_code,
            201,
        )

        # Create 2 recorded consultations (doc1 & doc2) + 1 unrecorded appointment + payment + history share.
        appt_doc1 = f"appt_{secrets.token_hex(6)}"
        appt_doc2 = f"appt_{secrets.token_hex(6)}"
        appt_unrec = f"appt_{secrets.token_hex(6)}"
        with db_mod.get_db() as db:
            for aid, did, status in (
                (appt_doc1, doc1_id, "confirmed"),
                (appt_doc2, doc2_id, "confirmed"),
                (appt_unrec, doc1_id, "cancelled"),
            ):
                db.execute(
                    """INSERT INTO appointments
                         (id, user_id, doctor_id, date, time, reason, consult_mode, amount_inr, status, anonymous, meet_link)
                       VALUES (?, ?, ?, '2026-11-05', '10:00 AM', ?, 'video', 600, ?, 0, 'https://meet.example/pii')""",
                    (aid, uid, did, crypto.enc("SENSITIVE_REASON_WIPE"), status),
                )
            db.execute(
                """INSERT INTO payments (id, appointment_id, user_id, provider, order_id, amount_inr, status)
                   VALUES (?, ?, ?, 'razorpay', 'ORD_WIPE_123', 600, 'paid')""",
                (f"pay_{secrets.token_hex(6)}", appt_doc1, uid),
            )
            db.execute(
                "INSERT INTO history_shares (appointment_id, user_id, doctor_id, mode) VALUES (?, ?, ?, 'all')",
                (appt_doc1, uid, doc1_id),
            )

        # Doctor 1 writes clinical record + uploads doctor document; Doctor 2 writes record 2.
        self.assertEqual(
            self.client_b.put(
                f"/api/doctor/appointments/{appt_doc1}/record",
                json={"diagnosis": "RETAINED_DIAGNOSIS_DOC1", "notes": "RETAINED_NOTES_DOC1", "prescription": [{"name": "Folic Acid", "dose": "5mg"}]},
                headers=doc1_headers,
            ).status_code,
            200,
        )
        doc1_upload = self.client_b.post(
            f"/api/doctor/patients/{uid}/documents",
            json={
                "title": "RETAINED_DOCTOR_SCAN",
                "kind": "scan",
                "data": "data:application/pdf;base64," + base64.b64encode(b"%PDF-1.4\nDOCSCAN").decode(),
            },
            headers=doc1_headers,
        )
        self.assertEqual(doc1_upload.status_code, 201)
        doc1_upload_id = doc1_upload.json()["id"]

        self.assertEqual(
            self.client_b.put(
                f"/api/doctor/appointments/{appt_doc2}/record",
                json={"diagnosis": "RETAINED_DIAGNOSIS_DOC2", "notes": "RETAINED_NOTES_DOC2", "prescription": []},
                headers=doc2_headers,
            ).status_code,
            200,
        )

        # Mint prescription verification token BEFORE deletion so post-delete verification is tested.
        rx_meta = self.client_a.get(f"/api/appointments/{appt_doc1}/prescription", headers=headers)
        self.assertEqual(rx_meta.status_code, 200)
        rx_token = parse_qs(urlparse(rx_meta.json()["verificationUrl"]).query)["token"][0]

        # Delete via header OTP auth channel (`X-OTP-Code`) to exercise header fallback too.
        fresh_code = self._request_fresh_otp(self.client_a, phone, "445566")
        del_resp = self.client_a.delete("/api/me/account", headers={**headers, "X-OTP-Code": fresh_code})
        self.assertEqual(del_resp.status_code, 200, del_resp.text)
        self.assertTrue(del_resp.json()["deleted"])
        self.assertEqual(del_resp.json()["retainedClinicalRecords"], 2)
        self.assertEqual(del_resp.json()["retainedDoctorDocuments"], 1)

        # Patient JWT is immediately invalid.
        self.assertEqual(self.client_a.get("/api/me", headers=headers).status_code, 401)
        self.assertEqual(self.client_a.get("/api/me/export", headers=headers).status_code, 401)

        # Public prescription verification still succeeds without any patient PII.
        verify_resp = self.client_a.get("/api/prescriptions/verify", params={"token": rx_token})
        self.assertEqual(verify_resp.status_code, 200)
        self.assertTrue(verify_resp.json()["valid"])
        self.assertNotIn("PRIYA_DELETE_ME_PII", verify_resp.text)

        # Doctor 1 still reads retained clinical record & doctor-uploaded doc, with zero PII & zero other-doctor data.
        doc1_appts = self.client_b.get("/api/doctor/appointments", headers=doc1_headers)
        self.assertEqual(doc1_appts.status_code, 200)
        retained_summary = next(a for a in doc1_appts.json() if a["appointmentId"] == appt_doc1)
        self.assertEqual(retained_summary["patient"]["name"], "Deleted patient")
        self.assertIsNone(retained_summary["patient"]["phone"])
        self.assertIsNone(retained_summary["reason"])
        self.assertIsNone(retained_summary["meetLink"])
        self.assertIsNone(retained_summary["historyShare"])

        self.assertEqual(
            self.client_b.get(f"/api/doctor/appointments/{appt_doc1}/record", headers=doc1_headers).json()["record"]["diagnosis"],
            "RETAINED_DIAGNOSIS_DOC1",
        )
        self.assertEqual(
            self.client_b.get(f"/api/doctor/patients/{uid}/documents/{doc1_upload_id}", headers=doc1_headers).json()["title"],
            "RETAINED_DOCTOR_SCAN",
        )
        chart_doc1 = self.client_b.get(f"/api/doctor/patients/{uid}/chart", headers=doc1_headers)
        self.assertEqual(chart_doc1.status_code, 200)
        self.assertNotIn("RETAINED_DIAGNOSIS_DOC2", chart_doc1.text)
        self.assertNotIn("PRIYA_DELETE_ME_PII", chart_doc1.text)
        self.assertNotIn("WELLNESS_CONDITION_WIPE", chart_doc1.text)

        # Deleted account excluded from doctor's active patient directory and chart mutations blocked.
        self.assertFalse(
            any(p["id"] == uid for p in self.client_b.get("/api/doctor/patients", headers=doc1_headers).json())
        )
        self.assertEqual(
            self.client_b.put(f"/api/doctor/patients/{uid}/chart", json={"allergies": ["X"]}, headers=doc1_headers).status_code,
            404,
        )

        # Verify PII/wellness tables & patient doc & payment were scrubbed/hard-deleted; audit log preserved.
        with db_mod.get_db() as db:
            u = db.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
            self.assertIsNotNone(u["deleted_at"])
            self.assertIsNone(u["phone_bidx"])
            self.assertIsNone(u["name"])
            self.assertIsNone(u["dob"])
            self.assertNotEqual(crypto.dec(u["phone"]), phone)
            self.assertIsNone(db.execute("SELECT id FROM appointments WHERE id = ?", (appt_unrec,)).fetchone())
            self.assertEqual(db.execute("SELECT COUNT(*) AS n FROM payments WHERE user_id = ?", (uid,)).fetchone()["n"], 0)
            self.assertEqual(db.execute("SELECT COUNT(*) AS n FROM patient_charts WHERE user_id = ?", (uid,)).fetchone()["n"], 0)
            self.assertEqual(db.execute("SELECT COUNT(*) AS n FROM insurance_policies WHERE user_id = ?", (uid,)).fetchone()["n"], 0)
            self.assertEqual(db.execute("SELECT COUNT(*) AS n FROM journal_entries WHERE user_id = ?", (uid,)).fetchone()["n"], 0)
            self.assertEqual(db.execute("SELECT COUNT(*) AS n FROM sos_contacts WHERE user_id = ?", (uid,)).fetchone()["n"], 0)
            self.assertEqual(db.execute("SELECT COUNT(*) AS n FROM anon_handles WHERE user_id = ?", (uid,)).fetchone()["n"], 0)
            docs = db.execute("SELECT uploaded_by FROM documents WHERE user_id = ?", (uid,)).fetchall()
            self.assertEqual([d["uploaded_by"] for d in docs], ["doctor"])
            audit = db.execute(
                "SELECT action, outcome, status_code FROM medical_audit_logs WHERE actor_type = 'patient' AND actor_id = ? AND action = 'delete'",
                (uid,),
            ).fetchone()
            self.assertIsNotNone(audit)
            self.assertEqual((audit["outcome"], audit["status_code"]), ("granted", 200))

        # Patient re-signing up with same phone gets a brand-new user with empty history.
        re_uid, re_headers = self._sign_in_patient(self.client_a, phone, "998877")
        self.assertNotEqual(re_uid, uid)
        re_export = self.client_a.get("/api/me/export", headers=re_headers).json()
        self.assertEqual(re_export["appointments"], [])
        self.assertEqual(re_export["documents"], [])


if __name__ == "__main__":
    unittest.main()
