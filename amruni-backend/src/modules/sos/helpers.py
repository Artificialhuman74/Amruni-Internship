from typing import Optional
from .models import Location

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
