# ☕ MOKKO — Cafe Management System

> **A modern, role-based cafe operations platform designed for seamless floor service, kitchen queue management, real-time billing, and executive analytics.**

---

## 📖 Overview

**MOKKO** is an end-to-end cafe management system built with a high-performance **FastAPI (Python)** backend and a responsive, aesthetic **Vanilla HTML/CSS/JavaScript** frontend.

The platform provides dedicated workspaces tailored to every actor in the cafe ecosystem—ensuring waiters focus on customer hospitality, managers maintain smooth operational rhythm, chefs manage kitchen orders, and administrators retain complete control over menu configuration, staff access, and financial audit.

---

## ✨ Key Features & Role-Based Workflows

### 🛡️ 1. Administrator Portal (`admin.html`)
- **System Control**: Real-time server health checks, database status, and operational diagnostics.
- **Staff Management**: Full team directory, role assignment, registration, and active/inactive account toggling.
- **Menu Architecture**: Add and categorize food & beverage items, manage pricing, and toggle live availability.
- **Floor Configuration**: Add and configure tables with guest capacity.
- **Financial Audit**: Review cumulative sales, paid bills, and revenue breakdown.

### 📋 2. Manager Portal (`manager.html`)
- **Cafe Operations**: Real-time sales metrics, order pipeline status, and daily performance summaries.
- **Floor & Table Oversight**: Monitor real-time occupancy and guest session durations.
- **Live Kitchen Monitor**: Track pending, preparing, and ready orders in real time.
- **Billing & Payments**: Generate itemized bills for dining sessions and record payments (Cash, Card, UPI).
- **Daily Reports**: Interactive period-based sales volume and top-selling popular items.

### 🍽️ 3. Waiter Portal (`staff.html`)
- **Customer Hospitality**: Floor layout with live table availability.
- **One-Click Seating**: Seat walk-in guests or reservations and open dining sessions.
- **Order Management**: Create orders tied to table sessions, select menu items, and input custom customer instructions (e.g., oat milk, extra hot).
- **Preparation Tracking**: Live status transitions (Pending ⏳ → Preparing ♨ → Ready 🔔).
- **Service Handoff**: Mark ready orders as "Served ✓" and trigger bill requests.

### ☕ 4. Customer Portal (`customer.html`)
- **Digital Menu**: Browse categories (Espresso, Brews, Bakery, etc.) with prices and descriptions.
- **Live Floor Availability**: Check open tables in real time before arriving.
- **Cafe Atmosphere**: Clean, warm coffee-themed aesthetic.

### 👤 5. Staff Onboarding (`register.html`)
- **Dedicated Registration**: Form for onboarding new staff with role descriptions, live validation, and security feedback.

---

## 🛠️ Technology Stack

- **Backend**:
  - [FastAPI](https://fastapi.tiangolo.com/) — Modern, asynchronous Python web framework
  - [SQLAlchemy ORM](https://www.sqlalchemy.org/) — Relational database modeling
  - [SQLite](https://www.sqlite.org/) — Lightweight, embedded relational database (`mokko.db`)
  - [Pydantic v2](https://docs.pydantic.dev/) — Strict data validation and schema serialization
  - [PyJWT & Passlib](https://pyjwt.readthedocs.io/) — JWT token authentication & bcrypt password hashing
- **Frontend**:
  - **HTML5 & Vanilla CSS3** — Custom-crafted design system, coffee palette tokens, glassmorphism, and responsive grid layouts.
  - **Vanilla JavaScript (ES6+)** — Client-side routing, asynchronous API integration, and dynamic state management without heavy framework overhead.

---

## 📂 Project Structure

```text
MOKKO-Cafe-Management-System/
├── .env                       # Environment configuration
├── .gitignore                 # Git ignore rules
├── create_admin.py            # CLI script to bootstrap an administrator account
├── database.py                # Database connection & session factory
├── dependencies.py            # Authentication & role verification dependencies
├── main.py                    # FastAPI application initialization & middleware
├── models.py                  # SQLAlchemy relational database models
├── mokko.db                   # SQLite database file
├── schemas.py                 # Pydantic request & response schemas
├── security.py                # Password hashing and JWT generation/validation
│
├── routers/                   # API route handlers
│   ├── auth.py                # Staff authentication, registration, & directory
│   ├── billing.py             # Bill generation & tax calculation
│   ├── menu.py                # Categories & menu item management
│   ├── orders.py              # Order lifecycle & kitchen tracking
│   ├── payments.py            # Payment processing & session closure
│   ├── reports.py             # Analytics, metrics, & sales reports
│   └── tables.py              # Floor tables & dining session management
│
└── frontend/                  # Web application UI
    ├── admin.html             # Administrator workspace
    ├── manager.html           # Manager operations dashboard
    ├── staff.html             # Waiter customer service portal
    ├── customer.html          # Public customer menu & table viewer
    ├── login.html             # Unified staff login page
    ├── login.css              # Login layout & coffee illustration styles
    ├── login.js               # Login authentication & role-based routing
    ├── register.html          # Staff registration & onboarding
    ├── register.css           # Registration form styling
    ├── dashboard.css          # Unified modern dark dashboard design system
    ├── dashboard.js           # Shared dashboard controllers & API logic
    ├── index.html             # Cafe landing page
    └── style.css              # Landing page styles
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.10+ installed
- Git installed

### 2. Setup Virtual Environment & Install Dependencies
```bash
# Clone the repository
git clone https://github.com/SahilKaturde/MOKKO-Cafe-Management-System.git
cd MOKKO-Cafe-Management-System

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# Linux / macOS:
source .venv/bin/activate

# Install required packages
pip install fastapi uvicorn sqlalchemy pydantic email-validator pyjwt passlib bcrypt python-multipart
```

### 3. Run the Backend API
```bash
uvicorn main:app --reload --port 8000
```
- API Docs (Swagger UI): [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- API Redoc: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

### 4. Launch the Frontend
You can open the frontend using any static file server or VS Code Live Server:
```bash
# Example using Python's built-in HTTP server:
cd frontend
python -m http.server 5500
```
Open your browser at:
- **Sign in**: [http://127.0.0.1:5500/login.html](http://127.0.0.1:5500/login.html)
- **Customer View**: [http://127.0.0.1:5500/customer.html](http://127.0.0.1:5500/customer.html)
- **Staff Registration**: [http://127.0.0.1:5500/register.html](http://127.0.0.1:5500/register.html)

---

## 🔒 Default Test Accounts

| Role | Email | Notes |
| :--- | :--- | :--- |
| **Admin** | `batman@gmail.com` | Full system administrator access |
| **Waiter** | `waiter@example.com` | Floor service & table order management |

*(New staff accounts for Manager, Chef, and Cashier can be registered directly through `register.html` or the Admin portal).*

---

## 📄 License
This project is licensed under the MIT License.
