"""Container entrypoint: `python -m src`.

Railway (and most PaaS) inject $PORT and expect the process to bind 0.0.0.0.
Running uvicorn programmatically keeps that logic in code rather than in a
platform-specific start command.
"""
import os

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 4000)),
        workers=int(os.environ.get("WEB_CONCURRENCY", 1)),
        proxy_headers=True,
        forwarded_allow_ips="*",
        access_log=os.environ.get("ACCESS_LOG", "1") != "0",
    )
