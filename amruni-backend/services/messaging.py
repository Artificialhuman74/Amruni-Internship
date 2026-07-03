import os
import logging
from typing import List, Dict, Any
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

logger = logging.getLogger(__name__)

# Load Twilio config
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")

# Determine if we should mock (if credentials are not fully provided)
should_mock = not (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER)

if not should_mock:
    twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
else:
    twilio_client = None
    logger.warning("Twilio credentials missing. Messaging will be mocked.")


def format_phone_number(phone: str) -> str:
    """Format phone number to E.164 if it isn't already."""
    phone = phone.strip()
    if not phone.startswith('+'):
        # Assuming Indian numbers if no country code provided, as per frontend defaults
        return f"+91{phone.lstrip('0')}"
    return phone


def send_sms(to_phone: str, body: str) -> bool:
    """Send an SMS via Twilio, or mock if configured to do so."""
    formatted_phone = format_phone_number(to_phone)
    if should_mock:
        logger.info(f"[MOCK SMS] To: {formatted_phone} | Body: {body}")
        return True
    
    try:
        message = twilio_client.messages.create(
            body=body,
            from_=TWILIO_PHONE_NUMBER,
            to=formatted_phone
        )
        logger.info(f"SMS sent to {formatted_phone}, SID: {message.sid}")
        return True
    except TwilioRestException as e:
        logger.error(f"Failed to send SMS to {formatted_phone}: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending SMS: {e}")
        return False


def send_whatsapp(to_phone: str, body: str) -> bool:
    """Send a WhatsApp message via Twilio, or mock if configured to do so."""
    formatted_phone = format_phone_number(to_phone)
    if should_mock:
        logger.info(f"[MOCK WHATSAPP] To: whatsapp:{formatted_phone} | Body: {body}")
        return True
    
    try:
        # Twilio WhatsApp numbers must be prefixed with 'whatsapp:'
        from_number = f"whatsapp:{TWILIO_PHONE_NUMBER}"
        to_number = f"whatsapp:{formatted_phone}"
        
        message = twilio_client.messages.create(
            body=body,
            from_=from_number,
            to=to_number
        )
        logger.info(f"WhatsApp sent to {formatted_phone}, SID: {message.sid}")
        return True
    except TwilioRestException as e:
        logger.error(f"Failed to send WhatsApp to {formatted_phone}: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending WhatsApp: {e}")
        return False


def broadcast_sos(contacts: List[Dict[str, Any]], body: str) -> Dict[str, Any]:
    """Broadcast the SOS message to all contacts via SMS and WhatsApp."""
    results = {"sms": {"success": 0, "failed": 0}, "whatsapp": {"success": 0, "failed": 0}}
    
    for contact in contacts:
        phone = contact.get("phone")
        if not phone:
            continue
            
        # Send SMS
        if send_sms(phone, body):
            results["sms"]["success"] += 1
        else:
            results["sms"]["failed"] += 1
            
        # Send WhatsApp
        if send_whatsapp(phone, body):
            results["whatsapp"]["success"] += 1
        else:
            results["whatsapp"]["failed"] += 1
            
    return results
