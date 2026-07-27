from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from . import auth
from .routes_me import me_payload

router = APIRouter()


class PhoneBody(BaseModel):
    phone: str


class VerifyBody(BaseModel):
    phone: str
    code: str


class AdminLoginBody(BaseModel):
    password: str


@router.post("/auth/request-otp")
def request_otp(body: PhoneBody):
    if not auth.is_valid_phone(body.phone):
        raise HTTPException(400, "Enter a valid 10-digit Indian mobile number.")
    result = auth.request_otp(body.phone)
    return {"sent": True, **result}


@router.post("/auth/verify-otp")
def verify_otp(body: VerifyBody):
    if not auth.is_valid_phone(body.phone) or not (body.code.isdigit() and len(body.code) == 6):
        raise HTTPException(400, "Invalid phone or code format.")
    result = auth.verify_otp(body.phone, body.code)
    return {"token": result["token"], **me_payload(result["user_id"])}


@router.post("/admin/login")
def admin_login(body: AdminLoginBody):
    return {"adminToken": auth.admin_login(body.password)}
