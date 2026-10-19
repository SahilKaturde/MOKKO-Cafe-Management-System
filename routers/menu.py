
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from decimal import Decimal

from database import get_db
from models import Category, MenuItem
from dependencies import get_current_staff, get_optional_staff, require_roles

router = APIRouter(
    prefix="/api/menu",
    tags=["Menu Management"]
)


class CategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: Optional[str] = None


class CategoryRead(BaseModel):
    id: int
    name: str
    description: Optional[str]
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class MenuItemCreate(BaseModel):
    category_id: int
    name: str = Field(min_length=2, max_length=150)
    description: Optional[str] = None
    price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    is_available: bool = True


class MenuItemRead(BaseModel):
    id: int
    category_id: int
    name: str
    description: Optional[str]
    price: Decimal
    is_available: bool

    model_config = ConfigDict(from_attributes=True)


@router.post(
    "/categories",
    response_model=CategoryRead,
    status_code=status.HTTP_201_CREATED
)
def create_category(
    data: CategoryCreate,
    db: Session = Depends(get_db),
    staff=Depends(require_roles("admin", "manager"))
):
    category = Category(
        name=data.name.strip(),
        description=data.description
    )

    db.add(category)

    try:
        db.commit()
        db.refresh(category)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This category already exists"
        )

    return category


@router.get("/categories", response_model=list[CategoryRead])
def list_categories(
    db: Session = Depends(get_db),
    staff=Depends(get_optional_staff)
):
    return (
        db.query(Category)
        .filter(Category.is_active.is_(True))
        .order_by(Category.name)
        .all()
    )


@router.post(
    "/items",
    response_model=MenuItemRead,
    status_code=status.HTTP_201_CREATED
)
def create_menu_item(
    data: MenuItemCreate,
    db: Session = Depends(get_db),
    staff=Depends(require_roles("admin", "manager"))
):
    category = db.get(Category, data.category_id)

    if not category or not category.is_active:
        raise HTTPException(
            status_code=404,
            detail="Active category not found"
        )

    item = MenuItem(
        category_id=data.category_id,
        name=data.name.strip(),
        description=data.description,
        price=data.price,
        is_available=data.is_available
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    return item


@router.get("/items", response_model=list[MenuItemRead])
def list_menu_items(
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
    staff=Depends(get_optional_staff)
):
    query = db.query(MenuItem).join(Category).filter(
        Category.is_active.is_(True),
        MenuItem.is_available.is_(True)
    )

    if category_id is not None:
        query = query.filter(MenuItem.category_id == category_id)

    return query.order_by(MenuItem.name).all()


@router.patch("/items/{item_id}/availability")
def update_item_availability(
    item_id: int,
    is_available: bool,
    db: Session = Depends(get_db),
    staff=Depends(require_roles("admin", "manager"))
):
    item = db.get(MenuItem, item_id)

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Menu item not found"
        )

    item.is_available = is_available
    db.commit()

    return {
        "message": "Menu item availability updated",
        "item_id": item.id,
        "is_available": item.is_available
    }
