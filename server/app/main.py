"""Amruni backend — FastAPI application assembly.

Run:  uvicorn app.main:app --port 4000
In production it also serves the built frontend from ../amruni-app/dist so the
whole product ships as one process.
"""
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .db import init_db
from . import ml, pcos, routes_auth, routes_me, routes_doctors, routes_bookings, routes_doctor, routes_ml, routes_pcos

IS_PROD = os.environ.get("ENV", os.environ.get("NODE_ENV", "")) == "production"

init_db()
ml.train()    # cycle length model (FedCycle + synthetic tails)
pcos.train()  # PCOS risk models (clinical dataset)

app = FastAPI(title="Amruni API", docs_url=None if IS_PROD else "/api/docs",
              openapi_url=None if IS_PROD else "/api/openapi.json")

if not IS_PROD:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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
    return {"ok": True}


# ---------- static frontend (single-process deployment) ----------

DIST = Path(__file__).resolve().parent.parent.parent / "amruni-app" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        candidate = (DIST / path).resolve()
        if path and candidate.is_file() and candidate.is_relative_to(DIST):
            return FileResponse(candidate)
        return FileResponse(DIST / "index.html")
