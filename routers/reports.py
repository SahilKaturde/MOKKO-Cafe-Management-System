
from datetime import datetime, time, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import Bill, CafeOrder, OrderItem, MenuItem, Payment
from dependencies import require_roles

router = APIRouter(
    prefix="/api/reports",
    tags=["Manager Reports"]
)


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    staff=Depends(require_roles("admin", "manager"))
):
    today = datetime.utcnow().date()
    start = datetime.combine(today, time.min)
    end = start + timedelta(days=1)

    paid_bills = db.query(Bill).filter(
        Bill.status == "paid",
        Bill.created_at >= start,
        Bill.created_at < end
    )

    sales = paid_bills.with_entities(
        func.coalesce(func.sum(Bill.total_amount), 0)
    ).scalar()

    paid_bill_count = paid_bills.count()

    orders_today = db.query(CafeOrder).filter(
        CafeOrder.created_at >= start,
        CafeOrder.created_at < end
    ).count()

    pending_orders = db.query(CafeOrder).filter(
        CafeOrder.status == "pending"
    ).count()

    preparing_orders = db.query(CafeOrder).filter(
        CafeOrder.status == "preparing"
    ).count()

    ready_orders = db.query(CafeOrder).filter(
        CafeOrder.status == "ready"
    ).count()

    return {
        "date": today.isoformat(),
        "sales": str(Decimal(str(sales)).quantize(Decimal("0.01"))),
        "paid_bills": paid_bill_count,
        "orders_today": orders_today,
        "pending_orders": pending_orders,
        "preparing_orders": preparing_orders,
        "ready_orders": ready_orders
    }


@router.get("/popular-items")
def popular_items(
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
    staff=Depends(require_roles("admin", "manager"))
):
    results = (
        db.query(
            MenuItem.id.label("menu_item_id"),
            MenuItem.name.label("name"),
            func.coalesce(func.sum(OrderItem.quantity), 0).label(
                "quantity_sold"
            )
        )
        .join(OrderItem, OrderItem.menu_item_id == MenuItem.id)
        .join(CafeOrder, CafeOrder.id == OrderItem.order_id)
        .filter(
            CafeOrder.status != "cancelled",
            OrderItem.status != "cancelled"
        )
        .group_by(MenuItem.id, MenuItem.name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "menu_item_id": row.menu_item_id,
            "name": row.name,
            "quantity_sold": row.quantity_sold
        }
        for row in results
    ]


@router.get("/sales")
def sales_report(
    days: int = Query(default=7, ge=1, le=90),
    db: Session = Depends(get_db),
    staff=Depends(require_roles("admin", "manager"))
):
    end = datetime.utcnow()
    start = end - timedelta(days=days)

    bills = (
        db.query(Bill)
        .filter(
            Bill.status == "paid",
            Bill.created_at >= start,
            Bill.created_at < end
        )
        .order_by(Bill.created_at)
        .all()
    )

    daily_sales = {}

    for bill in bills:
        day = bill.created_at.date().isoformat()
        daily_sales.setdefault(day, Decimal("0.00"))
        daily_sales[day] += Decimal(str(bill.total_amount))

    return {
        "period_days": days,
        "total_sales": str(
            sum(daily_sales.values(), Decimal("0.00")).quantize(
                Decimal("0.01")
            )
        ),
        "daily_sales": [
            {
                "date": day,
                "sales": str(amount.quantize(Decimal("0.01")))
            }
            for day, amount in sorted(daily_sales.items())
        ]
    }
