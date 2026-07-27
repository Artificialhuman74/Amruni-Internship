from typing import List, Optional
from pydantic import BaseModel

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
