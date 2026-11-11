"""Tests for the Meta WhatsApp Cloud API OTP provider adapter using mocked HTTP clients."""
import atexit
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import httpx

from fastapi.testclient import TestClient

_SERVER_DIR = Path(__file__).resolve().parent.parent
if str(_SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVER_DIR))

_TMP_DIR = None
if "app.db" not in sys.modules and "DB_PATH" not in os.environ:
    _TMP_DIR = tempfile.TemporaryDirectory()
    atexit.register(_TMP_DIR.cleanup)
    os.environ["DB_PATH"] = str(Path(_TMP_DIR.name) / "test_whatsapp_otp.db")

from app import auth, db as db_mod, main  # noqa: E402


class MetaWhatsAppOtpProviderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        _ = main.app

    def setUp(self):
        self.orig_provider = auth.get_otp_provider()

    def tearDown(self):
        auth.set_otp_provider(self.orig_provider)

    def test_unconfigured_env_fails_closed_without_network_call(self):
        def fail_if_called(request):
            raise AssertionError(f"HTTP client should not be called when unconfigured: {request.url}")

        client = httpx.Client(transport=httpx.MockTransport(fail_if_called))
        with mock.patch.dict(os.environ, {}, clear=False):
            for key in ("WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_OTP_TEMPLATE"):
                os.environ.pop(key, None)

            provider = auth.MetaWhatsAppOtpProvider(http_client=client)
            self.assertFalse(provider.is_configured())
            self.assertFalse(provider.send("+919876543210", "123456", channel="whatsapp"))
            self.assertFalse(auth.send_otp("+919876543210", "123456", channel="whatsapp"))

    def test_sends_meta_template_from_env_vars_and_formats_recipient(self):
        captured = []

        def handler(request: httpx.Request) -> httpx.Response:
            captured.append({
                "method": request.method,
                "url": str(request.url),
                "auth": request.headers.get("authorization"),
                "body": json.loads(request.content.decode()),
            })
            return httpx.Response(200, json={"messages": [{"id": "wamid.HBgMOTE5ODc2NTQzMjEw"}]})

        client = httpx.Client(transport=httpx.MockTransport(handler))
        env = {
            "WHATSAPP_PHONE_NUMBER_ID": "10987654321",
            "WHATSAPP_ACCESS_TOKEN": "wa-test-token-placeholder",
            "WHATSAPP_OTP_TEMPLATE": "amruni_login_otp",
            "WHATSAPP_OTP_LANG": "en_US",
        }
        with mock.patch.dict(os.environ, env, clear=False):
            provider = auth.MetaWhatsAppOtpProvider(http_client=client)
            self.assertTrue(provider.is_configured())
            self.assertTrue(provider.send("9876543210", "654321", channel="whatsapp"))
            self.assertFalse(provider.send("9876543210", "654321", channel="sms"))

        self.assertEqual(len(captured), 1)
        req = captured[0]
        self.assertEqual(req["method"], "POST")
        self.assertEqual(req["url"], "https://graph.facebook.com/v21.0/10987654321/messages")
        self.assertEqual(req["auth"], "Bearer wa-test-token-placeholder")
        self.assertEqual(req["body"]["messaging_product"], "whatsapp")
        self.assertEqual(req["body"]["to"], "919876543210")
        self.assertEqual(req["body"]["template"]["name"], "amruni_login_otp")
        self.assertEqual(req["body"]["template"]["language"]["code"], "en_US")
        self.assertEqual(
            req["body"]["template"]["components"][0]["parameters"],
            [{"type": "text", "text": "654321"}],
        )

    def test_handles_http_errors_missing_message_id_and_transport_exceptions(self):
        responses = [
            httpx.Response(401, json={"error": {"message": "Invalid token"}}),
            httpx.Response(200, json={"messages": []}),
            httpx.Response(200, content=b"not-json"),
        ]

        def handler(request: httpx.Request) -> httpx.Response:
            if not responses:
                raise httpx.ConnectError("network down", request=request)
            return responses.pop(0)

        client = httpx.Client(transport=httpx.MockTransport(handler))
        env = {
            "WHATSAPP_PHONE_NUMBER_ID": "10987654321",
            "WHATSAPP_ACCESS_TOKEN": "wa-test-token-placeholder",
            "WHATSAPP_OTP_TEMPLATE": "amruni_login_otp",
        }
        with mock.patch.dict(os.environ, env, clear=False):
            provider = auth.MetaWhatsAppOtpProvider(http_client=client)
            self.assertFalse(provider.send("+919876543210", "111111", channel="whatsapp"))
            self.assertFalse(provider.send("+919876543210", "111111", channel="whatsapp"))
            self.assertFalse(provider.send("+919876543210", "111111", channel="whatsapp"))
            self.assertFalse(provider.send("+919876543210", "111111", channel="whatsapp"))

    def test_send_otp_routes_whatsapp_channel_using_env_via_mocked_httpx(self):
        # Reset provider to default (no manual test override).
        auth.set_otp_provider(auth.ConsoleOtpProvider(), override=False)
        env = {
            "WHATSAPP_PHONE_NUMBER_ID": "99887766",
            "WHATSAPP_ACCESS_TOKEN": "wa-token-placeholder",
            "WHATSAPP_OTP_TEMPLATE": "otp_code",
        }
        mock_resp = httpx.Response(200, json={"messages": [{"id": "wamid.123"}]})
        with mock.patch.dict(os.environ, env, clear=False), mock.patch.object(auth.httpx, "post", return_value=mock_resp) as post_mock:
            self.assertTrue(auth.send_otp("+919876543210", "246810", channel="whatsapp"))
            self.assertEqual(post_mock.call_count, 1)
            # SMS channel is removed and fails closed without calling Meta or Console.
            self.assertFalse(auth.send_otp("+919876543210", "246810", channel="sms"))
            self.assertEqual(post_mock.call_count, 1)

    def test_request_otp_defaults_to_whatsapp_and_verify_still_works(self):
        auth.set_otp_provider(auth.ConsoleOtpProvider(), override=False)
        env = {
            "WHATSAPP_PHONE_NUMBER_ID": "99887766",
            "WHATSAPP_ACCESS_TOKEN": "wa-token-placeholder",
            "WHATSAPP_OTP_TEMPLATE": "otp_code",
        }
        client = TestClient(main.app, client=("203.0.113.40", 50000))
        mock_resp = httpx.Response(200, json={"messages": [{"id": "wamid.req1"}]})
        with mock.patch.dict(os.environ, env, clear=False), mock.patch.object(auth.httpx, "post", return_value=mock_resp) as post_mock:
            res = client.post("/api/auth/request-otp", json={"phone": "+919876540001"})
            self.assertEqual(res.status_code, 200, res.text)
            body = res.json()
            self.assertTrue(body["sent"])
            self.assertEqual(body["channel"], "whatsapp")
            code = body.get("devCode")
            self.assertIsNotNone(code)
            self.assertEqual(post_mock.call_count, 1)

            # Verify step remains unchanged and exchanges the WhatsApp OTP for a JWT.
            ver = client.post("/api/auth/verify-otp", json={"phone": "+919876540001", "code": code})
            self.assertEqual(ver.status_code, 200, ver.text)
            self.assertTrue(ver.json().get("token"))

            with mock.patch.object(auth, "IS_PROD", True), mock.patch.object(auth, "EXPOSE_OTP", False):
                res_prod = client.post(
                    "/api/auth/request-otp",
                    json={"phone": "+919876540002", "channel": "whatsapp"},
                )
            self.assertEqual(res_prod.status_code, 200, res_prod.text)
            self.assertEqual(res_prod.json(), {"sent": True, "channel": "whatsapp"})
            self.assertEqual(post_mock.call_count, 2)

    def test_request_otp_rejects_sms_and_unknown_channels(self):
        client = TestClient(main.app, client=("203.0.113.41", 50000))
        for bad_channel in ("sms", "email", ""):
            res = client.post("/api/auth/request-otp", json={"phone": "+919876540003", "channel": bad_channel})
            self.assertEqual(res.status_code, 400, f"{bad_channel!r}: {res.text}")
        with db_mod.get_db() as db:
            self.assertIsNone(db.execute("SELECT 1 FROM otp_codes WHERE phone = ?", ("+919876540003",)).fetchone())

    def test_request_otp_whatsapp_failure_returns_503_with_no_sms_fallback_and_allows_retry(self):
        auth.set_otp_provider(auth.ConsoleOtpProvider(), override=False)
        env = {
            "WHATSAPP_PHONE_NUMBER_ID": "99887766",
            "WHATSAPP_ACCESS_TOKEN": "wa-token-placeholder",
            "WHATSAPP_OTP_TEMPLATE": "otp_code",
        }
        client = TestClient(main.app, client=("203.0.113.42", 50000))
        phone = "+919876540004"
        with mock.patch.dict(os.environ, env, clear=False), mock.patch.object(
            auth.httpx, "post", side_effect=[
                httpx.Response(502, json={"error": {"message": "Upstream down"}}),
                httpx.Response(200, json={"messages": [{"id": "wamid.retry"}]}),
            ]
        ) as post_mock:
            fail_res = client.post("/api/auth/request-otp", json={"phone": phone})
            self.assertEqual(fail_res.status_code, 503, fail_res.text)
            with db_mod.get_db() as db:
                self.assertIsNone(db.execute("SELECT 1 FROM otp_codes WHERE phone = ?", (phone,)).fetchone())

            # Since delivery failed, no 30s cooldown row blocks an immediate retry.
            ok_res = client.post("/api/auth/request-otp", json={"phone": phone})
            self.assertEqual(ok_res.status_code, 200, ok_res.text)
            self.assertEqual(post_mock.call_count, 2)

    def test_request_otp_unconfigured_fails_closed_in_prod_and_uses_console_in_dev(self):
        auth.set_otp_provider(auth.ConsoleOtpProvider(), override=False)
        client = TestClient(main.app, client=("203.0.113.43", 50000))
        with mock.patch.dict(os.environ, {}, clear=False):
            for key in ("WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_OTP_TEMPLATE"):
                os.environ.pop(key, None)

            with mock.patch.object(auth, "IS_PROD", True), mock.patch.object(auth, "EXPOSE_OTP", False):
                prod_res = client.post("/api/auth/request-otp", json={"phone": "+919876540005"})
            self.assertEqual(prod_res.status_code, 503, prod_res.text)

            dev_res = client.post("/api/auth/request-otp", json={"phone": "+919876540005"})
            self.assertEqual(dev_res.status_code, 200, dev_res.text)
            self.assertEqual(dev_res.json().get("channel"), "whatsapp")
            self.assertIsNotNone(dev_res.json().get("devCode"))


if __name__ == "__main__":
    unittest.main()

