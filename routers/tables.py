
from datetime import datetime
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session

from database import get_db
from models import CafeTable, DiningSession, Customer, Staff
from dependencies import get_current_staff, get_optional_staff, require_roles

router = APIRouter(
    prefix="/api/tables",
    tags=["Table Management"]
)


class TableCreate(BaseModel):
    table_number: int = Field(gt=0)
    capacity: int = Field(gt=0, le=20)


class TableRead(BaseModel):
    id: int
    table_number: int
    capacity: int
    status: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class SeatCustomerRequest(BaseModel):
    guest_count: int = Field(gt=0, le=20)
    waiter_id: Optional[int] = None
    customer_name: Optional[str] = Field(
        default=None, min_length=2, max_length=100
    )
    customer_phone: Optional[str] = Field(
        default=None, max_length=20
    )


class DiningSessionRead(BaseModel):
    id: int
    table_id: int
    customer_id: Optional[int]
    waiter_id: int
    guest_count: int
    status: str
    seated_at: datetime
    closed_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


@router.post(
    "",
    response_model=TableRead,
    status_code=status.HTTP_201_CREATED
)
def create_table(
    data: TableCreate,
    db: Session = Depends(get_db),
    staff=Depends(require_roles("admin", "manager"))
):
    existing = db.query(CafeTable).filter(
        CafeTable.table_number == data.table_number
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Table number already exists"
        )

    table = CafeTable(
        table_number=data.table_number,
        capacity=data.capacity,
        status="available"
    )

    db.add(table)
    db.commit()
    db.refresh(table)

    return table


@router.get("", response_model=list[TableRead])
def list_tables(
    db: Session = Depends(get_db),
    staff=Depends(get_optional_staff)
):
    return (
        db.query(CafeTable)
        .filter(CafeTable.is_active.is_(True))
        .order_by(CafeTable.table_number)
        .all()
    )


@router.get("/{table_id}", response_model=TableRead)
def get_table(
    table_id: int,
    db: Session = Depends(get_db),
    staff=Depends(get_current_staff)
):
    table = db.get(CafeTable, table_id)

    if not table or not table.is_active:
        raise HTTPException(status_code=404, detail="Table not found")

    return table


@router.get("/{table_id}/session", response_model=Optional[DiningSessionRead])
def get_table_session(
    table_id: int,
    db: Session = Depends(get_db),
    staff=Depends(get_current_staff)
):
    session = (
        db.query(DiningSession)
        .filter(
            DiningSession.table_id == table_id,
            DiningSession.status == "open"
        )
        .order_by(DiningSession.id.desc())
        .first()
    )
    return session


@router.post(
    "/{table_id}/seat",
    response_model=DiningSessionRead,
    status_code=status.HTTP_201_CREATED
)
def seat_customers(
    table_id: int,
    data: SeatCustomerRequest,
    db: Session = Depends(get_db),
    staff=Depends(get_current_staff)
):
    table = db.query(CafeTable).filter(
        CafeTable.id == table_id,
        CafeTable.is_active.is_(True)
    ).with_for_update().first()

    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    if table.status != "available":
        raise HTTPException(
            status_code=409,
            detail="Table is not available"
        )

    if data.guest_count > table.capacity:
        raise HTTPException(
            status_code=400,
            detail=f"Table capacity is {table.capacity}"
        )

    waiter_id = data.waiter_id if data.waiter_id is not None else staff.id

    waiter = db.get(Staff, waiter_id)

    if (
        not waiter
        or not waiter.is_active
        or waiter.role != "waiter"
    ):
        raise HTTPException(
            status_code=400,
            detail="An active waiter account is required"
        )

    if staff.role == "waiter" and waiter.id != staff.id:
        raise HTTPException(
            status_code=403,
            detail="Waiters can only assign themselves"
        )

    customer_id = None

    if data.customer_name:
        customer = Customer(
            full_name=data.customer_name.strip(),
            phone=data.customer_phone
        )
        db.add(customer)
        db.flush()
        customer_id = customer.id

    session = DiningSession(
        table_id=table.id,
        customer_id=customer_id,
        waiter_id=waiter.id,
        guest_count=data.guest_count,
        status="open"
    )

    table.status = "occupied"
    db.add(session)
    db.commit()
    db.refresh(session)

    return session


@router.post("/{table_id}/close")
def close_dining_session(
    table_id: int,
    db: Session = Depends(get_db),
    staff=Depends(require_roles("admin", "manager", "cashier"))
):
    table = db.get(CafeTable, table_id)

    if not table or not table.is_active:
        raise HTTPException(status_code=404, detail="Table not found")

    session = (
        db.query(DiningSession)
        .filter(
            DiningSession.table_id == table_id,
            DiningSession.status == "open"
        )
        .order_by(DiningSession.id.desc())
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=409,
            detail="No open dining session for this table"
        )

    session.status = "closed"
    session.closed_at = datetime.utcnow()
    table.status = "available"

    db.commit()

    return {
        "message": "Dining session closed",
        "table_id": table.id,
        "session_id": session.id,
        "table_status": table.status
    }


@router.patch("/{table_id}/toggle-active")
def toggle_table_active(
    table_id: int,
    db: Session = Depends(get_db),
    staff=Depends(require_roles("admin", "manager"))
):
    table = db.get(CafeTable, table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    table.is_active = not table.is_active
    db.commit()
    return {
        "message": "Table updated",
        "table_id": table.id,
        "is_active": table.is_active
    }
