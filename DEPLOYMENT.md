# Deployment

Amruni runs as **four** deployments: one API and three separate frontends, so each
audience gets its own domain and its own bundle.

| Surface | URL | Source |
|---|---|---|
| Patient app | https://amruni-patient.netlify.app | `src/apps/PatientApp.jsx` |
| Practitioner console | https://amruni-doctor.netlify.app | `src/apps/DoctorApp.jsx` |
| Admin portal | https://amruni-admin.netlify.app | `src/apps/AdminApp.jsx` |
| API (FastAPI) | https://amruni-api-production.up.railway.app | `server/` |

## How the three frontends are built from one codebase

`src/main.jsx` picks a root component from `VITE_APP_TARGET`, set at build time by
mode files (`.env.production`, `.env.doctor`, `.env.admin`). The import is
conditional, so each bundle tree-shakes down to only its own screens — roughly
185 kB each instead of the 1.1 MB monolith.

```bash
npm run build:patient   # → dist/patient   (default mode)
npm run build:doctor    # → dist/doctor    (--mode doctor)
npm run build:admin     # → dist/admin     (--mode admin)
npm run build:all       # all three
```

Because the console has its own domain, its routes drop the `/doctor` prefix:
`/` (login), `/today`, `/schedule`, `/patients`, `/patients/:id`, `/record/:id`,
`/account`. Cross-app links (e.g. "Practitioner? Sign in here") resolve through
`src/lib/siteLinks.js`, which reads `VITE_PATIENT_URL` / `VITE_DOCTOR_URL` and
falls back to in-app paths when unset.

`public/_redirects` ships `/*  /index.html  200` so client-side routes survive a
hard refresh on Netlify.

## Redeploying

```bash
# frontends
cd amruni-app && npm run build:all
netlify deploy --prod --dir dist/patient --site amruni-patient --no-build
netlify deploy --prod --dir dist/doctor  --site amruni-doctor  --no-build
netlify deploy --prod --dir dist/admin   --site amruni-admin   --no-build

# api
cd server && railway up
```

## Railway configuration

Project `amruni-api`, service `amruni-api`, with a **volume mounted at `/data`** —
Railway's filesystem is ephemeral, so without it every deploy would wipe all
accounts and bookings. `DB_PATH=/data/amruni.db` puts the SQLite database and the
cached ML models on that volume.

Variables set: `ENV=production`, `JWT_SECRET`, `DB_PATH`, `ADMIN_PASSWORD`, and
`ALLOWED_ORIGINS` (the three Netlify origins — anything else is refused by CORS).

`/api/health` is the health check; models warm up in a background thread so the
container passes it immediately.

## Credentials

Secrets live only in Railway's variable store. To read or rotate them:

```bash
cd server && railway variables            # view
railway variables --set "ADMIN_PASSWORD=..."   # rotate (triggers a redeploy)
```

Doctor sign-in uses a seeded practice number, e.g. `9876543210` (Dr. Ananya Sharma).

## Before real users

OTP codes are never returned to the client in production — they're printed to the
Railway logs until an SMS gateway is wired into `send_sms()` in
`server/app/auth.py`. That's fine for your own testing and blocking for anyone else.
