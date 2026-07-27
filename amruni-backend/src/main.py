import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config.settings import PORT
from .modules.sos.routes import router as sos_router

app = FastAPI(title="Amruni SOS Backend")

# Setup CORS to allow the frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # Vite defaults
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include modules routers
app.include_router(sos_router)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=PORT, reload=True)
