# Amruni API on AWS

Backend on AWS, frontends on Netlify, talking to each other over HTTPS.

Everything here assumes one instance. That is a deliberate ceiling, not an
oversight — see [Why one instance](#why-one-instance) at the bottom.

---

## The three things that actually go wrong

Read these first. Each one fails in a way that does not look like its cause.

**1 · `AMRUNI_DATA_KEY` cannot be regenerated.**
Every name, phone number, date of birth, diagnosis, prescription and journal
entry is encrypted with it, and the encryption is authenticated: a wrong key
does not produce garbled text, it refuses to decrypt. Point a new key at a
restored database and every existing patient record is permanently unreadable.
The key is never stored in the database, by design, so there is no recovery.
Carry the existing value across, verify a record decrypts, *then* retire the
old host.

**2 · The API must serve HTTPS.**
Netlify serves the frontend over HTTPS, and a browser refuses to let an HTTPS
page call an HTTP API. The block happens in the browser, so the server logs
show nothing at all — it looks like the frontend simply stopped making
requests. This is why Caddy is in the stack.

**3 · If you build the image on an Apple Silicon Mac, set the platform.**
`docker build` on an M-series Mac produces an `arm64` image. A `t3`/`t2`/`m5`
instance is `x86_64` and will refuse it with `exec format error` — after a
build and push that both reported success. Either build on the instance (the
default below, which sidesteps this entirely) or pass
`--platform linux/amd64`, or run a Graviton instance (`t4g`).

---

## Setup

### 1 · Launch the instance

| Setting | Value |
|---|---|
| AMI | Amazon Linux 2023 |
| Type | `t3.small` (2 GB RAM — scikit-learn and pandas will not fit comfortably in `t3.micro`'s 1 GB) |
| Root volume | 20 GB gp3 |
| **Extra volume** | **10 GB gp3 — this is where the database lives** |
| Security group | inbound 22 (your IP only), 80, 443 |
| User data | paste [`user-data.sh`](./user-data.sh) |

Port 80 is not optional. Caddy answers the ACME HTTP challenge on it, and
without it no certificate is ever issued.

Give the instance an **Elastic IP**. A default public IP changes on stop/start,
and your DNS record — and therefore your certificate — silently stops matching.

### 2 · Point a domain at it

Create an `A` record for e.g. `api.yourdomain.com` → the Elastic IP.

You need a domain. Caddy cannot get a certificate for a raw IP or for an
`*.amazonaws.com` name, and neither can ACM. If you genuinely have no domain,
see [No domain](#no-domain) below.

### 3 · Fill in the secrets

SSH in, then:

```bash
sudo nano /opt/amruni/.env
```

`user-data.sh` has already written a skeleton with comments. Fill in
`JWT_SECRET`, `AMRUNI_DATA_KEY`, `ADMIN_PASSWORD`, `API_DOMAIN`, and set
`ALLOWED_ORIGINS` to your Netlify URLs.

To read the existing values out of the current Railway deployment, from
`server/` on your laptop with the Railway CLI authenticated:

```bash
railway variables --json
```

Generate fresh ones **only for a brand-new environment with no existing data**:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"                       # JWT_SECRET
python3 -c "import base64,os; print(base64.urlsafe_b64encode(os.urandom(32)).decode().rstrip('='))"  # AMRUNI_DATA_KEY
```

### 4 · Bring it up

```bash
sudo dnf install -y git
sudo git clone <your-repo-url> /opt/amruni/src
cd /opt/amruni/src

# Built on the instance, so the architecture always matches.
sudo docker build -t amruni-api:latest ./server

sudo API_IMAGE=amruni-api:latest \
  docker compose -f deploy/aws/docker-compose.prod.yml up -d
```

Watch the certificate get issued:

```bash
sudo docker compose -f deploy/aws/docker-compose.prod.yml logs -f caddy
```

### 5 · Check it

```bash
curl https://api.yourdomain.com/api/health
```

Expect `{"ok":true,"env":"production",...}`. `modelsReady` may be `false` for
the first minute or two while the ML models warm up in the background; that is
normal and the API serves requests throughout.

### 6 · Point the frontends at it

In `amruni-app/.env.production`, `.env.doctor` and `.env.admin`, set:

```
VITE_API_URL=https://api.yourdomain.com/api
```

**Note the `/api` suffix.** The value is the API root, not the host.

These are compiled into the bundle at build time, so this needs a Netlify
rebuild — setting them on a running site does nothing. Either commit the change
and let Netlify rebuild, or set `VITE_API_URL` in each site's build environment
(Site configuration → Environment variables) and trigger a deploy.

### 7 · Confirm both ends are talking

From the browser console on the live Netlify site:

```js
await fetch('https://api.yourdomain.com/api/health').then(r => r.json())
```

If this returns the health payload, CORS and TLS are both correct. If it throws
a CORS error, `ALLOWED_ORIGINS` does not contain that exact origin — scheme and
host, no trailing slash, no path.

---

## Updating

```bash
cd /opt/amruni/src
sudo git pull
sudo docker build -t amruni-api:latest ./server
sudo API_IMAGE=amruni-api:latest \
  docker compose -f deploy/aws/docker-compose.prod.yml up -d
```

The database is on the mounted volume, not in the container, so it is
untouched by this.

## Backups

One SQLite file, no replica. Set up a nightly copy to S3:

```bash
sudo tee /etc/cron.daily/amruni-backup >/dev/null <<'EOF'
#!/bin/bash
set -e
STAMP=$(date +%F)
# .backup, not cp — it takes a consistent snapshot of a live database, which a
# plain copy does not.
sqlite3 /opt/amruni/data/amruni.db ".backup /tmp/amruni-$STAMP.db"
aws s3 cp /tmp/amruni-$STAMP.db s3://your-bucket/backups/
rm -f /tmp/amruni-$STAMP.db
EOF
sudo chmod +x /etc/cron.daily/amruni-backup
```

Needs `sqlite3` (`sudo dnf install -y sqlite`), the AWS CLI, and an instance
role that can write to the bucket. Turn on bucket versioning.

**The backups are ciphertext and are worthless without `AMRUNI_DATA_KEY`.**
Store the key somewhere else — Secrets Manager — and confirm you can actually
retrieve it. A backup you cannot decrypt is not a backup.

---

## No domain

If you cannot get a domain, put CloudFront in front of the instance:
create a distribution whose origin is the EC2 public DNS name with origin
protocol **HTTP only**, and use the `*.cloudfront.net` URL as your API. That
gives you a trusted certificate for free.

You must then drop Caddy from the stack and publish the API on port 80
directly, and add the CloudFront domain to `ALLOWED_ORIGINS`. Set the cache
policy to **CachingDisabled** and forward the `Authorization` header — the
default policy strips it, and every authenticated request will come back 401
from a server that never saw a token.

This is more moving parts than a £10/year domain. Prefer the domain.

---

## Why one instance

The service keeps its data in a single SQLite file with `WEB_CONCURRENCY=1`.
That is right for the current stage and costs almost nothing to run, but it
means the API cannot be horizontally scaled as it stands — two tasks against
one file will contend for the write lock, and over a network filesystem risk
corruption.

Scaling means moving to RDS PostgreSQL. That is real work, not a config
change, because the data layer is written against SQLite's driver. Worth
knowing now so the infrastructure decision is made with the constraint visible.

The encryption is unaffected by such a move: fields are encrypted by the
application before they reach the database, so they migrate as ciphertext and
`AMRUNI_DATA_KEY` keeps working unchanged.

## ECS Fargate instead

If the requirement is specifically ECS, it works — mount EFS at `/data`, set
`DB_PATH=/data/amruni.db`, keep the service at **one** task, and put an ALB
with an ACM certificate in front. Expect roughly 4× the cost of the single
instance above for the same throughput, mostly ALB and EFS.

**App Runner will not work.** It has no persistent filesystem, so the database
is destroyed on every deployment. It would need the PostgreSQL migration first.
