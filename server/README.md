# Amruni server

Python backend (FastAPI + SQLite) for the Amruni app. Phone-OTP authentication issuing 30-day JWTs, per-user health state, and a fully automatic consultation marketplace: **doctors publish priced availability slots → the consumer picks a slot and pays → the Google Meet link is generated and attached to the appointment the moment payment succeeds.**

In production it also serves the built frontend from `../amruni-app/dist`, so the whole product runs as a single process.

## Run

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 4000 --reload   # dev
```

The SQLite database is created automatically at `data/amruni.db` (WAL mode) and seeded with 12 doctors plus a week of demo availability on first boot. Interactive API docs at `/api/docs` (dev only).

## The automatic booking flow

```
Doctor (admin portal)                    Consumer (app)
─────────────────────                    ──────────────
POST /api/doctors/{id}/slots             GET  /api/doctors/{id}/slots
  {date, start, end,                       → open, future slots with prices
   durationMinutes, price}
  → range expands into                   POST /api/bookings {slotId, mode, reason}
    bookable slots                         → slot locked ATOMICALLY (409 if taken)
                                           → appointment 'pending_payment'
                                           → payment order returned

                                         POST /api/payments/{id}/confirm
                                           → payment verified
                                           → slot 'booked', appointment 'confirmed'
                                           → Google Meet link generated + stored
```

Slot state machine: `open → locked → booked`. Locks expire after 10 minutes so an abandoned checkout never blocks a slot (the matching unpaid appointment is auto-cancelled). Cancelling a confirmed appointment reopens the slot, marks the payment refunded, and deletes the calendar event.

## Payments

Provider-agnostic (`app/payments.py`):

- **mock** (default) — no external calls; the in-app "Pay" button confirms instantly. Lets the whole flow run in development and demos.
- **Razorpay** — set `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`. Orders are created via the Razorpay Orders API and payments verified with the documented HMAC-SHA256 signature check. The booking response includes `keyId`/`orderId` for Razorpay Checkout; pass its `paymentId` + `signature` to the confirm endpoint.

## Google Meet

`app/meet.py` creates a Google Calendar event with a Meet conference via the Calendar API:

| Variable | Purpose |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_FILE` | path to a service-account JSON key |
| `GOOGLE_CALENDAR_ID` | calendar for consultation events (default `primary`) |
| `GOOGLE_IMPERSONATE_SUBJECT` | Workspace user to impersonate — Meet conference creation requires domain-wide delegation |
| `MEET_TIMEZONE` | default `Asia/Kolkata` |

Without Google credentials it falls back to **Jitsi Meet** (`meet.jit.si/Amruni-<random>`) — anonymous, credential-free rooms that actually work, flagged `meetProvider: "jitsi"` — so every paid booking gets a joinable meeting even before Google is configured. A Google API failure after payment also falls back to Jitsi rather than leaving a paid booking without a meeting.

## Other environment

| Variable | Default | Notes |
|---|---|---|
| `ENV` | dev | Set `production` to hide OTP dev codes, require `JWT_SECRET`, disable `/api/docs` |
| `JWT_SECRET` | dev fallback | **Required in production** |
| `DB_PATH` | `data/amruni.db` | Point at a persistent volume when deploying |
| `ADMIN_PASSWORD` | `amruni` (dev only) | Verified server-side by `POST /api/admin/login`, which issues a 12h admin token (sent as `X-Admin-Key`). **No production default** — unset in production disables password login |
| `ADMIN_PHONES` | unset | Comma-separated phone allowlist: these signed-in users can manage doctors/slots without the portal password |

Doctor and slot management requires an admin token or an allow-listed phone — an ordinary signed-in user cannot touch them.

OTP codes are random 6-digit, SHA-256 hashed at rest, expire in 5 minutes, 5 attempts, 30s resend cooldown. Without an SMS gateway they're returned in the dev response and logged; wire one into `send_sms()` in `app/auth.py`.

## Endpoint summary

```
POST   /api/auth/request-otp             POST   /api/auth/verify-otp
POST   /api/admin/login                  (password → 12h admin token)

GET    /api/me                           PATCH  /api/me
PUT    /api/me/state                     POST/GET /api/me/screenings

GET    /api/doctors                      GET    /api/doctors/{id}
POST   /api/doctors            (admin)   DELETE /api/doctors/{id}      (admin)
GET    /api/doctors/{id}/slots (public)  POST   /api/doctors/{id}/slots (admin)
DELETE /api/slots/{id}         (admin)

POST   /api/bookings                     POST   /api/payments/{id}/confirm
GET    /api/appointments                 GET    /api/appointments/{id}
DELETE /api/appointments/{id}            POST   /api/appointments/{id}/complete
POST   /api/video/rooms                  GET    /api/health

# Doctor console (doctor-role JWT from /api/doctor/verify-otp; the phone must
# match a registered practitioner — accounts are never auto-created)
POST   /api/doctor/verify-otp            GET    /api/doctor/me
GET    /api/doctor/appointments          GET/POST/DELETE /api/doctor/slots[/{id}]
GET/PUT /api/doctor/appointments/{id}/record        # saving completes the consult
GET    /api/doctor/patients              GET/PUT /api/doctor/patients/{uid}/chart
POST/GET/DELETE /api/doctor/patients/{uid}/documents[/{id}]
```

Doctor access to a patient's chart requires an appointment relationship with that patient; other doctors get 404. Consultation records flow back onto the patient's appointment payload, so her e-prescription is the real one.

All user data is scoped to the authenticated user; cross-user access returns 404.

## Deploying

Any Python 3.11+ host with a persistent disk:

```bash
cd amruni-app && npm ci && npm run build
cd ../server && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
ENV=production JWT_SECRET=<long-random-string> .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 4000
```
