import uuid
from fastapi import APIRouter, HTTPException
from ...services.messaging import broadcast_sos
from ...config.settings import logger
from .models import ActivateRequest, LocationUpdateRequest, CancelRequest
from .helpers import create_distress_message, create_cancel_message

router = APIRouter()

# In-memory store for active sessions (for a real app, use Redis/DB)
active_sessions = {}

@router.post("/api/v1/sos/activate")
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

@router.post("/api/v1/sos/location")
async def update_location(req: LocationUpdateRequest):
    if req.sessionId not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session = active_sessions[req.sessionId]
    if session["status"] != "active":
        raise HTTPException(status_code=400, detail="Session is no longer active")
        
    # Update stored location
    session["location"] = req.location
    logger.info(f"Updated location for session {req.sessionId}: {req.location.lat}, {req.location.lng}")
    
    return {"message": "Location updated successfully"}

@router.post("/api/v1/sos/cancel")
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
