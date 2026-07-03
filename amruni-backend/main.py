import os
import uuid
import logging
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load env variables first
load_dotenv()

from services.messaging import broadcast_sos

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Amruni SOS Backend")

# Setup CORS to allow the frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # Vite defaults
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Models ---

class Location(BaseModel):
    lat: float
    lng: float

class Contact(BaseModel):
    id: str
    name: str
    phone: str

class ActivateRequest(BaseModel):
    userName: str
    contacts: List[Contact]
    location: Optional[Location] = None

class LocationUpdateRequest(BaseModel):
    sessionId: str
    location: Location
    
class CancelRequest(BaseModel):
    sessionId: str
    userName: str
    contacts: List[Contact]

# In-memory store for active sessions (for a real app, use Redis/DB)
active_sessions = {}

# --- Helpers ---

def create_maps_link(lat: float, lng: float) -> str:
    return f"https://maps.google.com/?q={lat},{lng}"

def create_distress_message(user_name: str, location: Optional[Location] = None) -> str:
    name = user_name or 'Someone'
    if location:
        link = create_maps_link(location.lat, location.lng)
        return f"URGENT: {name} needs help. Live location: {link}. Please call or reach them immediately."
    else:
        return f"URGENT: {name} needs help. Location is currently unavailable. Please call or reach them immediately."

def create_cancel_message(user_name: str) -> str:
    name = user_name or 'Someone'
    return f"UPDATE: {name} has cancelled the SOS alert and marked themselves as safe."

# --- Endpoints ---

@app.post("/api/v1/sos/activate")
async def activate_sos(req: ActivateRequest):
    logger.info(f"Received SOS activation for user: {req.userName}")
    
    session_id = str(uuid.uuid4())
    active_sessions[session_id] = {
        "userName": req.userName,
        "contacts": req.contacts,
        "location": req.location,
        "status": "active"
    }
    
    message_body = create_distress_message(req.userName, req.location)
    
    # Broadcast to all contacts
    results = broadcast_sos([c.model_dump() for c in req.contacts], message_body)
    
    return {
        "sessionId": session_id,
        "message": "SOS activated successfully",
        "results": results
    }

@app.post("/api/v1/sos/location")
async def update_location(req: LocationUpdateRequest):
    if req.sessionId not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session = active_sessions[req.sessionId]
    if session["status"] != "active":
        raise HTTPException(status_code=400, detail="Session is no longer active")
        
    # Update stored location
    session["location"] = req.location
    logger.info(f"Updated location for session {req.sessionId}: {req.location.lat}, {req.location.lng}")
    
    # In a fully fleshed out app, we might send an SMS update if they moved significantly.
    # For now, we just track it.
    
    return {"message": "Location updated successfully"}

@app.post("/api/v1/sos/cancel")
async def cancel_sos(req: CancelRequest):
    logger.info(f"Received SOS cancellation for session: {req.sessionId}")
    
    if req.sessionId in active_sessions:
        active_sessions[req.sessionId]["status"] = "cancelled"
    
    message_body = create_cancel_message(req.userName)
    
    # Broadcast cancellation to all contacts
    results = broadcast_sos([c.model_dump() for c in req.contacts], message_body)
    
    return {
        "message": "SOS cancelled successfully",
        "results": results
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
