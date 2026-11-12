# CourseLens: knowledge-graph prototype (history)

> This describes an earlier knowledge-graph prototype that is no longer in this repository. For CourseLens itself, see [README.md](README.md).

A browser-based tool that extracts structured knowledge graphs from technical lecture materials, letting students navigate course content as a unified "Web of Knowledge."

Upload HTML, Markdown, or PDF lecture files and the app extracts concepts, relationships, and dependencies using Google Gemini, then renders them as an interactive graph.

## Prerequisites

- Python 3.11+
- Node.js 18+ and npm
- [uv](https://docs.astral.sh/uv/getting-started/installation/) (Python package manager)

---

## Quick Start (from scratch)

Run the backend and frontend in **two separate terminals**.

### 1. Backend

```bash
cd backend
cp .env.example .env
```

Install dependencies and start the server:

```bash
uv sync
uv run uvicorn app.main:app --reload
```

Backend runs at http://localhost:8000.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend runs at http://localhost:5173.

### 3. Verify

```bash
curl http://localhost:8000/api/health
# {"status":"ok"}
```

Open http://localhost:5173, click **Try a sample** to load a demo graph, or upload your own lecture file.

---

## Quick Start (already set up)

If dependencies are already installed (`.venv` exists, `node_modules` exists, `.env` files configured):

**Terminal 1 — Backend:**

```bash
cd backend
uv run uvicorn app.main:app --reload
```

**Terminal 2 — Frontend:**

```bash
cd frontend
npm run dev
```

Open http://localhost:5173.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_MODEL` | No | `gemini-2.5-pro` | Model to use for extraction |
| `ALLOWED_ORIGINS` | No | `http://localhost:5173` | CORS allowed origins |
| `SUPABASE_URL` | No | — | Supabase project URL (telemetry only) |
| `SUPABASE_ANON_KEY` | No | — | Supabase anon key (telemetry only) |

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | `http://localhost:8000` | Backend API URL |

### Backend Development Dependencies

For backend tests and linting, install the dev extra:

```bash
cd backend
uv sync --extra dev
```

Do not use `uv sync --all-extras` for normal setup. It installs experimental semantic-dedup dependencies such as `sentence-transformers`, which pulls in large ML packages including `torch`; those are not used by the default backend.

## Supported File Types

- `.html` — HTML lecture pages
- `.md` — Markdown notes
- `.pdf` — PDF slides / documents

## Common Issues

- **CORS errors in browser console**: Ensure `ALLOWED_ORIGINS` in `backend/.env` matches your frontend URL.
- **Frontend env changes not taking effect**: Restart the Vite dev server after editing `frontend/.env`.
- **Supabase warnings**: `SUPABASE_URL` / `SUPABASE_ANON_KEY` are optional. The app works without them — telemetry is skipped.
