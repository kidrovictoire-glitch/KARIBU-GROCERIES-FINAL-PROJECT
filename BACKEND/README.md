# KGL Project (Backend)

> Repo layout: backend lives in `BACKEND/`, frontend assets are in `FRONTEND/` (static site).

Karibu Groceries LTD management system built with Node.js, Express, MongoDB, and a role-based web UI.

## Overview

This app manages produce procurement, inventory, pricing, sales, suppliers, staff accounts, and reporting across two branches:

- `Maganjo`
- `Matugga`

It includes role-based workflows for:

- `Director` (global analytics, staff management, reports)
- `Manager` (branch operations, pricing, procurement, suppliers, sales)
- `Agent` (cash/credit sales, branch-facing stock view)

## Tech Stack

- Backend: `Node.js`, `Express`, `Mongoose`, `JWT`, `bcryptjs`
- Database: `MongoDB`
- API docs: `swagger-ui-express` at `/api-docs`
- Frontend: static HTML/CSS/JS in `public/`

## Project Structure

```text
.
|-- server.js
|-- routes/
|   |-- usersRoutes.js
|   |-- registerRoutes.js
|   |-- salesRoutes.js
|   |-- procurementRoutes.js
|   `-- suppliersRoutes.js
|-- middleware/
|   `-- auth.js
|-- services/
|   `-- stockService.js
|-- utils/
|   |-- access.js
|   `-- validators.js
|-- docs/
|   `-- openapi.js
`-- public/
    |-- index.html
    |-- manager.html
    |-- agent.html
    |-- director.html
    `-- reports.html
```

## Getting Started (Backend)

1. Install dependencies (from `BACKEND/`):

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env
```

Update `.env` values:

- `PORT=5000`
- `MONGODB_URI=mongodb://127.0.0.1:27017/kgl_db`
- `JWT_SECRET=replace_with_a_long_random_secret`
- `SEED_DEFAULTS=true` (disable in production by setting to `false`)

3. Start the server:

```bash
npm start
```

The app runs by default at:

- `http://localhost:5000`

## Main URLs

- Login: `http://localhost:5000/index.html`
- Director dashboard: `http://localhost:5000/director.html`
- Manager dashboard: `http://localhost:5000/manager.html`
- Agent dashboard: `http://localhost:5000/agent.html`
- Reports: `http://localhost:5000/reports.html`
- Swagger docs: `http://localhost:5000/api-docs`

## Authentication Behavior

- Login stores JWT session data in browser storage.
- Protected pages (`director`, `manager`, `agent`, `reports`) enforce role/session checks on load, browser back/forward restore, and tab refocus.
- Logout clears session data and uses history-safe redirects (`location.replace`) to prevent returning to protected pages via browser Back.
- Server sends no-cache headers for protected HTML pages and `/api/*` routes to reduce cached-page session bypass.
## Default Seeded Accounts

These accounts are seeded on startup if missing:

- Director: `Orban` / `orban123` (branch: `All`)
- Manager (Maganjo): `Branch Manager` / `manager123`
- Manager (Matugga): `Branch Manager 2` / `manager123`
- Agent (Maganjo): `Agent Maganjo` / `agent123`
- Agent (Matugga): `Agent Matugga` / `agent123`

## API Highlights

- Auth:
  - `POST /api/auth/login`
  - `POST /users/login`
  - `POST /users/register`
- Catalog & pricing:
  - `GET /api/products`
  - `GET /api/prices`
  - `PUT /api/prices` (manager)
- Inventory:
  - `GET /api/inventory`
- Procurement:
  - `POST /api/procurements`
  - `PUT /api/procurements/:id`
  - `DELETE /api/procurements/:id`
- Sales:
  - `POST /api/sales/cash`
  - `POST /api/sales/credit`
  - `PUT /api/sales/cash/:id`
  - `PUT /api/sales/credit/:id`
  - `DELETE /api/sales/cash/:id`
  - `DELETE /api/sales/credit/:id`
- Suppliers:
  - `GET /api/suppliers`
  - `POST /api/suppliers`
  - `DELETE /api/suppliers/:id`
- Director:
  - `GET /api/director/aggregates`
  - `GET /api/staff`
  - `POST /api/staff`
  - `PUT /api/staff/:id`
  - `DELETE /api/staff/:id`
- App state:
  - `GET /api/state`

## Notes

- Static files are served from `public/` first, then project root fallback.
- JWT auth is required for protected `/api/*` routes.
- Validation enforces branch-level access and minimum business rules (stock, pricing, contacts, IDs).
