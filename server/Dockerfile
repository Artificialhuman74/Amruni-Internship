# Amruni API — production image.
#
# Build context is this directory (server/), not the repository root:
#
#   docker build -t amruni-api ./server
#
# Two stages. The builder carries a C toolchain because pyreadstat — the
# reader for the FedCycle .sav dataset — falls back to compiling from source
# whenever a matching manylinux wheel is missing for the interpreter, and a
# build that works on your laptop and fails in CI three months later because a
# wheel was withdrawn is not worth the 300 MB it saves. The runtime stage keeps
# the compiled virtualenv and none of the toolchain.
#
# ── The one thing that will bite you ─────────────────────────────────────
#
# This service keeps its data in a SQLite file, and caches its two trained ML
# models beside it. Both live under DB_PATH's directory, which MUST be a mounted
# volume that survives the container. Run this image with no volume and it will
# start, work perfectly, and lose every patient record the next time it is
# replaced. The VOLUME line below declares the intent; it does not enforce it.

# ── build ────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Dependencies first and alone, so editing application code does not re-resolve
# and re-download scikit-learn, pandas and numpy on every build.
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt


# ── runtime ──────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH" \
    PORT=8000 \
    DB_PATH=/data/amruni.db

# libgomp is scikit-learn's OpenMP runtime. It is present in the builder via
# build-essential and absent from a bare slim image, so without this the import
# of sklearn fails at startup with a bare "libgomp.so.1: cannot open shared
# object file" — after a build that looked completely successful.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv

# Unprivileged. A container that is root inside is one container-escape away
# from being root outside, and nothing this process does needs the privilege.
RUN useradd --create-home --uid 10001 amruni

WORKDIR /srv

# `python -m app` resolves the package from the working directory, and ml.py
# resolves the datasets as <parent of app/>/datasets — so this layout is load
# bearing, not cosmetic.
COPY --chown=amruni:amruni app/ ./app/
COPY --chown=amruni:amruni datasets/ ./datasets/

# Created and owned here so a fresh named volume mounts writable. Docker copies
# the image's ownership onto an empty volume at first mount; without this the
# directory arrives owned by root and the unprivileged process cannot open the
# database for writing.
#
# Deliberately no VOLUME instruction. Railway builds this same Dockerfile and
# rejects the build outright if one is present ("docker VOLUME is not
# supported, use Railway Volumes"), and it adds nothing anywhere else: the
# volume is attached at run time by compose, ECS or Railway regardless.
#
# On Railway the volume is mounted root-owned, so the service sets
# RAILWAY_RUN_UID=0 to run as root there. Without it the unprivileged user
# cannot write the existing production database.
RUN mkdir -p /data && chown -R amruni:amruni /data

USER amruni
EXPOSE 8000

# No curl or wget in a slim image, so the check uses the interpreter that is
# certainly present. /api/health returns 200 as soon as the app can serve;
# `modelsReady` in its body reports the background ML warm-up separately, which
# is why start-period is generous but the interval is not.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD python -c "import os,sys,urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:' + os.environ.get('PORT','8000') + '/api/health', timeout=4).status == 200 else 1)"

CMD ["python", "-m", "app"]
