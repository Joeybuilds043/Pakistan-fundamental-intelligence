# Pakistan Fundamental Intelligence (PFI)

A PSX-first, source-traceable fundamental research platform. The current repository contains an early working prototype, not a finished financial-analysis engine.

## Architecture
- Web app: React + Vite (`/frontend`)
- API: Python + FastAPI (`/backend`)
- Relational data and authentication: Supabase
- Private source storage: Cloudflare R2 (not yet enabled)
- Optional intake prototype: Streamlit (`streamlit_app.py`)
- Hosting target: Cloudflare Pages + Railway

## Current functionality
- FastAPI health endpoint at `/health`
- Document inspection endpoint at `/v1/documents/inspect`
- PDF, XLSX, XLS and CSV type/size validation
- SHA-256 source fingerprinting
- React upload interface connected to the API
- Streamlit session-only source register and CSV export
- API smoke tests

## Important limitations
The upload endpoint reads the file in memory, calculates a fingerprint and discards the file. It does not authenticate users, persist files, extract statement values, or provide investment recommendations. The Streamlit prototype stores its register only in the active session. Do not treat either as production document storage.

Financial values must never be fabricated. Every future observation must carry its source document, reporting period, currency/unit, statement scope and source locator. See [Financial Data Contract](docs/FINANCIAL_DATA_CONTRACT.md).

## Run locally

### API
```bash
cd backend
python -m venv .venv
# activate the virtual environment
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Web app
```bash
cd frontend
npm install
# create .env with VITE_API_URL=http://localhost:8000
npm run dev
```

### Streamlit prototype
From the repository root:
```bash
pip install -r requirements.txt
streamlit run streamlit_app.py
```

## Deployment
See [Deployment Notes](docs/DEPLOYMENT.md). Never commit real API keys, Supabase service-role keys, R2 secrets or production credentials.
