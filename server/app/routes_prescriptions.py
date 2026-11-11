"""Server-side prescription PDF export and signed record verification."""
import base64
import binascii
import hashlib
import hmac
import json
import os
import re
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse

from . import auth, crypto, pdf
from .auth import current_user
from .db import get_db, licences_for, record_json

router = APIRouter()

_TOKEN_DOMAIN = b"amruni-rx-v1:"
_SAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9_-]")


def _b64u_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64u_decode(part: str) -> bytes:
    padded = part + "=" * (-len(part) % 4)
    raw = base64.urlsafe_b64decode(padded.encode("ascii"))
    if _b64u_encode(raw) != part:
        raise ValueError("Non-canonical base64url segment")
    return raw


def _rx_digest(appointment_id: str, doctor_id: int, updated_at: str, prescription: list) -> str:
    canonical = json.dumps(
        {
            "appointmentId": appointment_id,
            "doctorId": doctor_id,
            "updatedAt": updated_at,
            "prescription": prescription,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:24]


def _signing_key() -> bytes:
    secret = auth.JWT_SECRET
    if not secret:
        raise RuntimeError("JWT_SECRET must be configured before signing prescriptions.")
    return secret.encode("utf-8")


def sign_prescription_token(appointment_id: str, record_id: int, doctor_id: int, updated_at: str, prescription: list) -> str:
    payload = {
        "v": 1,
        "rid": record_id,
        "aid": appointment_id,
        "h": _rx_digest(appointment_id, doctor_id, updated_at, prescription),
    }
    payload_b64 = _b64u_encode(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    sig = hmac.new(_signing_key(), _TOKEN_DOMAIN + payload_b64.encode("ascii"), hashlib.sha256).digest()
    return f"{payload_b64}.{_b64u_encode(sig)}"


def parse_prescription_token(token: str) -> dict | None:
    if not isinstance(token, str) or "." not in token:
        return None
    payload_b64, sig_b64 = token.strip().split(".", 1)
    if not payload_b64 or not sig_b64:
        return None
    try:
        expected = hmac.new(_signing_key(), _TOKEN_DOMAIN + payload_b64.encode("ascii"), hashlib.sha256).digest()
        provided = _b64u_decode(sig_b64)
        if not hmac.compare_digest(expected, provided):
            return None
        payload = json.loads(_b64u_decode(payload_b64).decode("utf-8"))
    except (ValueError, UnicodeDecodeError, binascii.Error):
        return None
    if not isinstance(payload, dict) or payload.get("v") != 1:
        return None
    if not isinstance(payload.get("rid"), int) or not isinstance(payload.get("aid"), str) or not isinstance(payload.get("h"), str):
        return None
    return payload


def _active_registration(db, doctor_id: int) -> str | None:
    for lic in licences_for(db, doctor_id):
        if not lic["expired"]:
            return f"{lic['authority']} ({lic['number']})"
    return None


def _verification_url(request: Request, token: str) -> str:
    public_api = os.environ.get("PUBLIC_API_URL", "").strip().rstrip("/")
    base = public_api or str(request.base_url).rstrip("/")
    return f"{base}/api/prescriptions/verify?token={quote(token, safe='')}"


def _load_owned_prescription(db, appointment_id: str, user_id: int) -> dict:
    appt = db.execute(
        "SELECT * FROM appointments WHERE id = ? AND user_id = ?", (appointment_id, user_id)
    ).fetchone()
    if not appt:
        raise HTTPException(404, "Appointment not found")
    record = db.execute(
        "SELECT * FROM consultation_records WHERE appointment_id = ?", (appointment_id,)
    ).fetchone()
    if not record:
        raise HTTPException(404, "Prescription not available yet.")
    doctor = db.execute("SELECT * FROM doctors WHERE id = ?", (appt["doctor_id"],)).fetchone()
    patient = db.execute("SELECT name FROM users WHERE id = ?", (user_id,)).fetchone()
    rec = record_json(record)
    patient_name = "Confidential Patient" if appt["anonymous"] else (crypto.dec(patient["name"]) if patient else None) or "Patient"
    token = sign_prescription_token(
        appointment_id,
        rec["id"],
        rec["doctorId"],
        rec["updatedAt"],
        rec["prescription"],
    )
    return {
        "appt": appt,
        "rec": rec,
        "doctor": doctor,
        "registration": _active_registration(db, appt["doctor_id"]),
        "patientName": patient_name,
        "token": token,
    }


@router.get("/appointments/{appointment_id}/prescription")
def get_prescription_meta(appointment_id: str, request: Request, user: dict = Depends(current_user)):
    with get_db() as db:
        bundle = _load_owned_prescription(db, appointment_id, user["id"])
    rec = bundle["rec"]
    token = bundle["token"]
    return {
        "appointmentId": appointment_id,
        "rxId": f"Rx_{appointment_id}",
        "updatedAt": rec["updatedAt"],
        "consultationDate": bundle["appt"]["date"],
        "medicineCount": len(rec["prescription"]),
        "verificationToken": token,
        "verificationUrl": _verification_url(request, token),
        "pdfUrl": f"/api/appointments/{quote(appointment_id, safe='')}/prescription.pdf",
    }


@router.get("/appointments/{appointment_id}/prescription.pdf")
def download_prescription_pdf(appointment_id: str, request: Request, user: dict = Depends(current_user)):
    with get_db() as db:
        bundle = _load_owned_prescription(db, appointment_id, user["id"])
    rec = bundle["rec"]
    appt = bundle["appt"]
    doc_row = bundle["doctor"]
    pdf_bytes = pdf.build_prescription_pdf(
        rx_id=f"Rx_{appointment_id}",
        consultation_date=appt["date"] or "",
        consultation_time=appt["time"] or "",
        issued_at=rec["updatedAt"],
        doctor_name=doc_row["name"] if doc_row else "Clinician",
        doctor_specialty=doc_row["specialty"] if doc_row else "",
        doctor_registration=bundle["registration"],
        patient_name=bundle["patientName"],
        diagnosis=rec["diagnosis"],
        medicines=rec["prescription"],
        follow_up=rec["followUp"],
        notes=rec["notes"],
        verification_url=_verification_url(request, bundle["token"]),
    )
    safe_id = _SAFE_FILENAME_RE.sub("", appointment_id) or "record"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="prescription-{safe_id}.pdf"'},
    )


@router.get("/prescriptions/verify")
def verify_prescription(token: str = Query(default="")):
    """Publicly verify prescription authenticity without exposing patient PHI or diagnoses."""
    payload = parse_prescription_token(token)
    if not payload:
        return JSONResponse(
            status_code=400,
            content={"valid": False, "status": "invalid", "error": "Invalid or malformed verification token."},
        )

    with get_db() as db:
        row = db.execute(
            "SELECT * FROM consultation_records WHERE id = ? AND appointment_id = ?",
            (payload["rid"], payload["aid"]),
        ).fetchone()
        if not row:
            return JSONResponse(
                status_code=404,
                content={"valid": False, "status": "not_found", "error": "Prescription record not found."},
            )
        rec = record_json(row)
        expected_digest = _rx_digest(rec["appointmentId"], rec["doctorId"], rec["updatedAt"], rec["prescription"])
        if not hmac.compare_digest(expected_digest, payload["h"]):
            return {
                "valid": False,
                "status": "superseded",
                "rxId": f"Rx_{rec['appointmentId']}",
                "issuedAt": rec["updatedAt"],
                "error": "This prescription was updated after this copy was issued.",
            }
        doctor = db.execute("SELECT name, specialty FROM doctors WHERE id = ?", (rec["doctorId"],)).fetchone()
        appt = db.execute("SELECT date FROM appointments WHERE id = ?", (rec["appointmentId"],)).fetchone()
        registration = _active_registration(db, rec["doctorId"])

    return {
        "valid": True,
        "status": "valid",
        "rxId": f"Rx_{rec['appointmentId']}",
        "issuedAt": rec["updatedAt"],
        "consultationDate": appt["date"] if appt else None,
        "doctor": {
            "name": doctor["name"] if doctor else "Clinician",
            "specialty": doctor["specialty"] if doctor else None,
            "registration": registration,
        },
        "medicineCount": len(rec["prescription"]),
    }
