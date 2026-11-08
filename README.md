# Pakistan Fundamental Intelligence (PFI)

A PSX-first research terminal for evidence-backed company analysis. The project separates reported facts, calculated metrics and analyst assumptions; it does not fabricate missing data or present scenario probabilities as investment certainty.

## Live services
- Frontend: https://pakistan-fundamental-intelligence.pages.dev
- API: https://fundamental-api-production.up.railway.app
- API documentation: https://fundamental-api-production.up.railway.app/docs

## Current capabilities
- React/Vite research terminal deployed on Cloudflare Pages.
- FastAPI service deployed on Railway.
- Supabase Postgres schema for companies, source documents and financial observations, with row-level security.
- Supabase Auth email/password sign-up and sign-in.
- Private Supabase Storage bucket `pfi-source-documents`, owner-folder policies, 25 MB per-file limit and PDF/XLSX/XLS/CSV MIME restrictions.
- Authenticated source uploads with SHA-256 fingerprints and metadata stored in `public.source_documents`; private download from the user's own library.
- Uploaded reports are stored, not yet parsed: no financial figures are automatically extracted or validated.
- Quant Lab endpoint using Bayesian shrinkage and Monte Carlo simulation for conditional revenue and free-cash-flow scenarios.
- Stress case and P10/P50/P90 outcome ranges.
- Quantitative model policy and automated tests.

## Quantitative scenario model
POST /v1/quant/scenario accepts at least four annual observations containing revenue, operating cash flow and capex. It reports conditional probabilities and scenario ranges based on a transparent sector prior and explicit stress shocks. Outputs are not stock-price forecasts, fair values, calibrated market odds or expected share returns.

See docs/QUANTITATIVE_MODEL_POLICY.md for assumptions and limitations.

## Architecture
- frontend/: React + TypeScript + Vite
- backend/: Python + FastAPI
- Supabase: Postgres, Auth and private Storage
- Railway: API runtime
- Cloudflare Pages: frontend hosting

## Roadmap
See docs/ROADMAP.md. Authentication and private source storage are now wired. Financial statement extraction, reconciliation, point-in-time PSX data and tested email redirect configuration are still required before the platform can be described as a complete production research system.

## Local development
Backend:
```bash
cd backend
python -m venv .venv
# Activate the environment, then:
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

## Integrity principles
- Missing is not zero.
- Consolidated and standalone statements are never silently mixed.
- Every reported observation must retain its filing and page/sheet/cell provenance.
- Derived metrics must retain formula versions and source observation links.
- Probabilities must disclose their priors, horizon, assumptions and calibration status.
