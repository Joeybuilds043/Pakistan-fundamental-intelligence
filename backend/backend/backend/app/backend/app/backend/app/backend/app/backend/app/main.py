import hashlib

from fastapi import FastAPI, File, HTTPException, UploadFile

from app.config import settings
from app.schemas import HealthResponse


app = FastAPI(
    title="Pakistan Fundamental Intelligence API",
    version="0.1.0",
    description="PSX-first fundamental research API."
)

ALLOWED_EXTENSIONS = {".pdf", ".xlsx", ".xls"}


@app.get("/", tags=["System"])
async def root():
    return {
        "service": "Pakistan Fundamental Intelligence API",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health():
    return HealthResponse(
        status="ok",
        environment=settings.app_env
    )


@app.post("/v1/documents/inspect", tags=["Documents"])
async def inspect_document(file: UploadFile = File(...)):
    """
    Temporary document inspection endpoint.

    Calculates a SHA-256 hash but does not persist uploaded files.
    Production deployment requires authentication, ownership checks,
    malware scanning, quotas and private object storage.
    """

    filename = (file.filename or "").lower()

    if not any(filename.endswith(ext) for ext in ALLOWED_EXTENSIONS):
        raise HTTPException(
            status_code=415,
            detail="Only PDF, XLSX and XLS files are accepted."
        )

    content = await file.read(
        settings.max_upload_mb * 1024 * 1024 + 1
    )

    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="File exceeds configured upload limit."
        )

    digest = hashlib.sha256(content).hexdigest()

    return {
        "filename": file.filename,
        "size_bytes": len(content),
        "sha256": digest,
        "status": "inspected_not_stored",
        "warning": (
            "This endpoint does not provide authentication "
            "or durable document storage."
        )
    }
