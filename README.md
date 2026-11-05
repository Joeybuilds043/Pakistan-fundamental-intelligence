# Pakistan Fundamental Intelligence (PFI)

A PSX-first fundamental research platform designed to analyse listed companies using their annual reports, quarterly reports and financial statements.

## Architecture

- Frontend: React + Vite
- Backend: Python + FastAPI
- Database and authentication: Supabase
- Document storage: Cloudflare R2
- Research prototype: Streamlit
- API hosting: Railway
- Frontend hosting: Cloudflare Pages

## Initial capabilities

- Company research workspace
- Financial document registration
- PDF and Excel report intake
- Source-document tracking
- Financial observation records
- Consolidated and standalone statement separation
- Annual and quarterly reporting-period controls

## Important

This is an early-stage research platform. It does not yet provide verified automated financial extraction or investment recommendations.

Financial observations must be traceable to their original source documents. Missing values must remain missing rather than being fabricated.

## Local backend setup

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
