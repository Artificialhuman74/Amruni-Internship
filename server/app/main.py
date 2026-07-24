"""Amruni backend — FastAPI application assembly.

Local:  uvicorn app.main:app --port 4000
Railway: `python -m app` (see __main__.py) binds 0.0.0.0:$PORT.

In production it also serves the built frontend from ../amruni-app/dist when
present, so web and API can ship as one service. Native clients (the Android
app) just call /api/* directly.
"""
import os
import threading
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .db import init_db
from . import auth, ml, pcos, routes_auth, routes_me, routes_doctors, routes_bookings, routes_doctor, routes_ml, routes_pcos

IS_PROD = os.environ.get("ENV", os.environ.get("NODE_ENV", "")) == "production"

init_db()

app = FastAPI(title="Amruni API", docs_url=None if IS_PROD else "/api/docs",
              openapi_url=None if IS_PROD else "/api/openapi.json")

# Models train in the background so the container answers its health check
# immediately. Prediction endpoints call ml/pcos lazily and will block only on
# the first request if training hasn't finished (a few seconds, once per boot).
def _warm_models():
    try:
        ml.train()
        pcos.train()
    except Exception as exc:  # noqa: BLE001 — never let warm-up kill the app
        print(f"[startup] model warm-up failed, will train on first use: {exc!r}")


@app.on_event("startup")
def _startup():
    threading.Thread(target=_warm_models, daemon=True).start()


# CORS. Native Android/iOS clients don't enforce CORS, but WebViews, Capacitor
# and the web build do. ALLOWED_ORIGINS is a comma-separated list; "*" allows
# any origin (safe here because auth is a Bearer token, not a cookie).
_origins_env = os.environ.get("ALLOWED_ORIGINS", "").strip()
if _origins_env:
    _origins = [o.strip() for o in _origins_env.split(",") if o.strip()]
else:
    _origins = ["*"] if IS_PROD else ["http://localhost:5173", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,   # Bearer tokens, no cookies
    allow_methods=["*"],
    allow_headers=["*"],
)


# The frontend reads errors from {"error": ...}; normalize FastAPI's default.
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    print(f"[error] {request.method} {request.url.path}: {exc!r}")
    return JSONResponse(status_code=500, content={"error": "Something went wrong. Please try again."})


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    return response


for module in (routes_auth, routes_me, routes_doctors, routes_bookings, routes_doctor, routes_ml, routes_pcos):
    app.include_router(module.router, prefix="/api")


@app.get("/api/health")
def health():
    """Railway health check. Returns ok as soon as the app can serve requests;
    `modelsReady` tells you whether background ML warm-up has finished."""
    return {
        "ok": True,
        "env": "production" if IS_PROD else "development",
        "modelsReady": ml._models is not None and pcos._models is not None,
        # Deploy diagnostics: which commit is running and whether the OTP demo
        # escape hatch is active. Lets us confirm a redeploy actually took.
        "commit": os.environ.get("RAILWAY_GIT_COMMIT_SHA", "local")[:8],
        "exposeOtp": auth.EXPOSE_OTP,
    }


# API 404s must stay JSON — without this the SPA catch-all below would return
# index.html for a mistyped endpoint, which is baffling from a mobile client.
@app.get("/api/{rest:path}", include_in_schema=False)
def api_not_found(rest: str):
    return JSONResponse(status_code=404, content={"error": f"No such endpoint: /api/{rest}"})


# ---------- static frontend (optional single-process deployment) ----------

# Serve a built SPA only if one is present as dist/index.html + dist/assets.
# Since the frontend split into per-app builds (dist/patient, dist/doctor,
# dist/admin), a bare dist/ has no index.html — so this stays off and the API
# runs headless, which is the norm now (each app is hosted separately).
DIST = Path(__file__).resolve().parent.parent.parent / "amruni-app" / "dist"
_SERVE_SPA = (DIST / "index.html").is_file() and (DIST / "assets").is_dir()

if _SERVE_SPA:
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        candidate = (DIST / path).resolve()
        if path and candidate.is_file() and candidate.is_relative_to(DIST):
            return FileResponse(candidate)
        return FileResponse(DIST / "index.html")
else:
    # API-only deployment (Railway root = server/, or split frontends): the
    # apps are hosted separately and just call /api/*.
    @app.get("/", include_in_schema=False)
    def root():
        return {
            "service": "Amruni API",
            "status": "ok",
            "health": "/api/health",
            "docs": None if IS_PROD else "/api/docs",
        }
