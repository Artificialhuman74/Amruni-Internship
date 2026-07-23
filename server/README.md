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
PUT    /api/me/cycle                     PUT    /api/me/cycle/logs/{date}
GET    /api/me/cycle/predictions         (ML: period window, fertile days,
                                          history, symptom forecast, insights,
                                          PCOS signal + PCOS-widened window)
POST   /api/me/pcos-screening            (ML: risk band + top factors)
GET/POST/DELETE /api/me/conditions[/{name}]   (patient-managed, e.g. PCOS)
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

## Cycle intelligence (ML)

`app/ml.py` trains three quantile gradient-boosting models (p15/p50/p85) that predict the next cycle length from a user's logged history (last lengths, rolling mean/spread, cycle count, age).

**Training data — real:** the model trains on the **FedCycle dataset** (Fehring et al.: 1,665 charted cycles from 159 women, `cycle tracking datasets/FedCycleData071012__2_.sav`), turned into ~1,360 autoregressive rows (each cycle predicted from the woman's preceding cycles, grouped by `ClientID` so there's no leakage). FedCycle's ages only span 21–43, so those real rows (upweighted 3×) are augmented with a synthetic cohort covering the adolescent and perimenopausal tails, where cycles run longer and more variable. Trains once at first boot (~5 s, cached at `data/cycle_model.joblib`); if the .sav is absent it falls back to synthetic-only so deployments without it still work. Point `FEDCYCLE_PATH` elsewhere to override.

**Held-out validation** (20% of women unseen in training): p50 median error **1.48 days**, mean 2.26 days (beats the naive "same as last cycle" baseline at 2.77), and the p15–p85 window covers **76%** of real next-cycles — well-calibrated against its 70% target.

At inference it personalizes with the user's real logged periods (derived from flow days; spotting alone never starts a cycle) and reports an honest confidence window. Symptom forecasting blends the user's own logged frequencies with population phase priors (Beta smoothing). Delete the joblib to retrain.

### PCOS risk screening

`app/pcos.py` trains two logistic-regression models on the **Kottarathil clinical PCOS dataset** (`PCOS_data_without_infertility.xlsx`, 541 patients):

- **full** — 9 self-reportable features (irregular cycles, weight gain, excess hair growth, skin darkening, acne, BMI, age, exercise, fast food). 5-fold CV **AUC 0.88**. Powers the in-app self-check questionnaire (`POST /api/me/pcos-screening`), returning a risk **band** (low/moderate/high), calibrated probability, and the user's top contributing factors — a screening aid that routes to a specialist, never a diagnosis.
- **cycle** — menstrual features only (irregularity, age, BMI, weight gain). 5-fold CV **AUC 0.82**. Runs passively on the user's own derived cycle stats to surface a "worth a check" hint on the tracker.

The dataset's coded `Cycle length(days)` column is uncorrelated with PCOS (noise), so cycle length is deliberately excluded — irregularity carries the menstrual signal. Cached at `data/pcos_model.joblib`; falls back to a transparent rule-based scorer if the dataset or sklearn is absent.

When a patient flags **PCOS** via `POST /api/me/conditions`, the cycle predictor reads it and **widens the period window** (and drops confidence), because PCOS cycles are naturally longer and more variable — an honest wide window beats a falsely precise date.

## Deploying to Railway

The `server/` directory is self-contained (datasets included), so deploy it as its own service.

**1. Create the service.** New Project → Deploy from GitHub repo → select this repo. Then in **Settings → Root Directory** set `server`. Railway reads [`railway.json`](railway.json) and Nixpacks installs `requirements.txt` using the Python in `runtime.txt`.

**2. Add a Volume** — *this is the step people skip.* Railway's filesystem is wiped on every deploy, so without a volume you lose every account and booking. Service → **Variables → + Volume**, mount path `/data`.

**3. Set variables** (Service → Variables). Full list in [`.env.example`](.env.example):

| Variable | Value |
|---|---|
| `ENV` | `production` |
| `JWT_SECRET` | `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `DB_PATH` | `/data/amruni.db` (inside the volume) |
| `ADMIN_PASSWORD` | your admin-portal password |

Everything else is optional — payments fall back to a mock provider and video to Jitsi rooms until you add Razorpay/Google credentials.

**4. Generate a domain.** Settings → Networking → Generate Domain. That URL is your API base.

Do **not** set `PORT` — Railway injects it and `python -m app` binds `0.0.0.0:$PORT` automatically.

### What happens on boot

`/api/health` answers immediately; the ML models train in a background thread (~10 s on first boot) and cache next to the database, so restarts load them instantly. `GET /api/health` reports `{"ok": true, "modelsReady": true|false}` — Railway's health check only needs `ok`.

If `JWT_SECRET` is missing in production the process exits immediately with a clear message rather than starting insecurely.

### Deploying the web app too

Optional. Either add a second Railway service with root `amruni-app` (static build), or build the frontend into `amruni-app/dist` and deploy the repo root — the API serves the SPA when `dist/` exists, and returns a small JSON banner at `/` when it doesn't.

## Building an Android client

The API is mobile-ready: stateless **Bearer-token** auth (no cookies, no CSRF), JSON everywhere, and permissive CORS (irrelevant for native HTTP clients, but set for WebView/Capacitor).

**Base URL:** `https://<your-service>.up.railway.app/api`

**Auth flow:**
1. `POST /auth/request-otp` `{"phone": "9876543210"}` → `{"sent": true}`. In production the code is delivered by SMS (wire a gateway into `send_sms()` in `app/auth.py`); outside production it's returned as `devCode` for testing.
2. `POST /auth/verify-otp` `{"phone", "code"}` → `{"token", user, cycle, pregnancy, settings}`.
3. Store the token (Android `EncryptedSharedPreferences`) and send `Authorization: Bearer <token>` on every call. Tokens last 30 days; on `401` clear it and re-run the OTP flow.

**Practitioner sign-in** is the same but `POST /doctor/verify-otp`, and the number must belong to a registered doctor. That token carries a doctor role — patient tokens get `403` on `/doctor/*` and vice-versa.

All errors share one shape — `{"error": "human readable message"}` with a real HTTP status — so a single Retrofit/Ktor error interceptor covers the whole API. Endpoint list is above; run the server locally with `ENV` unset and open `/api/docs` for an interactive OpenAPI reference while you build.

## Deploying anywhere else

Any Python 3.11+ host with a persistent disk:

```bash
cd server && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
ENV=production JWT_SECRET=<long-random-string> DB_PATH=/var/lib/amruni/amruni.db \
  PORT=8080 .venv/bin/python -m app
```

To serve the web app from the same process, build it first (`cd amruni-app && npm ci && npm run build`) and deploy the repo root instead of `server/`.
