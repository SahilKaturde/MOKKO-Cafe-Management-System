
# create_admin.py

from getpass import getpass

import models
from database import Base, engine, SessionLocal
from models import Staff
from security import hash_password

Base.metadata.create_all(bind=engine)

email = input("Admin email: ").strip().lower()
full_name = input("Admin full name: ").strip()
password = getpass("Admin password (minimum 8 characters): ")
confirm_password = getpass("Confirm password: ")

if len(full_name) < 2:
    raise SystemExit("Name must contain at least 2 characters.")

if len(password) < 8 or len(password) > 128:
    raise SystemExit("Password must contain 8 to 128 characters.")

if password != confirm_password:
    raise SystemExit("Passwords do not match.")

db = SessionLocal()

try:
    existing = db.query(Staff).filter(Staff.email == email).first()

    if existing:
        raise SystemExit("An account with this email already exists.")

    admin = Staff(
        full_name=full_name,
        email=email,
        password_hash=hash_password(password),
        role="admin",
        is_active=True,
    )

    db.add(admin)
    db.commit()

    print("Administrator created successfully.")

except Exception:
    db.rollback()
    raise

finally:
    db.close()
