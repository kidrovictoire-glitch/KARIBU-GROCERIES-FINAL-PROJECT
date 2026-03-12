# KGL Backend Setup

## 1. Install dependencies
```bash
npm install
```

## 2. Configure environment
1. Copy `.env.example` to `.env`
2. Update:
   - `MONGODB_URI` (your MongoDB connection string)
   - `JWT_SECRET` (any long random string)

## 3. Start server
```bash
npm start
```

Server runs on `http://localhost:5000` by default and serves frontend files from `public/` (if present), then falls back to project root files plus API endpoints.
Reports page: `http://localhost:5000/reports.html`

## 4. Default seeded accounts
- Director: `Orban` / `orban123` (branch: `All`)
- Manager (Maganjo): `Branch Manager` / `manager123`
- Manager (Matugga): `Branch Manager 2` / `manager123`
- Agent (Maganjo): `Agent Maganjo` / `agent123`
- Agent (Matugga): `Agent Matugga` / `agent123`

## Public folder
- Put your frontend files in `public/` (for example: `public/index.html`, `public/reports.html`).
- You can keep existing root HTML files for now; the server will use `public/` first when available.

## Notes
- Keep MongoDB running before starting the app.
- If you were previously using localStorage-only data, the app now syncs from backend after login.
