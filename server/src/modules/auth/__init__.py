from .routes_auth import router as auth_router
from .routes_me import router as me_router, me_payload
from .auth import current_user, current_doctor, require_admin
