"""Payment providers.

The booking flow is provider-agnostic: create_order() when a booking is
initiated, verify() when the client reports payment. Two providers:

- mock (default): no external calls; confirm always succeeds. Lets the whole
  book → pay → meet-link flow run in development and demos.
- razorpay: active when RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set.
  Orders are created via the Razorpay Orders API (amounts in paise) and
  payments verified with the documented HMAC-SHA256 signature check, so the
  frontend only needs Razorpay Checkout wired to the returned order id.
"""
import hashlib
import hmac
import secrets
import httpx
from fastapi import HTTPException
from ..config.settings import RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET


def provider_name() -> str:
    return "razorpay" if (RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET) else "mock"


def create_order(amount_inr: int, receipt: str) -> dict:
    """Returns {"order_id", "provider", "key_id"?} for the client to pay against."""
    if provider_name() == "razorpay":
        resp = httpx.post(
            "https://api.razorpay.com/v1/orders",
            auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
            json={"amount": amount_inr * 100, "currency": "INR", "receipt": receipt},
            timeout=15,
        )
        if resp.status_code >= 400:
            raise HTTPException(502, "Payment gateway is unavailable. Please try again.")
        return {"order_id": resp.json()["id"], "provider": "razorpay", "key_id": RAZORPAY_KEY_ID}

    return {"order_id": f"order_mock_{secrets.token_hex(8)}", "provider": "mock", "key_id": None}


def verify(payment_row, provider_payment_id: str | None, signature: str | None) -> None:
    """Raises HTTPException(400) when the payment cannot be verified."""
    if payment_row["provider"] == "razorpay":
        if not (provider_payment_id and signature):
            raise HTTPException(400, "Missing payment verification details.")
        expected = hmac.new(
            RAZORPAY_KEY_SECRET.encode(),
            f"{payment_row['order_id']}|{provider_payment_id}".encode(),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise HTTPException(400, "Payment verification failed.")
        return

    # mock provider: nothing to verify — development/demo only.
    return
