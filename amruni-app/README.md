# Amruni 🌺

An Indian women's health platform that brings telemedicine, mental health support (NIMHANS), fertility and cycle tracking, pregnancy care, and elderly appointment management into a single trusted space.

Amruni adapts to a woman's life stage — adolescent, reproductive age, post-partum, menopause, or elderly care set up by a family member — and is designed to feel like a safe container in private, emotionally loaded moments. The brand voice is **dignified, calm, and expert**: quiet authority over loud wellness-app energy.

This is a mobile-first prototype (a 430px app column) built with React, React Router, and Framer Motion. Data is mocked and persisted to `localStorage`; there is no backend yet.

## Getting started

Requires Node 18+ (developed on Node 24).

```bash
npm install
npm run dev      # start the dev server (Vite, HMR)
npm run build    # production build to dist/
npm run preview  # preview the production build
npm run lint     # run ESLint
```

Open the local URL Vite prints (default `http://localhost:5173/`).

**Dev note:** OTP verification accepts the code `123456`.

## Features

- **Telemedicine** — browse verified women's-health specialists, filter by specialty, book video / audio / chat consultations.
- **NIMHANS mental health** — "I need help" gateway to 24/7 support, PHQ-9 and GAD-7 screening tools, and an anonymous mode that hides identity from counsellors.
- **Cycle & fertility tracking** — a Flo-style calendar with phase prediction, daily flow and symptom logging.
- **Pregnancy mode** — week-by-week progress, milestones, sharing with trusted contacts, and an emergency alert.
- **Elderly care mode** — a caretaker-setup flow for a family member.
- **Settings** — life-stage switching, notification and privacy controls.

## Project structure

```
src/
├── main.jsx              # entry: Router + AppProvider + ToastProvider
├── App.jsx               # routes and auth/onboarding guards
├── index.css             # design tokens + component styles (single source of truth)
├── context/
│   └── AppContext.jsx    # global state (reducer + localStorage), cycle math
├── data/
│   └── mock.js           # doctors, screening questions, life stages, symptoms
├── components/
│   ├── AppShell.jsx      # tab layout + bottom nav
│   ├── BottomNav.jsx
│   ├── BottomSheet.jsx   # accessible modal sheet
│   ├── CycleCalendar.jsx
│   ├── OTPInput.jsx
│   ├── SuccessCheck.jsx  # self-drawing confirmation checkmark
│   └── Toast.jsx         # quiet confirmation toast (ToastProvider + useToast)
├── lib/
│   └── haptics.js        # tap / confirm / warn vibration intents
└── screens/
    ├── Splash.jsx        # animated camellia bloom
    ├── PhoneEntry.jsx · OTPVerify.jsx
    ├── LifeStage.jsx · ProfileSetup.jsx   # onboarding
    ├── Home.jsx
    ├── Telemedicine.jsx · MentalHealth.jsx
    ├── CycleTracker.jsx · Pregnancy.jsx
    └── Settings.jsx
```

## Design system

All design decisions live as tokens at the top of [`src/index.css`](src/index.css) — colours in **OKLCH**, plus type scale, spacing, radii, shadows, a semantic z-index scale, and motion easings/durations. Components reference tokens via CSS variables rather than hard-coded values.

- **Identity:** deep black, a vivid red camellia (the brand flower), and gold/amber accents.
- **Typography:** DM Sans for UI, Playfair Display for display headings.
- **Motion:** purposeful and restrained — exponential ease-out curves, 150–320ms. Delight is reserved for *moments* (a booking confirmed, a cycle logged, a pregnancy week reached), never slathered across pages.

### Accessibility

- WCAG AA contrast minimums; keyboard-navigable controls and ARIA roles on interactive elements.
- Larger tap targets and simpler layouts for elderly mode.
- Key animations honour `prefers-reduced-motion` (global CSS reduces CSS animations/transitions; some Framer Motion components use `useReducedMotion`).
- Layouts are built to tolerate text expansion for future multilingual support (Kannada, Tamil, Hindi).

## Status

Prototype / internship project. Mocked data, no server, no authentication beyond the dev OTP. Not for clinical use — the screening tools are educational and not a diagnosis.
