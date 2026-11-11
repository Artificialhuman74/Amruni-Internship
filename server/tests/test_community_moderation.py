"""Community moderation, pending review queue, helpline, and report rate-limit tests."""
import atexit
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi.testclient import TestClient

_SERVER_DIR = Path(__file__).resolve().parent.parent
if str(_SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVER_DIR))

_TMP_DIR = None
if "app.db" not in sys.modules and "DB_PATH" not in os.environ:
    _TMP_DIR = tempfile.TemporaryDirectory()
    atexit.register(_TMP_DIR.cleanup)
    os.environ["DB_PATH"] = str(Path(_TMP_DIR.name) / "test_community_moderation.db")

from app import crypto, db as db_mod, main  # noqa: E402


class CommunityModerationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(main.app)

    def _create_user(self, phone: str, name: str) -> tuple[int, dict[str, str]]:
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

    def _post(self, headers: dict[str, str], text: str, *, reply_to_id: str | None = None, tags: list[str] | None = None):
        return self.client.post(
            "/api/community/posts",
            json={
                "type": "text",
                "text": text,
                "tags": tags if tags is not None else [],
                "isAnonymous": True,
                "replyToId": reply_to_id,
            },
            headers=headers,
        )

    def test_broader_moderation_rules_and_false_positive_guard(self):
        _, headers = self._create_user("+919900006001", "Author One")

        safe_res = self._post(headers, "My doctor prescribed pills for hypothyroidism and PCOS fatigue; did others feel better?")
        self.assertEqual(safe_res.status_code, 201, safe_res.text)
        safe_data = safe_res.json()
        self.assertEqual(safe_data.get("moderationStatus"), "approved")
        self.assertIsNone(safe_data.get("helpline"))

        rejected_cases = [
            ("k i l l   m y s e l f right now", True),
            ("Looking for painless ways to die tonight", True),
            ("Shut up you stupid bitch", False),
            ("Buy cheap pills online at https://spam.example/pills", False),
            ("Order abortion pills on WhatsApp +919876543210 guaranteed cure", False),
        ]
        for idx, (text, expect_helpline) in enumerate(rejected_cases):
            res = self._post(headers, text)
            self.assertEqual(res.status_code, 201, f"case {idx}: {res.text}")
            body = res.json()
            self.assertEqual(body.get("moderationStatus"), "rejected", f"expected rejected for {text!r}, got {body}")
            if expect_helpline:
                self.assertEqual((body.get("helpline") or {}).get("number"), "14416")
            else:
                self.assertIsNone(body.get("helpline"))

            # Rejected posts must never appear in the feed or single-post thread endpoint.
            feed_ids = [p["id"] for p in self.client.get("/api/community/feed", headers=headers).json()["posts"]]
            self.assertNotIn(body["id"], feed_ids)
            self.assertEqual(self.client.get(f"/api/community/posts/{body['id']}", headers=headers).status_code, 404)

    def test_high_risk_posts_go_to_pending_with_helpline_and_hide_reply_count(self):
        _, author_headers = self._create_user("+919900006002", "Author Two")
        _, viewer_headers = self._create_user("+919900006003", "Viewer Three")

        parent_res = self._post(author_headers, "How do you cope with postpartum exhaustion?")
        self.assertEqual(parent_res.status_code, 201)
        parent_id = parent_res.json()["id"]

        pending_cases = [
            ("I feel hopeless and I want to die lately", True),
            ("My husband hits me every night and I am scared at home", True),
            ("I took too many pills an hour ago and feel dizzy", True),
        ]
        for text, expect_helpline in pending_cases:
            res = self._post(author_headers, text, reply_to_id=parent_id)
            self.assertEqual(res.status_code, 201, res.text)
            body = res.json()
            self.assertEqual(body.get("moderationStatus"), "pending", f"expected pending for {text!r}, got {body}")
            if expect_helpline:
                helpline = body.get("helpline") or {}
                self.assertEqual(helpline.get("name"), "Tele-MANAS")
                self.assertEqual(helpline.get("number"), "14416")

            # Hidden from public feed & post view while pending
            feed_ids = [p["id"] for p in self.client.get("/api/community/feed", headers=viewer_headers).json()["posts"]]
            self.assertNotIn(body["id"], feed_ids)
            self.assertEqual(self.client.get(f"/api/community/posts/{body['id']}", headers=viewer_headers).status_code, 404)

        # Parent replyCount must NOT increment for pending or rejected replies
        rejected_reply = self._post(author_headers, "Visit https://spam.example for miracle cure", reply_to_id=parent_id)
        self.assertEqual(rejected_reply.status_code, 201)
        self.assertEqual(rejected_reply.json().get("moderationStatus"), "rejected")

        thread = self.client.get(f"/api/community/posts/{parent_id}", headers=viewer_headers)
        self.assertEqual(thread.status_code, 200)
        self.assertEqual(thread.json()["post"]["replyCount"], 0)
        self.assertEqual(thread.json()["replies"], [])

        # Journal share also applies moderation & attaches helpline
        j_res = self.client.post(
            "/api/journal",
            json={"date": "2026-11-11", "text": "Some days I don't want to live anymore", "tags": []},
            headers=author_headers,
        )
        self.assertEqual(j_res.status_code, 201, j_res.text)
        share_res = self.client.post(f"/api/journal/{j_res.json()['id']}/share", json={"isAnonymous": True}, headers=author_headers)
        self.assertEqual(share_res.status_code, 201, share_res.text)
        self.assertEqual(share_res.json().get("moderationStatus"), "pending")
        self.assertEqual((share_res.json().get("helpline") or {}).get("number"), "14416")

    def test_report_dedup_rate_limit_and_pending_threshold(self):
        _, author_headers = self._create_user("+919900006004", "Target Author")
        r1_id, r1_headers = self._create_user("+919900006005", "Reporter 1")
        _, r2_headers = self._create_user("+919900006006", "Reporter 2")
        _, r3_headers = self._create_user("+919900006007", "Reporter 3")

        posts = []
        for idx in range(7):
            res = self._post(author_headers, f"Community post number {idx} asking about sleep hygiene")
            self.assertEqual(res.status_code, 201)
            posts.append(res.json()["id"])

        target_post = posts[0]
        # Reporter 1 reports target_post once -> 201
        first = self.client.post(f"/api/community/posts/{target_post}/report", json={"reason": "off topic"}, headers=r1_headers)
        self.assertEqual(first.status_code, 201, first.text)

        # Duplicate report by same user on same post -> 409 Conflict
        dup = self.client.post(f"/api/community/posts/{target_post}/report", json={"reason": "repeat"}, headers=r1_headers)
        self.assertEqual(dup.status_code, 409, dup.text)

        # 4 more distinct posts (total 5 reports within 1h for r1) succeed
        for idx in range(1, 5):
            r = self.client.post(f"/api/community/posts/{posts[idx]}/report", json={"reason": "spam"}, headers=r1_headers)
            self.assertEqual(r.status_code, 201, f"report {idx + 1}: {r.text}")

        # 6th report within 1 hour by r1 -> 429 Too Many Requests
        over = self.client.post(f"/api/community/posts/{posts[5]}/report", json={"reason": "too many"}, headers=r1_headers)
        self.assertEqual(over.status_code, 429, over.text)

        # Backdating r1's oldest report beyond 1 hour opens capacity again
        old_ts = (datetime.now(timezone.utc) - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
        with db_mod.get_db() as db:
            db.execute(
                "UPDATE community_reports SET created_at = ? WHERE post_id = ? AND reporter_id = ?",
                (old_ts, posts[1], r1_id),
            )
        recovered = self.client.post(f"/api/community/posts/{posts[5]}/report", json={"reason": "ok now"}, headers=r1_headers)
        self.assertEqual(recovered.status_code, 201, recovered.text)

        # 3 distinct reporters push target_post into 'pending' (not permanently rejected) and hide it
        self.assertEqual(self.client.post(f"/api/community/posts/{target_post}/report", json={"reason": "harm"}, headers=r2_headers).status_code, 201)
        self.assertEqual(self.client.post(f"/api/community/posts/{target_post}/report", json={"reason": "harm"}, headers=r3_headers).status_code, 201)

        with db_mod.get_db() as db:
            row = db.execute("SELECT moderation_status FROM community_posts WHERE id = ?", (target_post,)).fetchone()
            self.assertEqual(row["moderation_status"], "pending")

        self.assertEqual(self.client.get(f"/api/community/posts/{target_post}", headers=r2_headers).status_code, 404)


if __name__ == "__main__":
    unittest.main()
