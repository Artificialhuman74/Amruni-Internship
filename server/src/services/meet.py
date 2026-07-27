"""Google Meet link generation.

When Google credentials are configured, a Calendar event with a Meet
conference is created via the Google Calendar API and the real meet link is
returned. Configuration:

  GOOGLE_SERVICE_ACCOUNT_FILE  path to a service-account JSON key
  GOOGLE_CALENDAR_ID           calendar to create events on (default: primary)
  GOOGLE_IMPERSONATE_SUBJECT   optional Workspace user to impersonate
                               (required for Meet links: service accounts need
                               domain-wide delegation to host conferences)

Without Google credentials the module falls back to Jitsi Meet
(https://meet.jit.si) — anonymous, credential-free rooms — so every paid
booking still gets a meeting link that actually works.
"""
import os
import secrets
from datetime import datetime, timedelta
from ..config.settings import GOOGLE_SERVICE_ACCOUNT_FILE, GOOGLE_CALENDAR_ID, GOOGLE_IMPERSONATE_SUBJECT, MEET_TIMEZONE

TIMEZONE = MEET_TIMEZONE
CALENDAR_ID = GOOGLE_CALENDAR_ID
SA_FILE = GOOGLE_SERVICE_ACCOUNT_FILE
IMPERSONATE = GOOGLE_IMPERSONATE_SUBJECT

_SCOPES = ["https://www.googleapis.com/auth/calendar.events"]


def _google_configured() -> bool:
    return bool(SA_FILE and os.path.exists(SA_FILE))


def _fallback_link() -> str:
    # Jitsi rooms exist the moment someone opens the URL — no account, no API.
    # A long random suffix keeps rooms unguessable.
    return f"https://meet.jit.si/Amruni-{secrets.token_urlsafe(9)}"


def create_meeting(*, summary: str, description: str, date: str, start_time: str,
                   duration_minutes: int = 30) -> dict:
    """Create a meeting for the given local date/time.

    Returns {"link", "event_id", "provider"} where provider is 'google' or
    'jitsi'. Never raises: on Google API failure it logs and falls back to a
    working Jitsi room so a paid booking is never left without a meeting.
    """
    if _google_configured():
        try:
            return _create_google_meeting(summary, description, date, start_time, duration_minutes)
        except Exception as exc:  # noqa: BLE001 — deliberate: payment already captured
            print(f"[meet] Google Calendar API failed, falling back to Jitsi: {exc}")

    return {"link": _fallback_link(), "event_id": None, "provider": "jitsi"}


def _create_google_meeting(summary, description, date, start_time, duration_minutes) -> dict:
    import requests
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request as GoogleRequest

    creds = service_account.Credentials.from_service_account_file(SA_FILE, scopes=_SCOPES)
    if IMPERSONATE:
        creds = creds.with_subject(IMPERSONATE)
    creds.refresh(GoogleRequest())

    start_dt = datetime.fromisoformat(f"{date}T{start_time}")
    end_dt = start_dt + timedelta(minutes=duration_minutes)

    event = {
        "summary": summary,
        "description": description,
        "start": {"dateTime": start_dt.isoformat(), "timeZone": TIMEZONE},
        "end": {"dateTime": end_dt.isoformat(), "timeZone": TIMEZONE},
        "conferenceData": {
            "createRequest": {
                "requestId": secrets.token_hex(16),
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        },
    }

    resp = requests.post(
        f"https://www.googleapis.com/calendar/v3/calendars/{CALENDAR_ID}/events",
        params={"conferenceDataVersion": 1},
        headers={"Authorization": f"Bearer {creds.token}"},
        json=event,
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()

    link = data.get("hangoutLink")
    if not link:
        for entry in data.get("conferenceData", {}).get("entryPoints", []):
            if entry.get("entryPointType") == "video":
                link = entry.get("uri")
                break
    if not link:
        raise RuntimeError(f"event created ({data.get('id')}) but no Meet link in response")

    return {"link": link, "event_id": data.get("id"), "provider": "google"}


def cancel_meeting(event_id: str):
    """Best-effort deletion of the calendar event when a booking is cancelled."""
    if not (event_id and _google_configured()):
        return
    try:
        import requests
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request as GoogleRequest

        creds = service_account.Credentials.from_service_account_file(SA_FILE, scopes=_SCOPES)
        if IMPERSONATE:
            creds = creds.with_subject(IMPERSONATE)
        creds.refresh(GoogleRequest())
        requests.delete(
            f"https://www.googleapis.com/calendar/v3/calendars/{CALENDAR_ID}/events/{event_id}",
            headers={"Authorization": f"Bearer {creds.token}"},
            timeout=15,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[meet] failed to cancel event {event_id}: {exc}")
