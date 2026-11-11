"""Phone-OTP authentication issuing JWTs, plus FastAPI auth dependencies.

OTP codes are random 6-digit, stored as salted SHA-256 hashes, expire after
5 minutes, allow 5 verification attempts, and are rate-limited per phone.
Outside production the code is returned to the client so the app works
without an SMS gateway; wire one into send_sms() for launch.
"""
import hashlib
import hmac
import os
import secrets
import time
import re

import jwt
from fastapi import HTTPException, Request

from . import crypto
from .db import get_db

_TRUTHY_FLAGS = ("1", "true", "yes", "on")
_DEV_JWT_SECRETS = (
    "amruni-dev-secret-do-not-use-in-prod",
    "local-development-only-not-a-real-secret",
)
_DEV_ADMIN_PASSWORD = "amruni"


def _is_prod() -> bool:
    return (os.environ.get("ENV") or os.environ.get("NODE_ENV") or "").strip().lower() == "production"


def _env_flag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in _TRUTHY_FLAGS


IS_PROD = _is_prod()
# Development / demo escape hatch: return the OTP code to the client even in
# production. Lets the app be tested end-to-end before an SMS gateway is wired.
# Refused at startup in production.
EXPOSE_OTP = _env_flag("EXPOSE_OTP")
# Skips the code check on the practitioner console; refused at startup in production.
DOCTOR_OTP_DISABLED = _env_flag("DOCTOR_OTP_DISABLED")
JWT_SECRET = os.environ.get("JWT_SECRET", "").strip() or (None if IS_PROD else _DEV_JWT_SECRETS[0])

OTP_TTL = 5 * 60
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_COOLDOWN = 30
OTP_MAX_SENDS = 8
TOKEN_TTL = 30 * 24 * 3600
ADMIN_TOKEN_TTL = 12 * 3600

# Admin portal password. No production default: leaving it unset in production
# disables password login entirely (ADMIN_PHONES still works).
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "").strip() or (None if IS_PROD else _DEV_ADMIN_PASSWORD)


def validate_prod_config() -> None:
    """Fail closed in production when unsafe auth flags or dev defaults are present."""
    if not IS_PROD:
        return
    if not JWT_SECRET or JWT_SECRET in _DEV_JWT_SECRETS:
        raise RuntimeError("FATAL: JWT_SECRET must be set to a non-default secret in production.")
    if EXPOSE_OTP:
        raise RuntimeError("FATAL: EXPOSE_OTP must not be set in production.")
    if DOCTOR_OTP_DISABLED:
        raise RuntimeError("FATAL: DOCTOR_OTP_DISABLED must not be set in production.")
    if ADMIN_PASSWORD and ADMIN_PASSWORD.lower() == _DEV_ADMIN_PASSWORD:
        raise RuntimeError("FATAL: ADMIN_PASSWORD must not be the default value in production.")


validate_prod_config()

PHONE_RE = re.compile(r"^(\+?[1-9]\d{6,14}|[6-9]\d{9})$")


def is_valid_phone(phone: str) -> bool:
    return bool(phone and PHONE_RE.match(phone.strip()))


def _test_numbers() -> dict[str, str]:
    """Fixed-OTP test numbers, à la Firebase Auth. TEST_OTP_NUMBERS is a
    comma-separated list of `phone:code` pairs (6-digit codes). These numbers
    accept their fixed code without SMS — handy for developing the mobile app
    and for automated tests — while every other number goes through the normal
    random-OTP flow and cannot be impersonated."""
    out = {}
    for pair in os.environ.get("TEST_OTP_NUMBERS", "").split(","):
        pair = pair.strip()
        if ":" in pair:
            phone, code = pair.split(":", 1)
            phone, code = phone.strip(), code.strip()
            if PHONE_RE.match(phone) and code.isdigit() and len(code) == 6:
                out[phone] = code
    return out


def _hash_code(phone: str, code: str) -> str:
    return hashlib.sha256(f"{phone}:{code}:{JWT_SECRET}".encode()).hexdigest()


def send_sms(phone: str, code: str):
    # SMS gateway integration point (MSG91, Twilio, AWS SNS, ...).
    print(f"[otp] {phone} -> {code}")


def request_otp(phone: str) -> dict:
    now = time.time()
    with get_db() as db:
        row = db.execute("SELECT * FROM otp_codes WHERE phone = ?", (phone,)).fetchone()
        if row:
            if now - row["last_sent"] < OTP_RESEND_COOLDOWN:
                wait = int(OTP_RESEND_COOLDOWN - (now - row["last_sent"])) + 1
                raise HTTPException(429, f"Please wait {wait}s before requesting another code.")
            if row["sent_count"] >= OTP_MAX_SENDS and now < row["expires_at"]:
                raise HTTPException(429, "Too many codes requested. Try again later.")

        # Test numbers get their fixed code; everyone else a fresh random one.
        code = _test_numbers().get(phone) or f"{secrets.randbelow(900000) + 100000}"
        sent_count = row["sent_count"] + 1 if row and now < row["expires_at"] else 1
        db.execute(
            """INSERT INTO otp_codes (phone, code_hash, expires_at, attempts, sent_count, last_sent)
               VALUES (?, ?, ?, 0, ?, ?)
               ON CONFLICT(phone) DO UPDATE SET
                 code_hash = excluded.code_hash, expires_at = excluded.expires_at,
                 attempts = 0, sent_count = excluded.sent_count, last_sent = excluded.last_sent""",
            (phone, _hash_code(phone, code), now + OTP_TTL, sent_count, now),
        )
    # Test numbers never hit the SMS path; real numbers do (or the log fallback).
    is_test = phone in _test_numbers()
    if not is_test:
        send_sms(phone, code)
    # Return the code to the client when it's safe to: outside production, for a
    # designated test number (its code is fixed and known anyway), or when
    # EXPOSE_OTP is explicitly enabled for a demo build without an SMS gateway.
    if not IS_PROD or is_test or EXPOSE_OTP:
        return {"devCode": code}
    return {}


def _consume_otp(db, phone: str, code: str):
    """Validates and consumes the pending OTP for this phone, or raises."""
    now = time.time()
    row = db.execute("SELECT * FROM otp_codes WHERE phone = ?", (phone,)).fetchone()
    if not row:
        raise HTTPException(401, "No code was sent to this number. Request a new one.")
    if now > row["expires_at"]:
        db.execute("DELETE FROM otp_codes WHERE phone = ?", (phone,))
        raise HTTPException(401, "That code has expired. Request a new one.")
    if row["attempts"] >= OTP_MAX_ATTEMPTS:
        db.execute("DELETE FROM otp_codes WHERE phone = ?", (phone,))
        raise HTTPException(429, "Too many incorrect attempts. Request a new code.")

    if not hmac.compare_digest(row["code_hash"], _hash_code(phone, code)):
        db.execute("UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = ?", (phone,))
        raise HTTPException(401, "That code didn't match. Try again or request a new one.")

    db.execute("DELETE FROM otp_codes WHERE phone = ?", (phone,))


def verify_otp(phone: str, code: str) -> dict:
    """Returns {token, user_id}. Creates the account on first sign-in."""
    with get_db() as db:
        _consume_otp(db, phone, code)
        # Looked up by the deterministic index rather than the number itself,
        # which is stored encrypted and cannot be matched on directly.
        bidx = crypto.blind_index(phone)
        user = db.execute("SELECT * FROM users WHERE phone_bidx = ?", (bidx,)).fetchone()
        if not user:
            cur = db.execute(
                "INSERT INTO users (phone, phone_bidx) VALUES (?, ?)", (crypto.enc(phone), bidx)
            )
            uid = cur.lastrowid
            db.execute("INSERT INTO cycle_state (user_id) VALUES (?)", (uid,))
            db.execute("INSERT INTO pregnancy_state (user_id) VALUES (?)", (uid,))
            db.execute("INSERT INTO user_settings (user_id) VALUES (?)", (uid,))
        else:
            uid = user["id"]

    token = jwt.encode(
        {"sub": str(uid), "phone": phone, "exp": int(time.time()) + TOKEN_TTL},
        JWT_SECRET,
        algorithm="HS256",
    )
    return {"token": token, "user_id": uid}


# DOCTOR_OTP_DISABLED skips the code check on the practitioner console.
#
# What it does NOT remove: the number must still belong to a registered
# practitioner, and every patient-scoped endpoint still checks that she has an
# appointment with that doctor. What it does remove is the second factor — so
# with this on, anyone who knows a practitioner's phone number can read the
# charts of that practitioner's patients. Refused at startup in production.


def verify_doctor_otp(phone: str, code: str) -> dict:
    """Doctor sign-in: the phone must belong to a registered practitioner.
    Never creates an account."""
    clean_phone = phone.strip()
    with get_db() as db:
        doctor = db.execute("SELECT * FROM doctors WHERE phone = ?", (clean_phone,)).fetchone()
        if not doctor and clean_phone.startswith("+91"):
            doctor = db.execute("SELECT * FROM doctors WHERE phone = ?", (clean_phone[3:],)).fetchone()
        elif not doctor and len(clean_phone) == 10:
            doctor = db.execute("SELECT * FROM doctors WHERE phone = ?", (f"+91{clean_phone}",)).fetchone()

        if not doctor:
            raise HTTPException(403, "This number isn't registered as a practitioner on Amruni.")
        if not DOCTOR_OTP_DISABLED:
            _consume_otp(db, clean_phone, code)

    token = jwt.encode(
        {"role": "doctor", "did": doctor["id"], "phone": clean_phone, "exp": int(time.time()) + TOKEN_TTL},
        JWT_SECRET,
        algorithm="HS256",
    )
    return {"token": token, "doctor_id": doctor["id"]}


def current_doctor(request: Request) -> dict:
    """FastAPI dependency: resolves a doctor-role Bearer token to a doctor row."""
    header = request.headers.get("authorization", "")
    token = header[7:] if header.startswith("Bearer ") else None
    if not token:
        raise HTTPException(401, "Practitioner sign-in required.")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Session expired. Sign in again.")
    if payload.get("role") != "doctor":
        raise HTTPException(403, "Practitioner access only.")
    with get_db() as db:
        doctor = db.execute("SELECT * FROM doctors WHERE id = ?", (payload["did"],)).fetchone()
    if not doctor:
        raise HTTPException(401, "Practitioner account not found.")
    return dict(doctor)


def current_user(request: Request) -> dict:
    """FastAPI dependency: resolves the Bearer token to a user row (as dict)."""
    header = request.headers.get("authorization", "")
    token = header[7:] if header.startswith("Bearer ") else None
    if not token:
        raise HTTPException(401, "Authentication required.")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Session expired. Sign in again.")
    with get_db() as db:
        user = db.execute("SELECT * FROM users WHERE id = ?", (payload["sub"],)).fetchone()
    if not user:
        raise HTTPException(401, "Account not found.")
    return dict(user)


def admin_login(password: str) -> str:
    """Verifies the portal password and issues a short-lived admin token."""
    if not ADMIN_PASSWORD:
        raise HTTPException(503, "Admin login is not configured on this server.")
    if not hmac.compare_digest(password.encode(), ADMIN_PASSWORD.encode()):
        raise HTTPException(401, "Invalid admin password.")
    return jwt.encode(
        {"role": "admin", "exp": int(time.time()) + ADMIN_TOKEN_TTL},
        JWT_SECRET,
        algorithm="HS256",
    )


def require_admin(request: Request) -> dict:
    """Doctor/slot management. Grants access to:
    - a valid admin token (from POST /api/admin/login) in the X-Admin-Key header, or
    - a signed-in user whose phone is in the ADMIN_PHONES allowlist.
    """
    key = request.headers.get("x-admin-key")
    if key:
        try:
            payload = jwt.decode(key, JWT_SECRET, algorithms=["HS256"])
            if payload.get("role") == "admin":
                return {"admin": True, "phone": None}
        except jwt.PyJWTError:
            pass
        raise HTTPException(401, "Admin session expired. Log in again.")

    allowed = [p.strip() for p in os.environ.get("ADMIN_PHONES", "").split(",") if p.strip()]
    if allowed:
        user = current_user(request)
        if user["phone"] in allowed:
            return user
    raise HTTPException(403, "Admin access required.")
