import os
import sys
from pathlib import Path

# Environment flag
IS_PROD = os.environ.get("ENV", os.environ.get("NODE_ENV", "")) == "production"

# JWT Settings
JWT_SECRET = os.environ.get("JWT_SECRET") or (None if IS_PROD else "amruni-dev-secret-do-not-use-in-prod")
if not JWT_SECRET:
    print("FATAL: JWT_SECRET must be set in production.", file=sys.stderr)
    sys.exit(1)

# OTP settings
EXPOSE_OTP = os.environ.get("EXPOSE_OTP", "").strip().lower() in ("1", "true", "yes", "on")

# Database paths
DB_PATH = os.environ.get("DB_PATH", "data/amruni.db")
FEDCYCLE_PATH = os.environ.get("FEDCYCLE_PATH")

# CORS Allowed Origins
ALLOWED_ORIGINS_ENV = os.environ.get("ALLOWED_ORIGINS", "").strip()
if ALLOWED_ORIGINS_ENV:
    ALLOWED_ORIGINS = [o.strip() for o in ALLOWED_ORIGINS_ENV.split(",") if o.strip()]
else:
    ALLOWED_ORIGINS = ["*"] if IS_PROD else ["http://localhost:5173", "http://127.0.0.1:5173"]

# Google Calendar/Meet configuration
GOOGLE_SERVICE_ACCOUNT_FILE = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE")
GOOGLE_CALENDAR_ID = os.environ.get("GOOGLE_CALENDAR_ID", "primary")
GOOGLE_IMPERSONATE_SUBJECT = os.environ.get("GOOGLE_IMPERSONATE_SUBJECT")
MEET_TIMEZONE = os.environ.get("MEET_TIMEZONE", "Asia/Kolkata")

# Razorpay Configuration
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET")

# Admin panel configs
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "amruni")
ADMIN_PHONES = os.environ.get("ADMIN_PHONES")

# Frontend serving directory
DIST = Path(__file__).resolve().parent.parent.parent / "amruni-app" / "dist"
