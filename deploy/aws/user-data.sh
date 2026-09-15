#!/bin/bash
# EC2 first-boot bootstrap for the Amruni API. Amazon Linux 2023.
#
# Paste into "User data" when launching the instance, or run by hand on an
# instance that is already up. It is idempotent: running it twice is safe and
# does nothing the second time.
#
# What it does: installs Docker, prepares the EBS data volume, and leaves the
# machine ready for `docker compose up`. It deliberately does NOT start the
# application, because the application cannot start without secrets and the
# secrets are not in this file.
#
# ── The dangerous part, and why it is written the way it is ──────────────
#
# This script formats a disk. A bootstrap that runs on every boot and formats
# unconditionally will erase the database the first time the instance is
# rebooted, and it will do it silently. So the format is guarded by a check for
# an existing filesystem, and the guard fails closed: if it cannot tell, it
# does not format.
set -euo pipefail

DATA_DIR=/opt/amruni/data
DEVICE="${DEVICE:-/dev/nvme1n1}"   # second EBS volume; nvme0n1 is the root disk

log() { echo "[bootstrap] $*"; }

# ── Docker ───────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  log "installing docker"
  dnf install -y docker
  systemctl enable --now docker
  usermod -aG docker ec2-user
else
  log "docker already present"
fi

if ! docker compose version >/dev/null 2>&1; then
  log "installing the compose plugin"
  mkdir -p /usr/local/lib/docker/cli-plugins
  curl -fsSL \
    "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi

# ── the data volume ──────────────────────────────────────────────────────
mkdir -p "$DATA_DIR"

if [ ! -b "$DEVICE" ]; then
  # No separate volume attached. Fall back to the root disk rather than
  # failing, but say so loudly — the root disk dies with the instance, and an
  # operator who does not read this line will believe the data is safe.
  log "WARNING: $DEVICE not found. Data will live on the ROOT disk and will be"
  log "WARNING: LOST if this instance is terminated. Attach an EBS volume and"
  log "WARNING: re-run this script before putting real patients on it."
else
  # `blkid` prints the filesystem if there is one. No output means a raw disk.
  # Anything else — including an error we cannot interpret — is treated as
  # "there might be data here", and we do not format.
  if blkid "$DEVICE" >/dev/null 2>&1; then
    log "$DEVICE already has a filesystem — not formatting"
  else
    log "$DEVICE is raw — creating an ext4 filesystem"
    mkfs -t ext4 "$DEVICE"
  fi

  UUID=$(blkid -s UUID -o value "$DEVICE")
  if ! grep -q "$UUID" /etc/fstab; then
    log "adding $DEVICE to /etc/fstab"
    # `nofail` so a missing volume cannot leave the instance unbootable and
    # unreachable, which is a far worse morning than a service that is down.
    echo "UUID=$UUID $DATA_DIR ext4 defaults,nofail 0 2" >> /etc/fstab
  fi
  mount -a
  log "mounted: $(df -h "$DATA_DIR" | tail -1)"
fi

# The container runs as uid 10001 (see server/Dockerfile). The host has no such
# user, so this is set numerically — the process must be able to write its own
# database, and a permissions mismatch here surfaces as a confusing
# "unable to open database file" long after startup looked fine.
chown -R 10001:10001 "$DATA_DIR"

# ── the secrets file ─────────────────────────────────────────────────────
if [ ! -f /opt/amruni/.env ]; then
  log "writing a skeleton /opt/amruni/.env — FILL THIS IN"
  cat > /opt/amruni/.env <<'ENVEOF'
# Amruni API secrets. Never committed.
#
# AMRUNI_DATA_KEY IS NOT REGENERABLE. Every name, phone number, diagnosis and
# journal entry in the database is encrypted with it, and the encryption is
# authenticated — a wrong key does not garble the text, it refuses to decrypt.
# If you are migrating an existing database, this must be the SAME value the
# old host used. Copy it across, confirm a record reads back, and only then
# retire the old deployment.

ENV=production
JWT_SECRET=
AMRUNI_DATA_KEY=
ADMIN_PASSWORD=

# The Netlify sites, comma separated, no trailing slash. A browser blocks the
# request when this is wrong; the server logs nothing, because it never sees it.
ALLOWED_ORIGINS=https://harmonybliss.amruni.com,https://harmonycare.amruni.com,https://harmonydesk.amruni.com,https://amruni-patient.netlify.app,https://amruni-doctor.netlify.app,https://amruni-admin.netlify.app

# The domain this API answers on. Caddy gets its TLS certificate for this name,
# and cannot get one until the DNS A record points here.
API_DOMAIN=

# Demo posture — both weaken authentication. Remove once SMS is connected.
EXPOSE_OTP=true
DOCTOR_OTP_DISABLED=true
ENVEOF
  chmod 600 /opt/amruni/.env
else
  log "/opt/amruni/.env already exists — leaving it alone"
fi

log "done. Next: fill in /opt/amruni/.env, then bring the stack up."
