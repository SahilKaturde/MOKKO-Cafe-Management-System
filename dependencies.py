
# dependencies.py

from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from database import get_db
from models import Staff
from security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_staff(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db),
) -> Staff:

    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise unauthorized

    try:
        payload = decode_access_token(credentials.credentials)
        staff_id = int(payload["sub"])
    except (
        jwt.InvalidTokenError,
        KeyError,
        TypeError,
        ValueError,
    ):
        raise unauthorized

    staff = db.query(Staff).filter(Staff.id == staff_id).first()

    if staff is None or not staff.is_active:
        raise unauthorized

    return staff


def get_optional_staff(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db),
) -> Optional[Staff]:
    if credentials is None:
        return None

    try:
        payload = decode_access_token(credentials.credentials)
        staff_id = int(payload["sub"])
    except (
        jwt.InvalidTokenError,
        KeyError,
        TypeError,
        ValueError,
    ):
        return None

    return db.query(Staff).filter(Staff.id == staff_id, Staff.is_active.is_(True)).first()


def require_roles(*allowed_roles: str):
    def check_role(
        current_staff: Staff = Depends(get_current_staff),
    ) -> Staff:
        if current_staff.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )

        return current_staff

    return check_role
