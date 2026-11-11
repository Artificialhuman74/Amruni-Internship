"""Startup fail-closed guard tests for server/app/auth.py and server/app/main.py."""
import base64
import json
import os
import secrets
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent


def _run_boot(extra_env: dict[str, str], code: str = "import app.main") -> subprocess.CompletedProcess[str]:
    """Import app.main in a clean subprocess with isolated DB_PATH and env."""
    with tempfile.TemporaryDirectory() as tmpdir:
        env = {
            "PATH": os.environ.get("PATH", ""),
            "DB_PATH": str(Path(tmpdir) / "test.db"),
            # Keep payment env vars populated so unrelated working-tree checks
            # in other modules never mask auth startup guards.
            "RAZORPAY_KEY_ID": "test_key_id",
            "RAZORPAY_KEY_SECRET": "test_key_secret",
        }
        env.update(extra_env)
        return subprocess.run(
            [sys.executable, "-c", code],
            cwd=SERVER_DIR,
            env=env,
            capture_output=True,
            text=True,
            timeout=30,
        )


def _valid_prod_env() -> dict[str, str]:
    return {
        "ENV": "production",
        "JWT_SECRET": secrets.token_urlsafe(32),
        "AMRUNI_DATA_KEY": base64.urlsafe_b64encode(os.urandom(32)).decode(),
    }


class StartupGuardsTests(unittest.TestCase):
    def test_prod_refuses_expose_otp(self):
        for flag in ("true", "1", "yes", "on"):
            with self.subTest(flag=flag):
                env = {**_valid_prod_env(), "EXPOSE_OTP": flag}
                res = _run_boot(env)
                self.assertNotEqual(res.returncode, 0)
                self.assertIn("EXPOSE_OTP", res.stderr)

    def test_prod_refuses_doctor_otp_disabled(self):
        for flag in ("true", "1", "yes", "on"):
            with self.subTest(flag=flag):
                env = {**_valid_prod_env(), "DOCTOR_OTP_DISABLED": flag}
                res = _run_boot(env)
                self.assertNotEqual(res.returncode, 0)
                self.assertIn("DOCTOR_OTP_DISABLED", res.stderr)

    def test_prod_refuses_default_admin_password(self):
        for pw in ("amruni", "Amruni", " amruni "):
            with self.subTest(pw=pw):
                env = {**_valid_prod_env(), "ADMIN_PASSWORD": pw}
                res = _run_boot(env)
                self.assertNotEqual(res.returncode, 0)
                self.assertIn("ADMIN_PASSWORD", res.stderr)

    def test_prod_refuses_missing_or_default_jwt_secret(self):
        for bad_secret in (None, "amruni-dev-secret-do-not-use-in-prod"):
            with self.subTest(has_secret=bad_secret is not None):
                env = _valid_prod_env()
                if bad_secret is None:
                    env.pop("JWT_SECRET")
                else:
                    env["JWT_SECRET"] = bad_secret
                res = _run_boot(env)
                self.assertNotEqual(res.returncode, 0)
                self.assertIn("JWT_SECRET", res.stderr)

    def test_prod_node_env_alias_enforced(self):
        env = _valid_prod_env()
        env.pop("ENV")
        env["NODE_ENV"] = "production"
        env["EXPOSE_OTP"] = "true"
        res = _run_boot(env)
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("EXPOSE_OTP", res.stderr)

    def test_prod_valid_with_unset_admin_password_and_false_flags(self):
        env = {
            **_valid_prod_env(),
            "EXPOSE_OTP": "false",
            "DOCTOR_OTP_DISABLED": "0",
        }
        code = (
            "from fastapi.testclient import TestClient\n"
            "import app.main as m\n"
            "c = TestClient(m.app)\n"
            "h = c.get('/api/health')\n"
            "l = c.post('/api/admin/login', json={'password': 'anything'})\n"
            "assert h.status_code == 200, h.text\n"
            "assert l.status_code == 503, l.text\n"
            "print(h.json()['env'], h.json()['exposeOtp'])\n"
        )
        res = _run_boot(env, code)
        self.assertEqual(res.returncode, 0, res.stderr)
        self.assertIn("production False", res.stdout)

    def test_prod_valid_with_custom_admin_password(self):
        custom_pw = f"non-default-{secrets.token_hex(8)}"
        env = {**_valid_prod_env(), "ADMIN_PASSWORD": custom_pw}
        code = (
            "import os\n"
            "from fastapi.testclient import TestClient\n"
            "import app.main as m\n"
            "c = TestClient(m.app)\n"
            "l = c.post('/api/admin/login', json={'password': os.environ['ADMIN_PASSWORD']})\n"
            "assert l.status_code == 200, l.text\n"
            "assert 'adminToken' in l.json()\n"
        )
        res = _run_boot(env, code)
        self.assertEqual(res.returncode, 0, res.stderr)

    def test_dev_mode_allows_demo_flags_and_default_password(self):
        for env_val in ("", "development"):
            with self.subTest(env=env_val):
                env = {
                    "EXPOSE_OTP": "true",
                    "DOCTOR_OTP_DISABLED": "true",
                    "ADMIN_PASSWORD": "amruni",
                }
                if env_val:
                    env["ENV"] = env_val
                code = (
                    "import json\n"
                    "from fastapi.testclient import TestClient\n"
                    "import app.main as m\n"
                    "c = TestClient(m.app)\n"
                    "h = c.get('/api/health')\n"
                    "assert h.status_code == 200, h.text\n"
                    "print(json.dumps(h.json()))\n"
                )
                res = _run_boot(env, code)
                self.assertEqual(res.returncode, 0, res.stderr)
                payload = json.loads(res.stdout.strip().splitlines()[-1])
                self.assertEqual(payload["env"], "development")
                self.assertTrue(payload["exposeOtp"])

    def test_main_startup_calls_auth_validate_prod_config(self):
        code = (
            "import app.auth as auth\n"
            "import app.main as main\n"
            "auth.IS_PROD = True\n"
            "auth.EXPOSE_OTP = True\n"
            "try:\n"
            "    main._startup()\n"
            "except RuntimeError as exc:\n"
            "    assert 'EXPOSE_OTP' in str(exc)\n"
            "else:\n"
            "    raise AssertionError('Expected RuntimeError from main._startup()')\n"
        )
        res = _run_boot({"ENV": "development", "JWT_SECRET": secrets.token_urlsafe(32)}, code)
        self.assertEqual(res.returncode, 0, res.stderr)


if __name__ == "__main__":
    unittest.main()
