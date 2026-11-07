# HomeForge — Fund It

Early-stage financial screening tool for nonprofit affordable-homeownership developers.
See `HomeForge_Claude_Code_Implementation_Plan.md` for the full spec.
**All demo figures are illustrative assumptions, not real Habitat data or funding.**

## Run locally

Requires Python 3.11+ and Node 20+.

```bash
# Backend (repo root)
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000

# Frontend (second terminal, repo root)
npm --prefix frontend install
npm --prefix frontend run dev        # http://localhost:5173
```

## Tests

```bash
source .venv/bin/activate
python -m pytest backend/tests -q
npm --prefix frontend run build
```
