"""Patient data export builder (GDPR/DPDP portability JSON, no secrets or cross-user IDs)."""
import json

from fastapi import HTTPException

from . import crypto
from .db import (
    appointment_json,
    document_json,
    get_db,
    insurance_json,
    intake_json,
    payment_json,
    record_json,
    record_medical_audit,
    utcnow_iso,
)
from .routes_care import _expired, _share_json
from .routes_community import _journal_json, _moods_for
from .routes_history import history_items, requests_json
from .routes_me import me_payload
from .routes_meds import _med_json
from .routes_mood import _mood_json
from .routes_sos import _contact_json


def _load_health(db, user_id: int, base_health: dict) -> dict:
    chart = db.execute("SELECT * FROM patient_charts WHERE user_id = ?", (user_id,)).fetchone()
    return {
        **base_health,
        "selfDeclared": crypto.dec_json(chart["self_declared"], []) if chart else [],
        "familyHistory": crypto.dec(chart["family_history"]) if chart else None,
        "updatedAt": chart["updated_at"] if chart else None,
        "history": history_items(db, user_id),
    }


def _load_clinical(db, user_id: int) -> dict:
    doctors = {
        r["id"]: {"name": r["name"], "specialty": r["specialty"]}
        for r in db.execute("SELECT id, name, specialty FROM doctors").fetchall()
    }
    appts = db.execute("SELECT * FROM appointments WHERE user_id = ? ORDER BY created_at DESC", (user_id,)).fetchall()
    records = {
        r["appointment_id"]: record_json(r)
        for r in db.execute("SELECT * FROM consultation_records WHERE user_id = ?", (user_id,)).fetchall()
    }
    share_rows = db.execute(
        "SELECT * FROM history_shares WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
    ).fetchall()
    shares = [
        {
            "appointmentId": s["appointment_id"],
            "doctorId": s["doctor_id"],
            "doctorName": doctors.get(s["doctor_id"], {}).get("name"),
            "mode": s["mode"],
            "categories": json.loads(s["categories"] or "[]"),
            "documentIds": json.loads(s["document_ids"] or "[]"),
            "createdAt": s["created_at"],
            "updatedAt": s["updated_at"],
        }
        for s in share_rows
    ]
    share_by_appt = {s["appointmentId"]: s for s in shares}

    exported_appts = []
    for a in appts:
        doc = doctors.get(a["doctor_id"], {})
        exported_appts.append(
            {
                **appointment_json(a),
                "anonymous": bool(a["anonymous"]),
                "doctorName": doc.get("name"),
                "doctorSpecialty": doc.get("specialty"),
                "record": records.get(a["id"]),
                "historyShare": share_by_appt.get(a["id"]),
            }
        )

    payments = [
        {
            **payment_json(p),
            "shareToken": p["share_token"],
            "createdAt": p["created_at"],
            "paidAt": p["paid_at"],
        }
        for p in db.execute("SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC", (user_id,)).fetchall()
    ]
    docs = [
        {
            **document_json(d, include_data=True),
            "doctorName": doctors.get(d["doctor_id"], {}).get("name") if d["uploaded_by"] != "patient" else None,
        }
        for d in db.execute("SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC", (user_id,)).fetchall()
    ]
    return {
        "appointments": exported_appts,
        "payments": payments,
        "documents": docs,
        "historyShares": shares,
        "historyRequests": requests_json(db, "q.user_id = ?", (user_id,)),
    }


def _load_wellbeing(db, user_id: int) -> dict:
    screenings = [
        {
            "tool": r["tool"],
            "score": r["score"],
            "answers": crypto.dec_json(r["answers"], []),
            "createdAt": r["created_at"],
        }
        for r in db.execute(
            "SELECT tool, score, answers, created_at FROM screenings WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    ]
    meds = [
        {**_med_json(m), "recordId": m["record_id"], "createdAt": m["created_at"]}
        for m in db.execute(
            "SELECT * FROM medications WHERE user_id = ? ORDER BY active DESC, created_at DESC", (user_id,)
        ).fetchall()
    ]
    doses = [
        {
            "medicationId": d["medication_id"],
            "date": d["date"],
            "slot": d["slot"],
            "takenAt": d["taken_at"],
            "takenBy": d["taken_by"],
        }
        for d in db.execute(
            "SELECT medication_id, date, slot, taken_at, taken_by FROM medication_doses WHERE user_id = ? ORDER BY date DESC, slot DESC",
            (user_id,),
        ).fetchall()
    ]
    journal_rows = db.execute(
        "SELECT * FROM journal_entries WHERE user_id = ? ORDER BY date DESC, created_at DESC", (user_id,)
    ).fetchall()
    moods = _moods_for(db, journal_rows, user_id)
    journal = [_journal_json(r, moods.get(r["mood_log_id"])) for r in journal_rows]
    mood_logs = [
        _mood_json(m)
        for m in db.execute(
            "SELECT * FROM mood_logs WHERE user_id = ? ORDER BY date DESC, logged_at DESC", (user_id,)
        ).fetchall()
    ]
    intake = [
        intake_json(r, include_answers=True)
        for r in db.execute(
            "SELECT * FROM intake_submissions WHERE user_id = ? ORDER BY submitted_at DESC", (user_id,)
        ).fetchall()
    ]
    ins = db.execute("SELECT * FROM insurance_policies WHERE user_id = ?", (user_id,)).fetchone()
    return {
        "screenings": screenings,
        "medications": {"items": meds, "doses": doses},
        "journal": journal,
        "moodLogs": mood_logs,
        "intakeSubmissions": intake,
        "insurance": insurance_json(ins, full=True) if ins else None,
    }


def _load_safety_and_community(db, user_id: int) -> dict:
    contacts = [
        _contact_json(c)
        for c in db.execute("SELECT * FROM sos_contacts WHERE user_id = ? ORDER BY created_at ASC", (user_id,)).fetchall()
    ]
    alerts = [
        {
            "id": r["id"],
            "message": crypto.dec(r["message"]),
            "sentTo": crypto.dec_json(r["sent_to"], []),
            "isTest": bool(r["is_test"]),
            "timestamp": r["timestamp"],
        }
        for r in db.execute("SELECT * FROM sos_alerts WHERE user_id = ? ORDER BY timestamp DESC", (user_id,)).fetchall()
    ]
    shares = [
        {**_share_json(s), "expired": _expired(s)}
        for s in db.execute("SELECT * FROM care_shares WHERE user_id = ? ORDER BY created_at DESC", (user_id,)).fetchall()
    ]
    events = [
        {
            "id": e["id"],
            "actor": e["actor"],
            "actorLabel": crypto.dec(e["actor_label"]),
            "shareToken": e["share_token"],
            "kind": e["kind"],
            "summary": crypto.dec(e["summary"]),
            "meta": json.loads(e["meta"] or "{}"),
            "readAt": e["read_at"],
            "createdAt": e["created_at"],
        }
        for e in db.execute(
            """SELECT id, actor, actor_label, share_token, kind, summary, meta, read_at, created_at
               FROM care_events WHERE user_id = ? ORDER BY created_at DESC""",
            (user_id,),
        ).fetchall()
    ]
    handle_row = db.execute("SELECT handle FROM anon_handles WHERE user_id = ?", (user_id,)).fetchone()
    posts = [
        {
            "id": p["id"],
            "isAnonymous": bool(p["is_anonymous"]),
            "tags": json.loads(p["tags"] or "[]"),
            "type": p["type"],
            "text": crypto.dec(p["text"]),
            "pollOptions": json.loads(p["poll_options"]) if p["poll_options"] else None,
            "replyToId": p["reply_to_id"],
            "likeCount": p["like_count"],
            "replyCount": p["reply_count"],
            "moderationStatus": p["moderation_status"],
            "createdAt": p["created_at"],
        }
        for p in db.execute(
            "SELECT * FROM community_posts WHERE author_id = ? ORDER BY created_at DESC", (user_id,)
        ).fetchall()
    ]
    likes = [
        r["post_id"]
        for r in db.execute("SELECT post_id FROM community_likes WHERE user_id = ? ORDER BY post_id", (user_id,)).fetchall()
    ]
    poll_votes = [
        {"postId": r["post_id"], "optionIndex": r["option_index"]}
        for r in db.execute(
            "SELECT post_id, option_index FROM community_poll_votes WHERE user_id = ? ORDER BY post_id", (user_id,)
        ).fetchall()
    ]
    reports = [
        {"postId": r["post_id"], "reason": r["reason"], "createdAt": r["created_at"]}
        for r in db.execute(
            "SELECT post_id, reason, created_at FROM community_reports WHERE reporter_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    ]
    blocked_count = db.execute(
        "SELECT COUNT(*) AS n FROM community_blocks WHERE user_id = ?", (user_id,)
    ).fetchone()["n"]

    return {
        "sos": {"contacts": contacts, "alerts": alerts},
        "care": {"shares": shares, "events": events},
        "community": {
            "anonHandle": handle_row["handle"] if handle_row else None,
            "posts": posts,
            "likes": likes,
            "pollVotes": poll_votes,
            "reports": reports,
            # Aggregate count only so anonymous blocked authors' internal IDs are never disclosed.
            "blockedAuthorsCount": blocked_count,
        },
    }


def build_patient_export(user_id: int, *, ip_address: str | None = None) -> dict:
    """Assemble all decrypted records owned by `user_id` and record an audit event."""
    with get_db() as db:
        user_row = db.execute("SELECT id, created_at FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user_row:
        raise HTTPException(404, "Account not found.")

    base = me_payload(user_id)
    with get_db() as db:
        health = _load_health(db, user_id, base["health"])
        clinical = _load_clinical(db, user_id)
        wellbeing = _load_wellbeing(db, user_id)
        safety_community = _load_safety_and_community(db, user_id)
        record_medical_audit(
            db,
            actor_type="patient",
            actor_id=user_id,
            patient_id=user_id,
            resource_type="export",
            resource_id=str(user_id),
            action="export",
            outcome="granted",
            status_code=200,
            ip_address=ip_address,
        )

    return {
        "exportVersion": 1,
        "exportedAt": utcnow_iso(),
        "profile": {"id": user_row["id"], **base["user"], "createdAt": user_row["created_at"]},
        "cycle": base["cycle"],
        "pregnancy": base["pregnancy"],
        "settings": base["settings"],
        "health": health,
        **clinical,
        **wellbeing,
        **safety_community,
    }

