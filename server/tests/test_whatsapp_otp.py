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

_SERVER_DIR = Path(__file__).resolve().parent.parent
if str(_SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVER_DIR))

_TMP_DIR = None
if "app.db" not in sys.modules and "DB_PATH" not in os.environ:
    _TMP_DIR = tempfile.TemporaryDirectory()
    atexit.register(_TMP_DIR.cleanup)
    os.environ["DB_PATH"] = str(Path(_TMP_DIR.name) / "test_whatsapp_otp.db")

from app import auth, main  # noqa: E402


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
        # Reset provider to default console SMS provider (no manual test override).
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
            self.assertTrue(auth.send_otp("+919876543210", "246810", channel="sms"))
            # SMS channel does not hit Meta WhatsApp API.
            self.assertEqual(post_mock.call_count, 1)


if __name__ == "__main__":
    unittest.main()

