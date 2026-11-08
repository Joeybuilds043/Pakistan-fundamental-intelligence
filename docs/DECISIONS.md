# Architecture Decisions

- Product: separate PSX-first fundamental research platform; existing MarketPilot project remains untouched.
- Initial market: Pakistan Stock Exchange listed companies.
- Financial source of truth: user-supplied annual reports, quarterly reports and financial workbooks.
- Deployment: React/Vite on Cloudflare Pages; FastAPI on Railway.
- Identity and relational data: Supabase Auth and Postgres.
- Private source-document storage: Cloudflare R2, pending account-level R2 activation.
- Streamlit: optional research prototype, not the primary production frontend.
- Financial integrity: source-linked observations, explicit period and scope, version history, and no fabricated values.
