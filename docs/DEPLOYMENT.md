# Deployment Notes

## Backend (Railway)
- Service root directory: `/backend`
- Build: install `requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health check: `/health`
- Set `APP_ENV`, `MAX_UPLOAD_MB`, `CORS_ORIGINS`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY` in Railway variables.
- Do not commit real credentials or service-role keys.

## Frontend (Cloudflare Pages)
- Root directory: `/frontend`
- Build command: `npm run build`
- Build output: `dist`
- Environment variable: `VITE_API_URL` set to the deployed Railway API URL.

## Current limitations
The API upload route only validates file type/size and calculates a SHA-256 digest in memory. It does not persist uploads, authenticate users, or extract financial data. Do not expose this prototype publicly as a production document-storage service until those controls are implemented.
