
# routers/auth.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from typing import Optional

from database import get_db
from models import Staff
from schemas import StaffCreate, StaffRead, LoginRequest, TokenResponse
from security import hash_password, verify_password, create_access_token
from dependencies import get_current_staff, get_optional_staff, require_roles

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=StaffRead,
    status_code=status.HTTP_201_CREATED,
)
def register_staff(
    data: StaffCreate,
    db: Session = Depends(get_db),
    current_staff: Optional[Staff] = Depends(get_optional_staff),
):
    role = data.role.value
    total_staff = db.query(Staff).count()

    # If first user in database, allow creation as admin
    if total_staff > 0:
        if current_staff is None:
            # Public registration can only register operational roles (waiter, cashier, chef)
            if role in ("admin", "manager"):
                raise HTTPException(
                    status_code=403,
                    detail="Admin or Manager accounts can only be created by an active administrator",
                )
        else:
            # Managers may create operational staff, but not admins or managers
            if current_staff.role == "manager" and role in ("admin", "manager"):
                raise HTTPException(
                    status_code=403,
                    detail="Managers cannot create admin or manager accounts",
                )
            if current_staff.role not in ("admin", "manager"):
                raise HTTPException(
                    status_code=403,
                    detail="Insufficient permissions to register staff accounts",
                )

    email = str(data.email).lower()

    existing = db.query(Staff).filter(Staff.email == email).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists",
        )

    staff = Staff(
        full_name=data.full_name,
        email=email,
        password_hash=hash_password(data.password),
        phone=data.phone,
        role=role,
        is_active=True,
    )

    try:
        db.add(staff)
        db.commit()
        db.refresh(staff)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists",
        )

    return staff


@router.post("/login", response_model=TokenResponse)
def login(
    data: LoginRequest,
    db: Session = Depends(get_db),
):
    email = str(data.email).lower()

    staff = db.query(Staff).filter(Staff.email == email).first()

    if staff is None or not verify_password(
        data.password,
        staff.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not staff.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This staff account is inactive",
        )

    token = create_access_token(staff.id)

    return {
        "access_token": token,
        "token_type": "bearer",
    }


@router.get("/me", response_model=StaffRead)
def get_me(
    current_staff: Staff = Depends(get_current_staff),
):
    return current_staff


@router.get("/staff", response_model=list[StaffRead])
def list_staff(
    db: Session = Depends(get_db),
    current_staff: Staff = Depends(require_roles("admin", "manager")),
):
    return db.query(Staff).order_by(Staff.id.asc()).all()


@router.patch("/staff/{staff_id}/toggle-status", response_model=StaffRead)
def toggle_staff_status(
    staff_id: int,
    db: Session = Depends(get_db),
    current_staff: Staff = Depends(require_roles("admin")),
):
    target = db.get(Staff, staff_id)
    if not target:
        raise HTTPException(status_code=404, detail="Staff account not found")

    if target.id == current_staff.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot deactivate your own admin account",
        )

    target.is_active = not target.is_active
    db.commit()
    db.refresh(target)
    return target
