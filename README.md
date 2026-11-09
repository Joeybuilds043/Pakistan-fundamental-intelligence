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
- Text-based PDF reports can be analyzed after upload or directly from the existing private document library.
- PDF extraction returns reviewable line-item candidates with source page and source-line provenance; it does not silently select the current-year column or infer units/currency.
- A provisional financial-health snapshot calculates margins, liquidity, leverage, cash conversion, interest coverage and closing-balance return ratios only when source rows are unambiguous.
- Monte Carlo scenario histograms, P10/P50/P90 ranges, volatility and lower-decile cash-flow statistics.
- PDF extraction is authenticated through the user's Supabase session. Scanned-PDF OCR and spreadsheet extraction are not yet enabled.
- Quantitative model policy and automated tests.

## Quantitative scenario model
POST /v1/quant/scenario accepts at least four annual observations containing revenue, operating cash flow and capex. It reports conditional probabilities and scenario ranges based on a transparent sector prior and explicit stress shocks. Outputs are not stock-price forecasts, fair values, calibrated market odds or expected share returns.

The post-capex cash flow measure is a proxy, not a fully specified FCFF/FCFE valuation model. The current ratio snapshot is provisional and is not yet saved as validated financial observations. See docs/QUANTITATIVE_MODEL_POLICY.md for assumptions and limitations.

## Architecture
- frontend/: React + TypeScript + Vite
- backend/: Python + FastAPI
- Supabase: Postgres, Auth and private Storage
- Railway: API runtime
- Cloudflare Pages: frontend hosting

## Roadmap
See docs/ROADMAP.md and docs/AUTH_AND_STORAGE.md for deployment, authentication and storage setup. Authentication, private source storage and first-pass PDF candidate extraction are wired. Candidate review and persistence, statement reconciliation, OCR, spreadsheet extraction, point-in-time PSX data and valuation calibration remain before the platform can be described as a complete production research system.

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
