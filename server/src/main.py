"""Amruni backend — FastAPI application assembly.

Local:  uvicorn src.main:app --port 4000
"""
import os
import threading
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .database.db import init_db
from .modules.auth import auth_router, me_router
from .modules.doctor import doctor_console_router, doctors_directory_router
from .modules.bookings import router as bookings_router
from .modules.ml import router as ml_router, train as train_ml
from .modules.pcos import router as pcos_router, train as train_pcos
from .modules.community import router as community_router
from .modules.mood import router as mood_router
from .modules.meds import router as meds_router
from .modules.sos import router as sos_router
from .modules.care import router as care_router

from .modules.auth import auth
from .modules.ml import ml as ml_mod
from .modules.pcos import pcos as pcos_mod

IS_PROD = os.environ.get("ENV", os.environ.get("NODE_ENV", "")) == "production"

init_db()

app = FastAPI(title="Amruni API", docs_url=None if IS_PROD else "/api/docs",
              openapi_url=None if IS_PROD else "/api/openapi.json")


def _warm_models():
    try:
        train_ml()
        train_pcos()
    except Exception as exc:
        print(f"[startup] model warm-up failed, will train on first use: {exc!r}")


@app.on_event("startup")
def _startup():
    threading.Thread(target=_warm_models, daemon=True).start()


# CORS settings
_origins_env = os.environ.get("ALLOWED_ORIGINS", "").strip()
if _origins_env:
    _origins = [o.strip() for o in _origins_env.split(",") if o.strip()]
else:
    _origins = ["*"] if IS_PROD else ["http://localhost:5173", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


# Include Routers
for router in (
    auth_router,
    me_router,
    doctors_directory_router,
    bookings_router,
    doctor_console_router,
    ml_router,
    pcos_router,
    community_router,
    mood_router,
    meds_router,
    sos_router,
    care_router,
):
    app.include_router(router, prefix="/api")


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "env": "production" if IS_PROD else "development",
        "modelsReady": ml_mod._models is not None and pcos_mod._models is not None,
        "commit": os.environ.get("RAILWAY_GIT_COMMIT_SHA", "local")[:8],
        "exposeOtp": auth.EXPOSE_OTP,
    }


@app.get("/api/{rest:path}", include_in_schema=False)
def api_not_found(rest: str):
    return JSONResponse(status_code=404, content={"error": f"No such endpoint: /api/{rest}"})


# Serve static frontend if present
DIST = Path(__file__).resolve().parent.parent / "amruni-app" / "dist"
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
    @app.get("/", include_in_schema=False)
    def root():
        return {
            "service": "Amruni API",
            "status": "ok",
            "health": "/api/health",
            "docs": None if IS_PROD else "/api/docs",
        }
