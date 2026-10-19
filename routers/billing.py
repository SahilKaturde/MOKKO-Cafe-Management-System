
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import Bill, DiningSession, CafeOrder, Staff
from dependencies import require_roles

router = APIRouter(
    prefix="/api/billing",
    tags=["Billing and Payments"]
)

TAX_RATE = Decimal("0.05")


class BillRead(BaseModel):
    id: int
    session_id: int
    cashier_id: int | None
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    status: str

    model_config = ConfigDict(from_attributes=True)


def money(value: Decimal) -> Decimal:
    return value.quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP
    )


@router.post(
    "/sessions/{session_id}/bill",
    response_model=BillRead
)
def generate_bill(
    session_id: int,
    db: Session = Depends(get_db),
    staff=Depends(require_roles("admin", "manager", "cashier"))
):
    dining_session = db.get(DiningSession, session_id)

    if not dining_session:
        raise HTTPException(
            status_code=404,
            detail="Dining session not found"
        )

    existing_bill = db.query(Bill).filter(
        Bill.session_id == session_id
    ).first()

    if existing_bill:
        raise HTTPException(
            status_code=409,
            detail="A bill already exists for this session"
        )

    orders = (
        db.query(CafeOrder)
        .options(joinedload(CafeOrder.items))
        .filter(
            CafeOrder.session_id == session_id,
            CafeOrder.status != "cancelled"
        )
        .all()
    )

    if not orders:
        raise HTTPException(
            status_code=400,
            detail="Cannot generate a bill without orders"
        )

    subtotal = Decimal("0.00")

    for order in orders:
        for item in order.items:
            if item.status != "cancelled":
                subtotal += (
                    Decimal(str(item.unit_price))
                    * item.quantity
                )

    subtotal = money(subtotal)
    tax_amount = money(subtotal * TAX_RATE)
    discount_amount = Decimal("0.00")
    total_amount = money(
        subtotal + tax_amount - discount_amount
    )

    bill = Bill(
        session_id=session_id,
        cashier_id=staff.id,
        subtotal=subtotal,
        tax_amount=tax_amount,
        discount_amount=discount_amount,
        total_amount=total_amount,
        status="draft"
    )

    db.add(bill)
    db.commit()
    db.refresh(bill)

    return bill


@router.get("/sessions/{session_id}/bill", response_model=BillRead)
def get_session_bill(
    session_id: int,
    db: Session = Depends(get_db),
    staff=Depends(require_roles("admin", "manager", "cashier"))
):
    bill = db.query(Bill).filter(
        Bill.session_id == session_id
    ).first()

    if not bill:
        raise HTTPException(
            status_code=404,
            detail="Bill not found for this session"
        )

    return bill
