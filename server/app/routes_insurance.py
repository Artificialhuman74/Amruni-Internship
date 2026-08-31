"""Coverage, and the claim receipts generated from it.

Amruni does not bill an insurer. She pays for the consultation and we produce
a receipt carrying every field a reimbursement claim asks for — insurer,
policy number, practitioner, date, diagnosis, amount — which she submits
herself. The API is shaped around that and nothing more, so no endpoint here
can be mistaken for cashless settlement.

The receipt is assembled server-side on purpose. A client that composed its
own would be a client that could put any diagnosis and any amount on a
document going to an insurer, which is fraud with our name on it.
"""
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from . import crypto
from .auth import current_user
from .db import get_db, insurance_json, utcnow_iso

router = APIRouter()

PAYER_TYPES = ("private", "employer", "government", "self")

# What a claim needs, per payer. Mirrors REQUIRED_BY_PAYER in the client's
# lib/insurance.js — validated again here because client-side validation is a
# convenience, never a guarantee.
REQUIRED_BY_PAYER = {
    "private": ("insurer", "policyNumber"),
    "employer": ("insurer", "policyNumber"),
    "government": ("insurer", "memberId"),
    "self": (),
}


class PolicyBody(BaseModel):
    country: str
    payerType: str
    insurer: str | None = None
    planName: str | None = None
    policyNumber: str | None = None
    memberId: str | None = None
    groupNumber: str | None = None
    policyHolder: str | None = None
    relationship: str | None = "Myself"
    validTill: str | None = None
    tpa: str | None = None
    notes: str | None = None


@router.get("/insurance")
def get_insurance(user: dict = Depends(current_user)):
    """The editable form of her policy — the one place the full numbers come
    back, because it is the screen she typed them into."""
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM insurance_policies WHERE user_id = ?", (user["id"],)
        ).fetchone()
    return insurance_json(row, full=True) if row else {}


@router.get("/insurance/summary")
def get_insurance_summary(user: dict = Depends(current_user)):
    """The masked form, for anything that merely mentions her coverage —
    a settings row, a booking screen."""
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM insurance_policies WHERE user_id = ?", (user["id"],)
        ).fetchone()
    return insurance_json(row) if row else {}


@router.put("/insurance")
def put_insurance(body: PolicyBody, user: dict = Depends(current_user)):
    if body.payerType not in PAYER_TYPES:
        raise HTTPException(400, "Unknown payer type.")
    if not body.country.strip():
        raise HTTPException(400, "Country of residence is required.")

    missing = [
        field for field in REQUIRED_BY_PAYER[body.payerType]
        if not (getattr(body, field) or "").strip()
    ]
    if missing:
        raise HTTPException(400, "Your insurer and policy number are needed to claim this back.")

    with get_db() as db:
        db.execute(
            """INSERT INTO insurance_policies
                 (user_id, country, payer_type, insurer, plan_name, policy_number, member_id,
                  group_number, policy_holder, relationship, valid_till, tpa, notes, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET
                 country = excluded.country, payer_type = excluded.payer_type,
                 insurer = excluded.insurer, plan_name = excluded.plan_name,
                 policy_number = excluded.policy_number, member_id = excluded.member_id,
                 group_number = excluded.group_number, policy_holder = excluded.policy_holder,
                 relationship = excluded.relationship, valid_till = excluded.valid_till,
                 tpa = excluded.tpa, notes = excluded.notes, updated_at = excluded.updated_at""",
            (
                user["id"], body.country, body.payerType,
                crypto.enc(body.insurer), crypto.enc(body.planName),
                crypto.enc(body.policyNumber), crypto.enc(body.memberId),
                crypto.enc(body.groupNumber), crypto.enc(body.policyHolder),
                body.relationship, body.validTill, crypto.enc(body.tpa),
                crypto.enc(body.notes), utcnow_iso(),
            ),
        )
        row = db.execute(
            "SELECT * FROM insurance_policies WHERE user_id = ?", (user["id"],)
        ).fetchone()
    return insurance_json(row, full=True)


@router.delete("/insurance")
def delete_insurance(user: dict = Depends(current_user)):
    with get_db() as db:
        db.execute("DELETE FROM insurance_policies WHERE user_id = ?", (user["id"],))
    return {"success": True}


@router.get("/insurance/receipt/{appointment_id}")
def claim_receipt(appointment_id: str, user: dict = Depends(current_user)):
    """A claim-ready receipt for one consultation.

    Every clinical and financial field is read from the database rather than
    accepted from the caller. A receipt is only worth anything to an insurer
    if the person submitting it could not have written it.
    """
    with get_db() as db:
        appt = db.execute(
            """SELECT a.*, d.name AS doctor_name, d.specialty AS doctor_specialty, d.exp AS doctor_exp
               FROM appointments a JOIN doctors d ON d.id = a.doctor_id
               WHERE a.id = ? AND a.user_id = ?""",
            (appointment_id, user["id"]),
        ).fetchone()
        if not appt:
            raise HTTPException(404, "No such consultation.")
        if appt["status"] not in ("confirmed", "completed"):
            raise HTTPException(
                409, "A receipt is available once the consultation is paid for and confirmed."
            )

        policy_row = db.execute(
            "SELECT * FROM insurance_policies WHERE user_id = ?", (user["id"],)
        ).fetchone()
        record = db.execute(
            "SELECT * FROM consultation_records WHERE appointment_id = ?", (appointment_id,)
        ).fetchone()
        payment = db.execute(
            """SELECT * FROM payments WHERE appointment_id = ? AND status = 'paid'
               ORDER BY paid_at DESC LIMIT 1""",
            (appointment_id,),
        ).fetchone()
        user_row = db.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()

    # An anonymous booking is honoured here too. She chose to withhold her name
    # from this consultation; a receipt is not a side door that puts it back.
    patient_name = None if appt["anonymous"] else crypto.dec(user_row["name"])

    return {
        "receiptNo": f"AMR-{appointment_id[-8:].upper()}",
        "issuedAt": utcnow_iso(),
        "anonymous": bool(appt["anonymous"]),
        "patient": {
            "name": patient_name,
            "note": "This consultation was booked anonymously, so no patient name is on file."
                    if appt["anonymous"] else None,
        },
        "consultation": {
            "appointmentId": appointment_id,
            "date": appt["date"],
            "time": appt["time"],
            "mode": appt["consult_mode"],
            "reason": appt["reason"],
            "diagnosis": crypto.dec(record["diagnosis"]) if record else None,
            "followUp": record["follow_up"] if record else None,
        },
        "practitioner": {
            "name": appt["doctor_name"],
            "specialty": appt["doctor_specialty"],
            "experience": appt["doctor_exp"],
            "country": "India",
        },
        "payment": {
            "amount": appt["amount_inr"],
            "currency": payment["currency"] if payment else "INR",
            "status": payment["status"] if payment else "unpaid",
            "paidAt": payment["paid_at"] if payment else None,
            "reference": payment["order_id"] if payment else None,
        },
        # Full, unmasked — this is the document she sends her insurer.
        "policy": insurance_json(policy_row, full=True) if policy_row else None,
        "disclaimer": (
            "Issued by Amruni for reimbursement purposes. Amruni does not bill insurers directly "
            "and makes no representation that this consultation is covered by your policy. Check "
            "your policy terms for teleconsultation and cross-border cover."
        ),
    }


def policy_for_doctor(db, user_id: int) -> dict | None:
    """Masked coverage for a doctor's chart view.

    A practitioner needs to know a claim is being made and against whom, so the
    consultation summary can be written to support it. She does not need the
    policy number, so she does not get it.
    """
    row = db.execute("SELECT * FROM insurance_policies WHERE user_id = ?", (user_id,)).fetchone()
    if not row:
        return None
    data = insurance_json(row)
    return {
        "country": data["country"],
        "payerType": data["payerType"],
        "insurer": data["insurer"],
        "planName": data["planName"],
        "policyNumberMasked": data["policyNumberMasked"] or data["memberIdMasked"],
        "validTill": data["validTill"],
    }


def intake_for_doctor(db, user_id: int) -> list[dict]:
    """Her submitted intake forms, newest first, in full.

    The practitioner reading a homeopathic case needs the whole case — the
    access rule that protects it is the appointment relationship enforced by
    the caller, not a partial view that would make the form useless.
    """
    rows = db.execute(
        """SELECT * FROM intake_submissions WHERE user_id = ?
           ORDER BY submitted_at DESC LIMIT 10""",
        (user_id,),
    ).fetchall()
    return [
        {
            "id": r["id"],
            "formId": r["form_id"],
            "submittedAt": r["submitted_at"],
            "skipped": json.loads(r["skipped"] or "[]"),
            "prakriti": json.loads(r["prakriti"]) if r["prakriti"] else None,
            "answers": crypto.dec_json(r["answers"], {}),
        }
        for r in rows
    ]
