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

# api — from the REPO ROOT, not from server/ (see note below)
railway up --service amruni-api
```

> **Run `railway up` from the repo root.** The service's Root Directory is
> `/server`, so the uploaded build context has to *contain* a `server/` folder.
> Running `cd server && railway up` uploads server's *contents* at the top
> level, and nixpacks then fails looking for `/server` inside it:
> `Failed to read app source directory / No such file or directory (os error 2)`.
> The root `.railwayignore` keeps that upload under 1 MB by excluding
> `amruni-app/`, the virtualenvs, and the local database.

## Railway configuration

Project `amruni-api`, service `amruni-api`, with a **volume mounted at `/data`** —
Railway's filesystem is ephemeral, so without it every deploy would wipe all
accounts and bookings. `DB_PATH=/data/amruni.db` puts the SQLite database and the
cached ML models on that volume.

Variables set: `ENV=production`, `JWT_SECRET`, `DB_PATH`, `ADMIN_PASSWORD`,
`ALLOWED_ORIGINS` (the three Netlify origins — anything else is refused by CORS),
and `AMRUNI_DATA_KEY`.

### `AMRUNI_DATA_KEY`

The key every identifying and clinical field is encrypted with at rest (see
`server/app/crypto.py`). Generate 32 random bytes, base64-encoded:

```bash
python3 -c "import base64,os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"
```

Three things about it:

- **Set it before the first deploy, not after.** Without it the server refuses
  to start in production. That is deliberate: booting with a *different* key
  would write records the next boot cannot read, and the damage would only
  surface later as a chart that came back blank. A crash on startup is the safe
  failure.
- **Lose it and the data is gone.** There is no recovery — every encrypted
  field becomes permanently unreadable. Store it in a password manager the
  moment it is generated.
- **Rotation needs a script that does not exist yet.** `encrypt_existing_rows`
  migrates plaintext to ciphertext, not one key to another. Rotating means
  re-encrypting every row with both keys loaded; write that first.

Locally nothing is required — a development key is created at
`server/data/.datakey` (mode 0600) on first boot, and `server/data/` is
gitignored.

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
