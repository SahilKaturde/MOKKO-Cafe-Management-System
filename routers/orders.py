
from datetime import datetime
from decimal import Decimal
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import (
    CafeOrder,
    OrderItem,
    DiningSession,
    MenuItem,
)
from dependencies import get_current_staff, require_roles

router = APIRouter(
    prefix="/api/orders",
    tags=["Order Management"]
)


class OrderCreate(BaseModel):
    session_id: int
    notes: Optional[str] = None


class OrderItemCreate(BaseModel):
    menu_item_id: int
    quantity: int = Field(gt=0, le=100)
    special_instructions: Optional[str] = None


class OrderItemRead(BaseModel):
    id: int
    menu_item_id: int
    quantity: int
    unit_price: Decimal
    special_instructions: Optional[str]
    status: str

    model_config = ConfigDict(from_attributes=True)


class OrderRead(BaseModel):
    id: int
    session_id: int
    staff_id: int
    status: str
    notes: Optional[str]
    created_at: datetime
    items: list[OrderItemRead]

    model_config = ConfigDict(from_attributes=True)


@router.post(
    "",
    response_model=OrderRead,
    status_code=status.HTTP_201_CREATED
)
def create_order(
    data: OrderCreate,
    db: Session = Depends(get_db),
    staff=Depends(require_roles("admin", "manager", "waiter"))
):
    dining_session = db.get(DiningSession, data.session_id)

    if not dining_session or dining_session.status != "open":
        raise HTTPException(
            status_code=404,
            detail="Open dining session not found"
        )

    if staff.role == "waiter" and dining_session.waiter_id != staff.id:
        raise HTTPException(
            status_code=403,
            detail="You can only create orders for your assigned tables"
        )

    order = CafeOrder(
        session_id=dining_session.id,
        staff_id=staff.id,
        notes=data.notes,
        status="pending"
    )

    db.add(order)
    db.commit()
    db.refresh(order)

    return order


@router.post(
    "/{order_id}/items",
    response_model=OrderRead,
    status_code=status.HTTP_201_CREATED
)
def add_order_item(
    order_id: int,
    data: OrderItemCreate,
    db: Session = Depends(get_db),
    staff=Depends(require_roles("admin", "manager", "waiter"))
):
    order = (
        db.query(CafeOrder)
        .options(joinedload(CafeOrder.items))
        .filter(CafeOrder.id == order_id)
        .first()
    )

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != "pending":
        raise HTTPException(
            status_code=409,
            detail="Items can only be added to pending orders"
        )

    dining_session = db.get(DiningSession, order.session_id)

    if not dining_session or dining_session.status != "open":
        raise HTTPException(
            status_code=409,
            detail="Dining session is not open"
        )

    if staff.role == "waiter" and (
        dining_session.waiter_id != staff.id
        or order.staff_id != staff.id
    ):
        raise HTTPException(
            status_code=403,
            detail="You cannot modify this order"
        )

    menu_item = db.get(MenuItem, data.menu_item_id)

    if not menu_item or not menu_item.is_available:
        raise HTTPException(
            status_code=404,
            detail="Available menu item not found"
        )

    item = OrderItem(
        order_id=order.id,
        menu_item_id=menu_item.id,
        quantity=data.quantity,
        unit_price=menu_item.price,
        special_instructions=data.special_instructions,
        status="pending"
    )

    db.add(item)
    db.commit()

    return (
        db.query(CafeOrder)
        .options(joinedload(CafeOrder.items))
        .filter(CafeOrder.id == order.id)
        .first()
    )


@router.get("", response_model=list[OrderRead])
def list_orders(
    order_status: Optional[str] = None,
    db: Session = Depends(get_db),
    staff=Depends(get_current_staff)
):
    query = (
        db.query(CafeOrder)
        .options(joinedload(CafeOrder.items))
    )

    if order_status:
        allowed = {"pending", "preparing", "ready", "served", "cancelled"}
        if order_status not in allowed:
            raise HTTPException(
                status_code=400,
                detail="Invalid order status"
            )
        query = query.filter(CafeOrder.status == order_status)

    if staff.role == "waiter":
        query = query.filter(CafeOrder.staff_id == staff.id)

    return query.order_by(CafeOrder.created_at.desc()).all()


@router.get("/{order_id}", response_model=OrderRead)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    staff=Depends(get_current_staff)
):
    order = (
        db.query(CafeOrder)
        .options(joinedload(CafeOrder.items))
        .filter(CafeOrder.id == order_id)
        .first()
    )

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if staff.role == "waiter" and order.staff_id != staff.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return order


@router.patch("/{order_id}/status")
def update_order_status(
    order_id: int,
    new_status: Literal["preparing", "ready", "served", "cancelled"],
    db: Session = Depends(get_db),
    staff=Depends(get_current_staff)
):
    order = db.get(CafeOrder, order_id)

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    allowed_transitions = {
        "pending": {"preparing", "cancelled"},
        "preparing": {"ready", "cancelled"},
        "ready": {"served"},
        "served": set(),
        "cancelled": set(),
    }

    if new_status not in allowed_transitions.get(order.status, set()):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot change order from {order.status} to {new_status}"
        )

    if staff.role == "chef":
        if new_status not in {"preparing", "ready"}:
            raise HTTPException(
                status_code=403,
                detail="Chefs can only mark orders preparing or ready"
            )
    elif staff.role == "waiter":
        if order.staff_id != staff.id or new_status != "served":
            raise HTTPException(
                status_code=403,
                detail="Waiters can only mark their own ready orders as served"
            )
    elif staff.role not in {"admin", "manager"}:
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions"
        )

    order.status = new_status

    if new_status in {"preparing", "ready", "served"}:
        for item in order.items:
            if item.status != "cancelled":
                item.status = new_status

    db.commit()

    return {
        "message": "Order status updated",
        "order_id": order.id,
        "status": order.status
    }
