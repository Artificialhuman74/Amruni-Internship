# Amruni 🌺

An Indian women's health platform that brings telemedicine, mental health support (NIMHANS), fertility and cycle tracking, pregnancy care, and elderly appointment management into a single trusted space.

Amruni adapts to a woman's life stage — adolescent, reproductive age, post-partum, menopause, or elderly care set up by a family member — and is designed to feel like a safe container in private, emotionally loaded moments. The brand voice is **dignified, calm, and expert**: quiet authority over loud wellness-app energy.

The product is two packages:

- **`amruni-app/`** — a mobile-first React frontend (a 430px app column) built with React Router and Framer Motion.
- **`server/`** — a Python backend (FastAPI + SQLite): phone-OTP authentication issuing JWTs, per-user health state (profile, cycle, pregnancy, settings, screenings), and an automatic consultation marketplace — doctors publish priced availability slots, the consumer picks one and pays, and the Google Meet link is generated the moment payment succeeds. See [server/README.md](server/README.md) for the flow, API reference, and deployment guide.

## Getting started

Requires Node 20.19.x, 22.13.x, or >=24 for the frontend and Python 3.10+ for the backend.

```bash
# terminal 1 — backend on :4000 (SQLite DB auto-created, doctors + demo slots seeded)
cd server
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python3 -m src

# terminal 2 — frontend on :5173 (Vite proxies /api to the backend)
cd amruni-app && npm install && npm run dev
```

Open the local URL Vite prints (default `http://localhost:5173/`). Other frontend scripts: `npm run build:all` (builds all patient, doctor, and admin targets), `npm run dev`, `npm run lint`.

**OTP in development:** codes are randomly generated per request and expire in 5 minutes. Without an SMS gateway configured, the code is returned in the API response and shown on the OTP screen (and logged by the server). In production (`ENV=production`) codes are never exposed — wire an SMS provider into `send_sms()` in `server/src/modules/auth/auth.py`.

**Payments & Google Meet:** the payment provider defaults to a mock (instant success) so the full book → pay → meet-link flow runs out of the box; set Razorpay keys for real payments. Meet links come from the Google Calendar API when a service account is configured, with a dev fallback otherwise — see [server/README.md](server/README.md).

**Single-process deployment:** build the frontend, then start the server with `ENV=production` and a `JWT_SECRET` — it serves the built app and the API from one port.

## Features

- **Telemedicine** — browse verified women's-health specialists, filter by specialty. Doctors publish priced availability slots; booking locks the slot, payment confirms it, and a Google Meet link is generated automatically. Chat consultations connect instantly over WhatsApp.
- **Doctor console** (`/doctor`) — a practitioner-side app in the same column: OTP sign-in with the registered practice number, today's consultation queue with one-tap join, availability publishing, and a full E-medical-records system — per-consultation records (diagnosis, vitals, structured prescriptions, follow-ups), per-patient charts (allergies, conditions, vitals history), and lab/report document storage. Saving a record puts the real prescription on the patient's consultation summary.
- **NIMHANS mental health** — "I need help" gateway to 24/7 support, PHQ-9 and GAD-7 screening tools, and an anonymous mode that hides identity from counsellors.
- **Cycle & fertility tracking** — a Flo-style calendar with daily flow and symptom logging, backed by **ML predictions**: personalized from your own logged cycles. Plus symptom forecasting per phase, cycle history with regularity analysis, and personalized insight cards.
- **PCOS risk self-check** — risk screening model trained on a clinical PCOS dataset (541 patients, AUC 0.88) returns a risk band with the factors that drove it, and routes higher-risk users into the doctor-booking flow. Educational screening, not a diagnosis.
- **Pregnancy mode** — week-by-week progress, milestones, sharing with trusted contacts, and an emergency alert.
- **Elderly care mode** — a caretaker-setup flow for a family member.
- **Settings** — life-stage switching, notification and privacy controls.

## Project structure

```
server/src/
├── main.py               # FastAPI router assembly and app setup
├── __main__.py           # Programmatic Uvicorn runner (entrypoint)
├── config/
│   └── settings.py       # Configuration environment loading
├── database/
│   └── db.py             # SQLite connection and schema setup
├── services/             # Integrations (meet.py, payments.py)
└── modules/              # Domain-driven feature routes and controllers
    ├── auth/             # OTP login and token validation
    ├── bookings/         # Booking lifecycle and payments
    ├── care/             # Caretaker sharing links
    ├── community/        # Community discussions and thread posts
    ├── doctor/           # Doctor listings, availability and EMR (records, charts)
    ├── meds/             # Reminders and pill trackers
    ├── ml/               # Period predictor autoregressive ML models
    ├── mood/             # Mood checkins and log analytics
    ├── pcos/             # Logistic regression risk screening model
    └── sos/              # SOS contacts ledger and alerts

amruni-app/src/
├── app/
│   ├── index.jsx         # App entrypoint (StrictMode + context wrappers)
│   ├── routes/           # Core entry components: PatientApp, DoctorApp, AdminApp
│   ├── providers/        # State context providers (AppContext, MoodContext, VideoContext)
│   └── layouts/          # Layout frames: AppShell, BottomNav
├── components/common/    # Reusable UI components (Logo, SuccessCheck, Toast, Icons, etc.)
├── features/             # Domain-driven features (logic + views)
│   ├── auth/             # Sign-in & onboarding screens
│   ├── cycle-tracker/    # Cycle charts, trackers, calendar & checkins
│   ├── pregnancy/        # Kick counter, bloom visualization, due date form
│   ├── sos/              # SOS button, banner, alerts & contacts
│   ├── telemedicine/     # Appointments, doctor today, schedule, charts, logs & video rooms
│   ├── community/        # Discussion thread feeds & post composer
│   ├── journal/          # Mood-correlated daily journal logs
│   ├── medicines/        # Medical calendars & reminders
│   ├── care/             # Caretaker viewing share link feeds
│   ├── pcos/             # PCOS risk screening test questionnaire
│   └── settings/         # Settings panel & profile config
├── services/             # Firebase integration, service workers, offline support
│   └── api/              # Axios API bindings (api.js, appointmentApi.js, doctorApi.js, etc.)
├── utils/                # Helper libraries (haptics, lifecourse, site links)
├── constants/            # Static datasets (mock metrics, PCOS screening forms)
└── styles/               # CSS styles (index.css)
```ile)
        ├── DoctorToday.jsx                     # queue, next-up card, join, stats
        ├── DoctorSchedule.jsx                  # publish priced availability
        ├── DoctorPatients.jsx · DoctorPatientChart.jsx  # EMR: flags, vitals, records, documents
        └── DoctorRecordEditor.jsx · DoctorAccount.jsx
```

## Design system

All design decisions live as tokens at the top of [`src/index.css`](src/index.css) — colours in **OKLCH**, plus type scale, spacing, radii, shadows, a semantic z-index scale, and motion easings/durations. Most components reference tokens via CSS variables, with a few remaining hard-coded values in places like SVG/console styling.

- **Identity:** deep black, a vivid red camellia (the brand flower), and gold/amber accents.
- **Typography:** DM Sans for UI, Playfair Display for display headings.
- **Motion:** purposeful and restrained — exponential ease-out curves, 150–320ms. Delight is reserved for *moments* (a booking confirmed, a cycle logged, a pregnancy week reached), never slathered across pages.

### Accessibility

- WCAG AA contrast minimums; keyboard-navigable controls and ARIA roles on interactive elements.
- Larger tap targets and simpler layouts for elderly mode.
- Key animations honour `prefers-reduced-motion` (global CSS reduces CSS animations/transitions; some Framer Motion components use `useReducedMotion`).
- Layouts are built to tolerate text expansion for future multilingual support (Kannada, Tamil, Hindi).

## Status

Internship project. Real backend (FastAPI + SQLite) with OTP/JWT authentication, per-user server-side persistence, doctor-managed slot inventory with atomic booking, a payment → meeting-link pipeline, and server-side admin auth (`ADMIN_PASSWORD`). Meeting links use the Google Meet API when a service account is configured, and fall back to joinable Jitsi rooms until then. Before public launch: an SMS gateway, Razorpay keys, a Google service account, and a strong `ADMIN_PASSWORD`. Not for clinical use — the screening tools are educational and not a diagnosis.
