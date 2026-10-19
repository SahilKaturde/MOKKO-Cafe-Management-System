
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session

from database import get_db
from models import Bill, Payment
from dependencies import require_roles

router = APIRouter(
    prefix="/api/payments",
    tags=["Payments"]
)


class PaymentCreate(BaseModel):
    bill_id: int
    amount: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    method: Literal["cash", "card", "upi"]
    transaction_reference: str | None = Field(
        default=None,
        max_length=150
    )


class PaymentRead(BaseModel):
    id: int
    bill_id: int
    received_by_id: int | None
    amount: Decimal
    method: str
    status: str
    transaction_reference: str | None

    model_config = ConfigDict(from_attributes=True)


@router.post("", response_model=PaymentRead, status_code=201)
def record_payment(
    data: PaymentCreate,
    db: Session = Depends(get_db),
    staff=Depends(require_roles("admin", "manager", "cashier"))
):
    bill = (
        db.query(Bill)
        .filter(Bill.id == data.bill_id)
        .with_for_update()
        .first()
    )

    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    if bill.status != "draft":
        raise HTTPException(
            status_code=409,
            detail="Only draft bills can receive payments"
        )

    if data.amount != bill.total_amount:
        raise HTTPException(
            status_code=400,
            detail=f"Full payment required: {bill.total_amount}"
        )

    payment = Payment(
        bill_id=bill.id,
        received_by_id=staff.id,
        amount=data.amount,
        method=data.method,
        status="completed",
        transaction_reference=data.transaction_reference
    )

    bill.status = "paid"

    db.add(payment)

    session = bill.session
    session.status = "closed"
    from datetime import datetime
    session.closed_at = datetime.utcnow()
    session.table.status = "available"

    try:
        db.commit()
        db.refresh(payment)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Payment could not be recorded"
        )

    return payment


@router.get("/bill/{bill_id}", response_model=list[PaymentRead])
def list_bill_payments(
    bill_id: int,
    db: Session = Depends(get_db),
    staff=Depends(require_roles("admin", "manager", "cashier"))
):
    bill = db.get(Bill, bill_id)

    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    return (
        db.query(Payment)
        .filter(Payment.bill_id == bill_id)
        .order_by(Payment.created_at.desc())
        .all()
    )
