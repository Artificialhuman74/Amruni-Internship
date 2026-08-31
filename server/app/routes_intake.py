"""Consultation intake forms — homeopathic case-taking and ayurvedic intake.

Submissions are append-only. She fills a form again before a later
consultation and the practitioner who saw her in March still reads what she
said in March, rather than an answer she has since revised. See the table
comment in db.py.

Answers are encrypted at rest as a single blob. The homeopathic form's last
section carries her own account of abuse, bereavement and humiliation, which
makes this the most self-disclosing table in the database — and the one whose
access rules are worth being strict about rather than convenient about.
"""
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from . import crypto
from .auth import current_user
from .db import get_db, intake_json, new_id

router = APIRouter()

FORM_IDS = ("homeopathy", "ayurveda")

# A case history is long-form prose, but it is not a file upload. The cap is
# generous enough for the longest honest answer and small enough that the
# column cannot be used as storage.
MAX_ANSWERS_CHARS = 40_000


class IntakeBody(BaseModel):
    answers: dict = Field(default_factory=dict)
    skippedSections: list[str] = Field(default_factory=list)
    prakriti: dict | None = None
    appointmentId: str | None = None


@router.post("/intake/{form_id}", status_code=201)
def submit_intake(form_id: str, body: IntakeBody, user: dict = Depends(current_user)):
    if form_id not in FORM_IDS:
        raise HTTPException(404, "No such form.")

    encoded = crypto.enc_json(body.answers)
    if len(encoded) > MAX_ANSWERS_CHARS:
        raise HTTPException(413, "That form is too long to save. Please shorten your answers.")

    submission_id = new_id("intake")
    with get_db() as db:
        # An appointment id is accepted only if it is hers. Otherwise a client
        # could staple her case history onto a stranger's consultation, which
        # would show it to a doctor she never chose.
        appointment_id = body.appointmentId
        if appointment_id:
            owned = db.execute(
                "SELECT 1 FROM appointments WHERE id = ? AND user_id = ?",
                (appointment_id, user["id"]),
            ).fetchone()
            if not owned:
                appointment_id = None

        db.execute(
            """INSERT INTO intake_submissions
                 (id, user_id, form_id, appointment_id, answers, skipped, prakriti)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                submission_id, user["id"], form_id, appointment_id, encoded,
                json.dumps(body.skippedSections),
                json.dumps(body.prakriti) if body.prakriti else None,
            ),
        )
        row = db.execute("SELECT * FROM intake_submissions WHERE id = ?", (submission_id,)).fetchone()
    return intake_json(row)


@router.get("/intake")
def list_intake(user: dict = Depends(current_user)):
    """Her submissions, newest first, without the answers — this draws a list."""
    with get_db() as db:
        rows = db.execute(
            """SELECT * FROM intake_submissions WHERE user_id = ?
               ORDER BY submitted_at DESC LIMIT 50""",
            (user["id"],),
        ).fetchall()
    return [intake_json(r, include_answers=False) for r in rows]


@router.get("/intake/{form_id}/latest")
def latest_intake(form_id: str, user: dict = Depends(current_user)):
    if form_id not in FORM_IDS:
        raise HTTPException(404, "No such form.")
    with get_db() as db:
        row = db.execute(
            """SELECT * FROM intake_submissions WHERE user_id = ? AND form_id = ?
               ORDER BY submitted_at DESC LIMIT 1""",
            (user["id"], form_id),
        ).fetchone()
    # Deliberately not a 404: "you have never filled this in" is an ordinary
    # state for the screen asking, not an error it should render as one.
    return intake_json(row) if row else {}


@router.delete("/intake/{submission_id}")
def delete_intake(submission_id: str, user: dict = Depends(current_user)):
    """She can withdraw a submission.

    Append-only protects the practitioner's reading of her record from silent
    edits; it does not mean she cannot take back what she wrote. A deletion is
    a deletion — the row goes, rather than being flagged hidden.
    """
    with get_db() as db:
        row = db.execute(
            "SELECT 1 FROM intake_submissions WHERE id = ? AND user_id = ?",
            (submission_id, user["id"]),
        ).fetchone()
        if not row:
            raise HTTPException(404, "No such submission.")
        db.execute("DELETE FROM intake_submissions WHERE id = ?", (submission_id,))
    return {"success": True}
