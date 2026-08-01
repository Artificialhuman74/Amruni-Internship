"""Encryption at rest for anything that identifies her or describes her body.

What this protects against, precisely — because a security feature described
loosely is one nobody can rely on:

  · A stolen or leaked database file, a backup left somewhere it shouldn't be,
    a dump handed to an analyst, a laptop with a copy of production on it. In
    every one of those the rows read as ciphertext.
  · Anyone with read access to the database but not to the application's
    environment: a DBA, a hosting provider's support engineer, a replica.

What it does NOT protect against, and no amount of this can:

  · Someone with full access to the running server, who by definition holds the
    key. Protecting her from the operator requires keys that only she holds,
    which would mean her doctor could not read her chart and the cycle model
    could not run — a different product, not a stronger version of this one.

The key never lives in the database. It comes from AMRUNI_DATA_KEY, and in
production its absence is fatal rather than silently falling back to a
development key, because a server that boots with the wrong key writes data
nobody can ever read back.

Two primitives:

  · `enc`/`dec` — AES-256-GCM, a fresh nonce per value, authenticated so a
    tampered row fails loudly instead of decrypting to something plausible.
  · `blind_index` — a deterministic HMAC, so a phone number can still be looked
    up at sign-in without storing the number in a form anyone can read. It
    leaks equality (two identical numbers give the same index) and nothing
    else, which is exactly the trade a login needs.

Decryption is deliberately tolerant of plaintext. A database written before
this module existed is full of it, and reads have to keep working while
`migrate_existing` walks the tables — a strict reader would take the app down
between deploy and migration.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

PREFIX = "enc:v1:"
NONCE_BYTES = 12

IS_PROD = os.environ.get("ENV", os.environ.get("NODE_ENV", "")) == "production"


def _load_key() -> bytes:
    raw = os.environ.get("AMRUNI_DATA_KEY", "").strip()
    if raw:
        try:
            key = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError("AMRUNI_DATA_KEY is not valid base64.") from exc
        if len(key) != 32:
            raise RuntimeError("AMRUNI_DATA_KEY must decode to exactly 32 bytes.")
        return key

    if IS_PROD:
        raise RuntimeError(
            "AMRUNI_DATA_KEY is not set. Refusing to start in production: "
            "booting with a generated key would write records that the next "
            "boot cannot read."
        )

    # Development only. Persisted next to the database so a local restart can
    # still read what the last run wrote, and mode 0600 so it is not casually
    # readable by anything else on the machine.
    path = Path(os.environ.get("DB_PATH", Path(__file__).resolve().parent.parent / "data" / "amruni.db")).parent / ".datakey"
    if path.exists():
        return base64.urlsafe_b64decode(path.read_text().strip() + "==")
    key = AESGCM.generate_key(bit_length=256)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(base64.urlsafe_b64encode(key).decode().rstrip("="))
    os.chmod(path, 0o600)
    return key


_KEY = _load_key()
_AEAD = AESGCM(_KEY)
# A separate secret for the deterministic index, derived from the same root so
# there is one thing to rotate — but never the same bytes as the cipher key.
_PEPPER = hashlib.sha256(b"amruni.blind-index.v1" + _KEY).digest()


def is_encrypted(value) -> bool:
    return isinstance(value, str) and value.startswith(PREFIX)


def enc(value):
    """Encrypts a string. None and empty pass through — an absent value is not
    a secret, and encrypting it would only make every NULL check a decrypt."""
    if value is None or value == "":
        return value
    if is_encrypted(value):
        return value
    nonce = secrets.token_bytes(NONCE_BYTES)
    ct = _AEAD.encrypt(nonce, str(value).encode("utf-8"), None)
    return PREFIX + base64.urlsafe_b64encode(nonce + ct).decode("ascii")


def dec(value):
    """Decrypts a value written by `enc`, and returns anything else unchanged."""
    if not is_encrypted(value):
        return value
    try:
        blob = base64.urlsafe_b64decode(value[len(PREFIX):])
        return _AEAD.decrypt(blob[:NONCE_BYTES], blob[NONCE_BYTES:], None).decode("utf-8")
    except Exception:  # noqa: BLE001
        # Wrong key, or a tampered row. Returning None rather than raising keeps
        # one unreadable field from taking down the whole record — but it is
        # never silently treated as valid content.
        return None


def enc_json(value) -> str:
    return enc(json.dumps(value if value is not None else []))


def dec_json(value, default=None):
    if value is None:
        return default if default is not None else []
    raw = dec(value)
    if raw is None or raw == "":
        return default if default is not None else []
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return default if default is not None else []


def blind_index(value) -> str | None:
    """Deterministic lookup key. Same input, same output; reveals nothing else."""
    if value is None or value == "":
        return None
    normalized = str(value).strip().lower()
    return hmac.new(_PEPPER, normalized.encode("utf-8"), hashlib.sha256).hexdigest()
