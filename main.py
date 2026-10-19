
# main.py

from fastapi import FastAPI

import models
from database import Base, engine
from routers.auth import router as auth_router


from routers.menu import router as menu_router
from routers.tables import router as tables_router
from routers.orders import router as orders_router
from routers.billing import router as billing_router
from routers.payments import router as payments_router
from routers.reports import router as reports_router


from fastapi.middleware.cors import CORSMiddleware


Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MOKKO Cafe Management System",
    description="Cafe operations and staff management API",
    version="1.0.0",
)

app.include_router(auth_router)
app.include_router(tables_router)
app.include_router(menu_router)
app.include_router(orders_router)
app.include_router(billing_router)
app.include_router(reports_router)
app.include_router(payments_router)


@app.get("/")
def home():
    return {
        "message": "Welcome to MOKKO",
        "database": "SQLite connected",
        "status": "running",
    }



app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)