from hashlib import sha256
from pathlib import Path
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .config import APP_ENV, CORS_ORIGINS, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB
from .schemas import DocumentInspection, HealthResponse

app = FastAPI(
    title="Pakistan Fundamental Intelligence API",
    version="0.1.0",
    description="Source-traceable fundamental research API for PSX-listed companies.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = {".pdf", ".xlsx", ".xls", ".csv"}
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
    "application/csv",
    "application/octet-stream",
}


@app.get("/", tags=["system"])
def root():
    return {
        "name": "Pakistan Fundamental Intelligence API",
        "version": "0.1.0",
        "environment": APP_ENV,
        "docs": "/docs",
    }


@app.get("/health", response_model=HealthResponse, tags=["system"])
def health():
    return HealthResponse(status="ok", service="pfi-api")


@app.post(
    "/v1/documents/inspect",
    response_model=DocumentInspection,
    tags=["documents"],
)
async def inspect_document(file: UploadFile = File(...)):
    filename = Path(file.filename or "").name
    extension = Path(filename).suffix.lower()

    if not filename or extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type. Upload PDF, XLSX, XLS, or CSV.",
        )

    if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported content type.")

    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {MAX_UPLOAD_MB} MB upload limit.",
        )

    # This endpoint validates and fingerprints the source only. It does not
    # claim to extract or verify financial figures, and does not persist files.
    return DocumentInspection(
        filename=filename,
        content_type=file.content_type or "application/octet-stream",
        size_bytes=len(content),
        sha256=sha256(content).hexdigest(),
        message=(
            "File received and fingerprinted in memory. "
            "No financial figures were extracted and no file was stored."
        ),
    )
