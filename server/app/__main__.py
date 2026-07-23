"""Container entrypoint: `python -m app`.

Railway (and most PaaS) inject $PORT and expect the process to bind 0.0.0.0.
Running uvicorn programmatically keeps that logic in code rather than in a
platform-specific start command.
"""
import os

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",  # noqa: S104 — containers must bind all interfaces
        port=int(os.environ.get("PORT", 4000)),
        workers=int(os.environ.get("WEB_CONCURRENCY", 1)),
        proxy_headers=True,          # trust Railway's edge proxy
        forwarded_allow_ips="*",     # so request.url shows the public https URL
        access_log=os.environ.get("ACCESS_LOG", "1") != "0",
    )
