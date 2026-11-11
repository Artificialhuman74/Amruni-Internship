"""Tests for authenticated, uncached patient data export (GET /api/me/export)."""
import atexit
import base64
import json
import os
import secrets
import sys
import tempfile
import time
import unittest
from pathlib import Path

import jwt

from fastapi.testclient import TestClient

_SERVER_DIR = Path(__file__).resolve().parent.parent
if str(_SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVER_DIR))

_TMP_DIR = None
if "app.db" not in sys.modules and "DB_PATH" not in os.environ:
    _TMP_DIR = tempfile.TemporaryDirectory()
    atexit.register(_TMP_DIR.cleanup)
    os.environ["DB_PATH"] = str(Path(_TMP_DIR.name) / "test_me_export.db")

from app import auth, crypto, db as db_mod, main  # noqa: E402


def _directives(response) -> set[str]:
    header = response.headers.get("cache-control", "")
    return {part.strip().lower() for part in header.split(",") if part.strip()}


class PatientExportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client_a = TestClient(main.app, client=("203.0.113.70", 50000))
        cls.client_b = TestClient(main.app, client=("203.0.113.71", 50000))

    def _sign_in_patient(self, client: TestClient, phone: str) -> tuple[int, dict[str, str]]:
        prev = os.environ.get("TEST_OTP_NUMBERS")
        os.environ["TEST_OTP_NUMBERS"] = f"{phone}:123456"
        try:
            self.assertEqual(client.post("/api/auth/request-otp", json={"phone": phone}).status_code, 200)
            res = client.post("/api/auth/verify-otp", json={"phone": phone, "code": "123456"})
            self.assertEqual(res.status_code, 200, res.text)
            data = res.json()
            with db_mod.get_db() as db:
                row = db.execute("SELECT id FROM users WHERE phone_bidx = ?", (crypto.blind_index(phone),)).fetchone()
                self.assertIsNotNone(row)
                uid = row["id"]
            return uid, {"Authorization": f"Bearer {data['token']}"}
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

    def _assert_no_store(self, response):
        directives = _directives(response)
        for required in ("no-store", "no-cache", "must-revalidate", "private"):
            self.assertIn(required, directives, f"Missing {required} in {response.headers}")
        self.assertEqual(response.headers.get("pragma"), "no-cache")
        self.assertEqual(response.headers.get("x-content-type-options"), "nosniff")
        self.assertEqual(response.headers.get("x-frame-options"), "DENY")

    def test_requires_patient_auth_and_blocks_caching_even_on_errors(self):
        unauth = self.client_a.get("/api/me/export")
        self.assertEqual(unauth.status_code, 401)
        self._assert_no_store(unauth)

        bad_jwt = self.client_a.get("/api/me/export", headers={"Authorization": "Bearer not.a.jwt"})
        self.assertEqual(bad_jwt.status_code, 401)
        self._assert_no_store(bad_jwt)

        _, doc_headers = self._create_doctor("+919877770091", "Dr. Export Auth")
        doc_resp = self.client_a.get("/api/me/export", headers=doc_headers)
        self.assertEqual(doc_resp.status_code, 403, doc_resp.text)
        self._assert_no_store(doc_resp)

        admin_tok = jwt.encode({"role": "admin", "exp": int(time.time()) + 60}, auth.JWT_SECRET, algorithm="HS256")
        admin_resp = self.client_a.get("/api/me/export", headers={"Authorization": f"Bearer {admin_tok}"})
        self.assertEqual(admin_resp.status_code, 403, admin_resp.text)
        self._assert_no_store(admin_resp)

    def test_exports_complete_decrypted_patient_data_without_leaks(self):
        patient_a_id, headers_a = self._sign_in_patient(self.client_a, "+919877770001")
        patient_b_id, headers_b = self._sign_in_patient(self.client_b, "+919877770002")
        doc_phone = "+919877770099"
        doc_id, _ = self._create_doctor(doc_phone, "Dr.Kavya Export")

        # Populate Patient A across every patient-owned table.
        self.assertEqual(
            self.client_a.put(
                "/api/me/state",
                json={
                    "user": {
                        "name": "Asha Export Patient",
                        "dob": "1995-04-12",
                        "lifeStage": "reproductive",
                        "goal": "track_cycle_and_pcos",
                        "isOnboarded": True,
                    },
                    "cycle": {
                        "lastPeriodStart": "2026-10-15",
                        "cycleLength": 30,
                        "periodLength": 6,
                        "loggedDays": {
                            "2026-10-16": {"flow": "medium", "symptoms": ["CANARY_A_CYCLE_CRAMP"]},
                        },
                    },
                    "pregnancy": {
                        "lastPeriodStart": None,
                        "dueDateOverride": None,
                        "prePregnancyWeightKg": 56.5,
                        "heightCm": 162.0,
                        "trustedContacts": [{"name": "Meera Sister", "phone": "+919800010001"}],
                        "weightLogs": [{"date": "2026-10-20", "kg": 57.0}],
                        "kickCounts": {"2026-10-20": 8},
                        "loggedDays": {
                            "2026-10-20": {"mood": "calm", "valence": 2, "symptoms": ["CANARY_A_PREG_SYM"]},
                        },
                    },
                    "settings": {
                        "notifications": False,
                        "anonymousMode": True,
                        "identityWarningSeen": 1,
                        "weightTracking": True,
                        "conceiveMode": False,
                        "pregnancyMode": False,
                    },
                },
                headers=headers_a,
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client_a.put(
                "/api/me/health",
                json={"conditions": ["PCOS"], "allergies": ["Penicillin"], "bloodGroup": "B+"},
                headers=headers_a,
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client_a.post(
                "/api/me/history/items",
                json={"category": "procedures", "data": {"name": "CANARY_A_SURGERY", "year": "2022"}},
                headers=headers_a,
            ).status_code,
            201,
        )
        self.assertEqual(
            self.client_a.post(
                "/api/me/screenings",
                json={"tool": "phq9", "score": 6, "answers": [1, 1, 0, 2, 0, 1, 1, 0, 0]},
                headers=headers_a,
            ).status_code,
            201,
        )

        # Patient B populates isolated data that MUST NOT appear in A's export.
        self.assertEqual(
            self.client_b.patch(
                "/api/me",
                json={"name": "CANARY_B_PRIVATE_NAME", "dob": "1991-09-09", "isOnboarded": True},
                headers=headers_b,
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client_b.put(
                "/api/me/health",
                json={"conditions": ["CANARY_B_CONDITION"], "allergies": ["CANARY_B_ALLERGY"], "bloodGroup": "AB-"},
                headers=headers_b,
            ).status_code,
            200,
        )

        # Mood + journal for both users.
        mood_a = self.client_a.post(
            "/api/mood",
            json={
                "date": "2026-10-25",
                "loggedAt": "2026-10-25T09:00:00Z",
                "scope": "moment",
                "valence": -1,
                "intensity": -1.5,
                "word": "tense",
                "words": ["tense", "tired"],
                "factors": ["sleep"],
                "source": "checkin",
            },
            headers=headers_a,
        )
        self.assertEqual(mood_a.status_code, 201)
        mood_a_id = mood_a.json()["id"]

        self.assertEqual(
            self.client_a.post(
                "/api/journal",
                json={
                    "date": "2026-10-25",
                    "text": "CANARY_A_JOURNAL_SECRET",
                    "tags": ["menstruation"],
                    "moodLogId": mood_a_id,
                    "context": {"cycleDay": 11},
                    "bringToAppointment": True,
                },
                headers=headers_a,
            ).status_code,
            201,
        )
        self.assertEqual(
            self.client_b.post(
                "/api/journal",
                json={"date": "2026-10-25", "text": "CANARY_B_JOURNAL_SECRET", "tags": ["menstruation"]},
                headers=headers_b,
            ).status_code,
            201,
        )

        # Insurance + Intake for A and B.
        self.assertEqual(
            self.client_a.put(
                "/api/insurance",
                json={
                    "country": "IN",
                    "payerType": "private",
                    "insurer": "Star Care",
                    "planName": "Women Plus",
                    "policyNumber": "POL-A-99887766",
                    "memberId": "MEM-A-44332211",
                    "groupNumber": "GRP-A-10",
                    "policyHolder": "Asha Export Patient",
                    "relationship": "self",
                    "validTill": "2028-01-01",
                    "tpa": "MediAssist",
                    "notes": "CANARY_A_INSURANCE_NOTE",
                },
                headers=headers_a,
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client_b.put(
                "/api/insurance",
                json={
                    "country": "IN",
                    "payerType": "private",
                    "insurer": "Other Insurer",
                    "policyNumber": "POL-B-CANARY-SECRET",
                    "memberId": "MEM-B-CANARY-SECRET",
                },
                headers=headers_b,
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client_a.post(
                "/api/intake/homeopathy",
                json={"answers": {"chiefComplaint": "CANARY_A_INTAKE_COMPLAINT"}, "skippedSections": ["none"]},
                headers=headers_a,
            ).status_code,
            201,
        )
        self.assertEqual(
            self.client_b.post(
                "/api/intake/ayurveda",
                json={"answers": {"chiefComplaint": "CANARY_B_INTAKE_COMPLAINT"}},
                headers=headers_b,
            ).status_code,
            201,
        )

        # Documents, SOS, Care, Appointments/Records/Payments, and Community.
        doc_a_data = "data:application/pdf;base64," + base64.b64encode(b"%PDF-1.4\nCANARY_A_PDF\n").decode()
        doc_b_data = "data:application/pdf;base64," + base64.b64encode(b"%PDF-1.4\nCANARY_B_PDF\n").decode()
        self.assertEqual(
            self.client_a.post(
                "/api/me/documents",
                json={"title": "CANARY_A_DOC_TITLE", "kind": "lab", "data": doc_a_data},
                headers=headers_a,
            ).status_code,
            201,
        )
        self.assertEqual(
            self.client_b.post(
                "/api/me/documents",
                json={"title": "CANARY_B_DOC_TITLE", "kind": "lab", "data": doc_b_data},
                headers=headers_b,
            ).status_code,
            201,
        )

        self.assertEqual(
            self.client_a.post(
                "/api/me/sos/contacts",
                json={"name": "CANARY_A_SOS_NAME", "phone": "+919811112222", "relation": "Sister"},
                headers=headers_a,
            ).status_code,
            201,
        )
        self.assertEqual(
            self.client_a.post(
                "/api/me/sos/alerts",
                json={"message": "CANARY_A_SOS_ALERT", "sentTo": ["+919811112222"], "isTest": True},
                headers=headers_a,
            ).status_code,
            201,
        )
        self.assertEqual(
            self.client_b.post(
                "/api/me/sos/contacts",
                json={"name": "CANARY_B_SOS_NAME", "phone": "+919822223333", "relation": "Friend"},
                headers=headers_b,
            ).status_code,
            201,
        )

        share_a = self.client_a.post(
            "/api/me/care/shares",
            json={"label": "CANARY_A_CARE_LABEL", "scopes": ["appointments", "medicines"]},
            headers=headers_a,
        )
        self.assertEqual(share_a.status_code, 201)
        share_b = self.client_b.post(
            "/api/me/care/shares",
            json={"label": "CANARY_B_CARE_LABEL", "scopes": ["appointments"]},
            headers=headers_b,
        )
        self.assertEqual(share_b.status_code, 201)
        # Opening each share link and posting a caretaker note records care_events for its owner.
        self.assertEqual(self.client_a.get(f"/api/care/{share_a.json()['token']}").status_code, 200)
        self.assertEqual(
            self.client_a.post(
                f"/api/care/{share_a.json()['token']}/notes",
                json={"text": "CANARY_A_CARE_NOTE"},
            ).status_code,
            201,
        )
        self.assertEqual(
            self.client_b.post(
                f"/api/care/{share_b.json()['token']}/notes",
                json={"text": "CANARY_B_CARE_NOTE"},
            ).status_code,
            201,
        )

        # Community post by B -> blocked by A; pending/legacy-ciphertext post by A -> exported decrypted.
        post_b = self.client_b.post(
            "/api/community/posts",
            json={"text": "CANARY_B_COMMUNITY_POST", "tags": ["menstruation"], "isAnonymous": True},
            headers=headers_b,
        )
        self.assertEqual(post_b.status_code, 201)
        post_b_id = post_b.json()["id"]
        self.assertEqual(
            self.client_a.post(f"/api/community/posts/{post_b_id}/block-author", headers=headers_a).status_code,
            200,
        )
        post_a_poll = self.client_a.post(
            "/api/community/posts",
            json={
                "type": "poll",
                "text": "CANARY_A_COMMUNITY_POLL",
                "pollOptions": ["Morning", "Evening"],
                "tags": ["menstruation"],
                "isAnonymous": True,
            },
            headers=headers_a,
        )
        self.assertEqual(post_a_poll.status_code, 201)
        self.assertEqual(
            self.client_a.post(
                f"/api/community/posts/{post_a_poll.json()['id']}/vote",
                json={"optionIndex": 1},
                headers=headers_a,
            ).status_code,
            200,
        )

        # Direct clinical/record/meds/payment/appointment seed + OTP code row for A.
        appt_a_id = f"appt_{secrets.token_hex(6)}"
        appt_b_id = f"appt_{secrets.token_hex(6)}"
        med_a_id = f"med_{secrets.token_hex(6)}"
        post_a_pending_id = f"post_{secrets.token_hex(6)}"
        with db_mod.get_db() as db:
            db.execute(
                "UPDATE patient_charts SET family_history = ? WHERE user_id = ?",
                (crypto.enc("CANARY_A_FAMILY_CHART"), patient_a_id),
            )
            db.execute(
                """INSERT INTO appointments
                     (id, user_id, doctor_id, date, time, reason, consult_mode, amount_inr, status, anonymous)
                   VALUES (?, ?, ?, '2026-12-01', '10:00 AM', ?, 'video', 600, 'completed', 0)""",
                (appt_a_id, patient_a_id, doc_id, crypto.enc("CANARY_A_APPT_REASON")),
            )
            db.execute(
                """INSERT INTO appointments
                     (id, user_id, doctor_id, date, time, reason, consult_mode, amount_inr, status, anonymous)
                   VALUES (?, ?, ?, '2026-12-02', '11:00 AM', ?, 'video', 600, 'confirmed', 1)""",
                (appt_b_id, patient_b_id, doc_id, crypto.enc("CANARY_B_APPT_REASON")),
            )
            rec_a_id = db.execute(
                """INSERT INTO consultation_records
                     (appointment_id, doctor_id, user_id, diagnosis, notes, vitals, prescription, follow_up)
                   VALUES (?, ?, ?, ?, ?, ?, ?, '2026-12-15')""",
                (
                    appt_a_id,
                    doc_id,
                    patient_a_id,
                    crypto.enc("CANARY_A_DIAGNOSIS"),
                    crypto.enc("CANARY_A_CLINICAL_NOTES"),
                    crypto.enc_json({"bp": "118/78"}),
                    crypto.enc_json([{"name": "Iron Tablet", "dose": "60mg"}]),
                ),
            ).lastrowid
            db.execute(
                """INSERT INTO payments (id, appointment_id, user_id, provider, order_id, amount_inr, status)
                   VALUES (?, ?, ?, 'razorpay', 'order_a_canary', 600, 'paid')""",
                (f"pay_{secrets.token_hex(6)}", appt_a_id, patient_a_id),
            )
            db.execute(
                """INSERT INTO history_shares (appointment_id, user_id, doctor_id, mode, categories)
                   VALUES (?, ?, ?, 'selected', '["conditions","allergies"]')""",
                (appt_a_id, patient_a_id, doc_id),
            )
            db.execute(
                """INSERT INTO history_requests (id, appointment_id, user_id, doctor_id, categories, message, status)
                   VALUES (?, ?, ?, ?, '["documents"]', ?, 'pending')""",
                (f"req_{secrets.token_hex(6)}", appt_a_id, patient_a_id, doc_id, crypto.enc("CANARY_A_REQ_MSG")),
            )
            db.execute(
                """INSERT INTO medications
                     (id, user_id, name, dose, frequency, times, started_on, source, record_id, doctor_name)
                   VALUES (?, ?, ?, ?, ?, '["08:00"]', '2026-10-25', 'prescription', ?, ?)""",
                (
                    med_a_id,
                    patient_a_id,
                    crypto.enc("CANARY_A_MED_IRON"),
                    crypto.enc("60mg"),
                    crypto.enc("once daily"),
                    rec_a_id,
                    crypto.enc("Dr.Kavya Export"),
                ),
            )
            db.execute(
                """INSERT INTO medication_doses (user_id, medication_id, date, slot, taken_at)
                   VALUES (?, ?, '2026-10-25', '08:00', '2026-10-25T08:05:00Z')""",
                (patient_a_id, med_a_id),
            )
            db.execute(
                """INSERT INTO community_posts
                     (id, author_id, is_anonymous, tags, type, text, moderation_status)
                   VALUES (?, ?, 1, '["cycle"]', 'text', ?, 'pending')""",
                (post_a_pending_id, patient_a_id, crypto.enc("CANARY_A_PENDING_LEGACY_POST")),
            )
            db.execute(
                """INSERT OR REPLACE INTO otp_codes (phone, code_hash, expires_at, attempts, sent_count, last_sent)
                   VALUES ('+919877770001', 'SECRET_OTP_HASH_CANARY', 9999999999.0, 0, 1, 9999999000.0)"""
            )

        resp = self.client_a.get("/api/me/export", headers=headers_a)
        self.assertEqual(resp.status_code, 200, resp.text)
        self._assert_no_store(resp)
        self.assertIn("application/json", resp.headers.get("content-type", ""))
        self.assertIn("attachment", resp.headers.get("content-disposition", "").lower())
        self.assertIn(".json", resp.headers.get("content-disposition", "").lower())

        raw_text = resp.text
        data = resp.json()

        # Zero ciphertext markers anywhere in exported payload.
        self.assertNotIn("enc:v1:", raw_text)

        # Zero internal secrets / practitioner phone / Patient B canaries anywhere.
        forbidden = [
            "SECRET_OTP_HASH_CANARY",
            "phone_bidx",
            "phoneBidx",
            doc_phone,
            "CANARY_B_PRIVATE_NAME",
            "CANARY_B_CONDITION",
            "CANARY_B_ALLERGY",
            "CANARY_B_JOURNAL_SECRET",
            "POL-B-CANARY-SECRET",
            "MEM-B-CANARY-SECRET",
            "CANARY_B_INTAKE_COMPLAINT",
            "CANARY_B_DOC_TITLE",
            "CANARY_B_PDF",
            "CANARY_B_SOS_NAME",
            "CANARY_B_CARE_LABEL",
            "CANARY_B_CARE_NOTE",
            "CANARY_B_COMMUNITY_POST",
            "CANARY_B_APPT_REASON",
        ]
        for secret in forbidden:
            self.assertNotIn(secret, raw_text)

        # Verify expected sections and decoded patient A canaries.
        self.assertEqual(data["exportVersion"], 1)
        self.assertIn("exportedAt", data)
        self.assertEqual(data["profile"]["name"], "Asha Export Patient")
        self.assertEqual(data["profile"]["goal"], "track_cycle_and_pcos")
        self.assertEqual(data["cycle"]["loggedDays"]["2026-10-16"]["symptoms"], ["CANARY_A_CYCLE_CRAMP"])
        self.assertEqual(data["pregnancy"]["loggedDays"]["2026-10-20"]["symptoms"], ["CANARY_A_PREG_SYM"])
        self.assertEqual(data["health"]["bloodGroup"], "B+")
        self.assertEqual(data["health"]["selfDeclared"], ["PCOS"])
        self.assertEqual(data["health"]["familyHistory"], "CANARY_A_FAMILY_CHART")
        self.assertEqual(data["health"]["history"]["procedures"][0]["name"], "CANARY_A_SURGERY")
        self.assertEqual(data["screenings"][0]["answers"], [1, 1, 0, 2, 0, 1, 1, 0, 0])
        self.assertEqual(data["medications"]["items"][0]["name"], "CANARY_A_MED_IRON")
        self.assertEqual(data["medications"]["doses"][0]["medicationId"], med_a_id)
        self.assertEqual(data["appointments"][0]["reason"], "CANARY_A_APPT_REASON")
        self.assertEqual(data["appointments"][0]["record"]["diagnosis"], "CANARY_A_DIAGNOSIS")
        self.assertEqual(data["appointments"][0]["record"]["notes"], "CANARY_A_CLINICAL_NOTES")
        self.assertEqual(data["payments"][0]["orderId"], "order_a_canary")
        self.assertEqual(data["documents"][0]["title"], "CANARY_A_DOC_TITLE")
        self.assertEqual(data["documents"][0]["data"], doc_a_data)
        self.assertEqual(data["historyShares"][0]["appointmentId"], appt_a_id)
        self.assertEqual(data["historyRequests"][0]["message"], "CANARY_A_REQ_MSG")
        self.assertEqual(data["journal"][0]["text"], "CANARY_A_JOURNAL_SECRET")
        self.assertEqual(data["moodLogs"][0]["words"], ["tense", "tired"])
        self.assertEqual(data["intakeSubmissions"][0]["answers"]["chiefComplaint"], "CANARY_A_INTAKE_COMPLAINT")
        self.assertEqual(data["insurance"]["policyNumber"], "POL-A-99887766")
        self.assertEqual(data["insurance"]["notes"], "CANARY_A_INSURANCE_NOTE")
        self.assertEqual(data["sos"]["contacts"][0]["name"], "CANARY_A_SOS_NAME")
        self.assertEqual(data["sos"]["alerts"][0]["message"], "CANARY_A_SOS_ALERT")
        self.assertEqual(data["care"]["shares"][0]["label"], "CANARY_A_CARE_LABEL")
        self.assertIn("CANARY_A_CARE_NOTE", [e["summary"] for e in data["care"]["events"]])

        # Community exports A's own posts decrypted + handle + blocked count, never blocked_id.
        community = data["community"]
        self.assertIsNotNone(community["anonHandle"])
        self.assertNotIn("blockedIds", community)
        self.assertEqual(community["blockedAuthorsCount"], 1)
        post_texts = {p["text"] for p in community["posts"]}
        self.assertIn("CANARY_A_COMMUNITY_POLL", post_texts)
        self.assertIn("CANARY_A_PENDING_LEGACY_POST", post_texts)
        self.assertEqual(community["pollVotes"], [{"postId": post_a_poll.json()["id"], "optionIndex": 1}])

        # Verify audit entry recorded without leaking PHI.
        with db_mod.get_db() as db:
            audit_rows = db.execute(
                """SELECT * FROM medical_audit_logs
                   WHERE actor_type = 'patient' AND actor_id = ? AND action = 'export'""",
                (patient_a_id,),
            ).fetchall()
            self.assertGreaterEqual(len(audit_rows), 1)
            self.assertEqual(audit_rows[-1]["outcome"], "granted")
            self.assertEqual(audit_rows[-1]["status_code"], 200)

    def test_minimal_new_user_export_returns_empty_collections_cleanly(self):
        _, headers_min = self._sign_in_patient(self.client_a, "+919877770003")
        resp = self.client_a.get("/api/me/export", headers=headers_min)
        self.assertEqual(resp.status_code, 200, resp.text)
        self._assert_no_store(resp)
        data = resp.json()
        self.assertEqual(data["exportVersion"], 1)
        self.assertEqual(data["appointments"], [])
        self.assertEqual(data["documents"], [])
        self.assertEqual(data["journal"], [])
        self.assertEqual(data["moodLogs"], [])
        self.assertEqual(data["medications"], {"items": [], "doses": []})
        self.assertIsNone(data["insurance"])
        self.assertEqual(data["community"]["blockedAuthorsCount"], 0)
        self.assertIsNone(data["community"]["anonHandle"])


if __name__ == "__main__":
    unittest.main()
