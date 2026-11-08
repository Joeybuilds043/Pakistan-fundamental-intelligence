# PFI Web Frontend

React + Vite user interface.

## Local development
```bash
npm install
cp .env.example .env
npm run dev
```

Set `VITE_API_URL` to the FastAPI service origin. The production Pages build uses `npm run build` and publishes `dist`.

The upload screen currently calls the API's in-memory inspection endpoint. It is not durable file storage or financial statement extraction.
