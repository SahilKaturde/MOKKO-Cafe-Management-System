
# models.py

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, ForeignKey,
    DateTime, Numeric, Text, UniqueConstraint
)
from sqlalchemy.orm import relationship
from database import Base


# 1. STAFF
class Staff(Base):
    __tablename__ = "staff"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    role = Column(String(20), nullable=False, default="waiter")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    managed_sessions = relationship(
        "DiningSession",
        back_populates="waiter",
        foreign_keys="DiningSession.waiter_id"
    )
    created_orders = relationship(
        "CafeOrder",
        back_populates="created_by",
        foreign_keys="CafeOrder.staff_id"
    )
    managed_bills = relationship(
        "Bill",
        back_populates="cashier",
        foreign_keys="Bill.cashier_id"
    )
    received_payments = relationship(
        "Payment",
        back_populates="received_by",
        foreign_keys="Payment.received_by_id"
    )


# 2. CUSTOMERS
class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True, index=True)
    email = Column(String(150), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    dining_sessions = relationship(
        "DiningSession",
        back_populates="customer"
    )


# 3. CAFE TABLES
class CafeTable(Base):
    __tablename__ = "cafe_tables"

    id = Column(Integer, primary_key=True, index=True)
    table_number = Column(Integer, unique=True, nullable=False)
    capacity = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, default="available")
    is_active = Column(Boolean, nullable=False, default=True)

    dining_sessions = relationship(
        "DiningSession",
        back_populates="table"
    )


# 4. CATEGORIES
class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(80), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    menu_items = relationship(
        "MenuItem",
        back_populates="category"
    )


# 5. MENU ITEMS
class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(
        Integer, ForeignKey("categories.id"), nullable=False
    )
    name = Column(String(120), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=False)
    is_available = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    category = relationship("Category", back_populates="menu_items")
    order_items = relationship("OrderItem", back_populates="menu_item")


# 6. DINING SESSIONS
class DiningSession(Base):
    __tablename__ = "dining_sessions"

    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(
        Integer, ForeignKey("cafe_tables.id"), nullable=False
    )
    customer_id = Column(
        Integer, ForeignKey("customers.id"), nullable=True
    )
    waiter_id = Column(
        Integer, ForeignKey("staff.id"), nullable=False
    )
    guest_count = Column(Integer, nullable=False, default=1)
    status = Column(String(20), nullable=False, default="open")
    seated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    closed_at = Column(DateTime, nullable=True)

    table = relationship("CafeTable", back_populates="dining_sessions")
    customer = relationship("Customer", back_populates="dining_sessions")
    waiter = relationship(
        "Staff",
        back_populates="managed_sessions",
        foreign_keys=[waiter_id]
    )
    orders = relationship("CafeOrder", back_populates="session")
    bill = relationship(
        "Bill",
        back_populates="session",
        uselist=False
    )


# 7. ORDERS
class CafeOrder(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(
        Integer, ForeignKey("dining_sessions.id"), nullable=False
    )
    staff_id = Column(
        Integer, ForeignKey("staff.id"), nullable=False
    )
    status = Column(String(20), nullable=False, default="pending")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    session = relationship("DiningSession", back_populates="orders")
    created_by = relationship(
        "Staff",
        back_populates="created_orders",
        foreign_keys=[staff_id]
    )
    items = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan"
    )


# 8. ORDER ITEMS
class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(
        Integer, ForeignKey("orders.id"), nullable=False
    )
    menu_item_id = Column(
        Integer, ForeignKey("menu_items.id"), nullable=False
    )
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    special_instructions = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="pending")

    order = relationship("CafeOrder", back_populates="items")
    menu_item = relationship("MenuItem", back_populates="order_items")


# 9. BILLS
class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(
        Integer,
        ForeignKey("dining_sessions.id"),
        unique=True,
        nullable=False
    )
    cashier_id = Column(
        Integer, ForeignKey("staff.id"), nullable=True
    )
    subtotal = Column(Numeric(10, 2), nullable=False, default=0)
    tax_amount = Column(Numeric(10, 2), nullable=False, default=0)
    discount_amount = Column(Numeric(10, 2), nullable=False, default=0)
    total_amount = Column(Numeric(10, 2), nullable=False, default=0)
    status = Column(String(20), nullable=False, default="draft")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    finalized_at = Column(DateTime, nullable=True)

    session = relationship("DiningSession", back_populates="bill")
    cashier = relationship(
        "Staff",
        back_populates="managed_bills",
        foreign_keys=[cashier_id]
    )
    payments = relationship(
        "Payment",
        back_populates="bill",
        cascade="all, delete-orphan"
    )


# 10. PAYMENTS
class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False)
    received_by_id = Column(
        Integer, ForeignKey("staff.id"), nullable=True
    )
    amount = Column(Numeric(10, 2), nullable=False)
    method = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    transaction_reference = Column(String(150), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    bill = relationship("Bill", back_populates="payments")
    received_by = relationship(
        "Staff",
        back_populates="received_payments",
        foreign_keys=[received_by_id]
    )
