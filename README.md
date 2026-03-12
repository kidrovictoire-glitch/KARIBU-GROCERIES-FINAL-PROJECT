# Karibu Groceries Monorepo

Frontend and backend are now separated:

- `BACKEND/` — Node.js/Express API (MongoDB, JWT). Run from this folder with `npm install` then `npm start`.
- `FRONTEND/` — static HTML/CSS/JS UI. Deploy as static hosting (e.g., Vercel) and set `window.API_BASE` in `FRONTEND/js/config.js` to point at the backend URL.

Existing project docs and API details remain in `BACKEND/README.md`.
