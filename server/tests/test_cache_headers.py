"""HTTP Cache-Control and security header tests for server/app/main.py."""
import atexit
import os
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
    os.environ["DB_PATH"] = str(Path(_TMP_DIR.name) / "test_cache_headers.db")

from app import main  # noqa: E402


def _directives(response) -> set[str]:
    header = response.headers.get("cache-control", "")
    return {part.strip().lower() for part in header.split(",") if part.strip()}


class CacheHeadersTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(main.app)

    def _assert_no_store(self, response, label: str = ""):
        directives = _directives(response)
        for required in ("no-store", "no-cache", "must-revalidate", "private"):
            self.assertIn(required, directives, f"{label} missing {required}: {response.headers}")
        self.assertEqual(response.headers.get("pragma"), "no-cache", f"{label} missing Pragma: no-cache")
        self.assertEqual(response.headers.get("x-content-type-options"), "nosniff")
        self.assertEqual(response.headers.get("x-frame-options"), "DENY")

    def _assert_public_cacheable(self, response, label: str = ""):
        directives = _directives(response)
        self.assertNotIn("no-store", directives, f"{label} unexpectedly set no-store: {response.headers}")
        self.assertEqual(response.headers.get("x-content-type-options"), "nosniff")
        self.assertEqual(response.headers.get("x-frame-options"), "DENY")

    def _sign_in_patient(self, phone: str = "+919876543210") -> dict[str, str]:
        prev_test_numbers = os.environ.get("TEST_OTP_NUMBERS")
        os.environ["TEST_OTP_NUMBERS"] = f"{phone}:123456"
        try:
            otp_req = self.client.post("/api/auth/request-otp", json={"phone": phone})
            self.assertEqual(otp_req.status_code, 200, otp_req.text)
            self._assert_no_store(otp_req, "POST /api/auth/request-otp")
            code = otp_req.json().get("devCode")
            self.assertEqual(code, "123456")

            otp_ver = self.client.post("/api/auth/verify-otp", json={"phone": phone, "code": code})
            self.assertEqual(otp_ver.status_code, 200, otp_ver.text)
            self._assert_no_store(otp_ver, "POST /api/auth/verify-otp")
            token = otp_ver.json()["token"]
            return {"Authorization": f"Bearer {token}"}
        finally:
            if prev_test_numbers is None:
                os.environ.pop("TEST_OTP_NUMBERS", None)
            else:
                os.environ["TEST_OTP_NUMBERS"] = prev_test_numbers

    def test_sensitive_patient_endpoints_set_no_store(self):
        headers = self._sign_in_patient()
        sensitive_get_paths = (
            "/api/me",
            "/api/me/history",
            "/api/me/medications",
            "/api/me/sos/contacts",
            "/api/appointments",
            "/api/intake",
            "/api/insurance",
            "/api/journal",
            "/api/mood",
            "/api/community/feed",
        )
        for path in sensitive_get_paths:
            with self.subTest(path=path):
                resp = self.client.get(path, headers=headers)
                self.assertEqual(resp.status_code, 200, resp.text)
                self._assert_no_store(resp, f"GET {path}")

    def test_error_practitioner_admin_and_mutation_responses_set_no_store(self):
        sensitive_requests = (
            ("GET", "/api/me", None),
            ("GET", "/api/doctor/me", None),
            ("GET", "/api/doctor/patients/1/chart", None),
            ("GET", "/api/care/unknown-token", None),
            ("GET", "/api/nonexistent-endpoint", None),
            ("POST", "/api/admin/login", {"password": "wrong-password"}),
            ("POST", "/api/doctors", {"name": "Unauthorized"}),
        )
        for method, path, body in sensitive_requests:
            with self.subTest(method=method, path=path):
                resp = self.client.request(method, path, json=body)
                self.assertIn(resp.status_code, (401, 403, 404, 422), resp.text)
                self._assert_no_store(resp, f"{method} {path}")

    def test_public_catalog_and_non_api_routes_omit_no_store(self):
        self._assert_public_cacheable(self.client.get("/"), "GET /")
        self._assert_public_cacheable(self.client.get("/api/health"), "GET /api/health")
        self._assert_public_cacheable(self.client.head("/api/health"), "HEAD /api/health")
        self._assert_public_cacheable(self.client.get("/api/camps/types"), "GET /api/camps/types")

        doctors_resp = self.client.get("/api/doctors")
        self.assertEqual(doctors_resp.status_code, 200, doctors_resp.text)
        self._assert_public_cacheable(doctors_resp, "GET /api/doctors")
        doctors = doctors_resp.json()
        if doctors:
            doc_id = doctors[0]["id"]
            self._assert_public_cacheable(
                self.client.get(f"/api/doctors/{doc_id}"),
                f"GET /api/doctors/{doc_id}",
            )
            self._assert_public_cacheable(
                self.client.get(f"/api/doctors/{doc_id}/slots"),
                f"GET /api/doctors/{doc_id}/slots",
            )

        camps_resp = self.client.get("/api/camps")
        self.assertEqual(camps_resp.status_code, 200, camps_resp.text)
        self._assert_public_cacheable(camps_resp, "GET /api/camps")
        camps = camps_resp.json()
        if camps:
            camp_id = camps[0]["id"]
            self._assert_public_cacheable(
                self.client.get(f"/api/camps/{camp_id}"),
                f"GET /api/camps/{camp_id}",
            )

    def test_traversal_encoded_slash_and_similar_prefixes_fail_closed(self):
        from starlette.requests import Request

        tricky_paths = (
            "/api/doctors/../me",
            "/api/doctors/%2e%2e/me",
            "/api/doctors/1%2fsecret",
            "/api/camps/..%5cme",
            "/api/doctors//slots",
            "/api/doctor/patients",
        )
        for path in tricky_paths:
            with self.subTest(path=path):
                resp = self.client.get(path)
                self._assert_no_store(resp, f"GET {path}")

                # Verify un-normalized raw_path bytes in ASGI scope also fail closed.
                scope = {
                    "type": "http",
                    "method": "GET",
                    "path": "/api/doctors/1",
                    "raw_path": path.encode("ascii"),
                    "headers": [],
                }
                if path == "/api/doctor/patients":
                    scope["path"] = path
                self.assertTrue(main._is_sensitive_api_request(Request(scope)), f"Expected raw_path {path} sensitive")


if __name__ == "__main__":
    unittest.main()
