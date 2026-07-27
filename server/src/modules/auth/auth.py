"""Phone-OTP authentication issuing JWTs, plus FastAPI auth dependencies.

OTP codes are random 6-digit, stored as salted SHA-256 hashes, expire after
5 minutes, allow 5 verification attempts, and are rate-limited per phone.
Outside production the code is returned to the client so the app works
without an SMS gateway; wire one into send_sms() for launch.
"""
import hashlib
import hmac
import secrets
import time
import re
import jwt
from fastapi import HTTPException, Request

from ...config.settings import IS_PROD, JWT_SECRET, EXPOSE_OTP, ADMIN_PASSWORD, ADMIN_PHONES
from ...database.db import get_db

OTP_TTL = 5 * 60
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_COOLDOWN = 30
OTP_MAX_SENDS = 8
TOKEN_TTL = 30 * 24 * 3600
ADMIN_TOKEN_TTL = 12 * 3600

PHONE_RE = re.compile(r"^[6-9]\d{9}$")


def is_valid_phone(phone: str) -> bool:
    return bool(phone and PHONE_RE.match(phone))


def _test_numbers() -> dict[str, str]:
    """Fixed-OTP test numbers, à la Firebase Auth. TEST_OTP_NUMBERS is a
    comma-separated list of `phone:code` pairs (6-digit codes)."""
    import os
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
    print(f"[otp] {phone} → {code}")


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
        user = db.execute("SELECT * FROM users WHERE phone = ?", (phone,)).fetchone()
        if not user:
            cur = db.execute("INSERT INTO users (phone) VALUES (?)", (phone,))
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


def verify_doctor_otp(phone: str, code: str) -> dict:
    """Doctor sign-in: the phone must belong to a registered practitioner.
    Never creates an account."""
    with get_db() as db:
        doctor = db.execute("SELECT * FROM doctors WHERE phone = ?", (phone,)).fetchone()
        if not doctor:
            raise HTTPException(403, "This number isn't registered as a practitioner on Amruni.")
        _consume_otp(db, phone, code)

    token = jwt.encode(
        {"role": "doctor", "did": doctor["id"], "phone": phone, "exp": int(time.time()) + TOKEN_TTL},
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
    """Doctor/slot management. Grants access to admin or allow-listed phone."""
    key = request.headers.get("x-admin-key")
    if key:
        try:
            payload = jwt.decode(key, JWT_SECRET, algorithms=["HS256"])
            if payload.get("role") == "admin":
                return {"admin": True, "phone": None}
        except jwt.PyJWTError:
            pass
        raise HTTPException(401, "Admin session expired. Log in again.")

    allowed = [p.strip() for p in (ADMIN_PHONES or "").split(",") if p.strip()]
    if allowed:
        user = current_user(request)
        if user["phone"] in allowed:
            return user
    raise HTTPException(403, "Admin access required.")
