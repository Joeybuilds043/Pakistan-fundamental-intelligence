from hashlib import sha256
from pathlib import Path
import httpx
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .config import APP_ENV, CORS_ORIGINS, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL
from .extraction import extract_pdf_candidates
from .quant import run_fundamental_scenario
from .schemas import DocumentInspection, HealthResponse, QuantScenarioRequest

app = FastAPI(
    title="Pakistan Fundamental Intelligence API",
    version="0.3.0",
    description="Source-traceable fundamental research and quantitative scenario API for PSX-listed companies.",
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


async def require_authenticated_user(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sign in before analyzing a report.")
    if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY:
        raise HTTPException(status_code=503, detail="Authentication service is not configured.")
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={"apikey": SUPABASE_PUBLISHABLE_KEY, "Authorization": authorization},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Could not verify the user session. Try again.") from exc
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Your session is invalid or expired. Sign in again.")
    user = response.json()
    if not user.get("id"):
        raise HTTPException(status_code=401, detail="Supabase did not return a valid user.")
    return user


@app.get("/", tags=["system"])
def root():
    return {
        "name": "Pakistan Fundamental Intelligence API",
        "version": "0.3.0",
        "environment": APP_ENV,
        "docs": "/docs",
        "capabilities": ["source_inspection", "pdf_candidate_extraction", "quantitative_scenarios"],
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


@app.post("/v1/documents/analyze", tags=["documents"])
async def analyze_pdf(file: UploadFile = File(...), _user: dict = Depends(require_authenticated_user)):
    """Extract reviewable financial-line-item candidates from a text-based PDF.

    This endpoint does not persist files or treat extracted values as verified
    accounting observations. Users must confirm period, scope and units.
    """
    filename = Path(file.filename or "").name
    if Path(filename).suffix.lower() != ".pdf":
        raise HTTPException(status_code=415, detail="Initial extraction supports PDF files only.")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded PDF is empty.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File exceeds the {MAX_UPLOAD_MB} MB upload limit.")
    try:
        extracted = extract_pdf_candidates(content)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail="PDF could not be parsed. It may be encrypted, damaged or image-only.") from exc
    return {
        "filename": filename,
        "size_bytes": len(content),
        "sha256": sha256(content).hexdigest(),
        **extracted,
    }


@app.post("/v1/quant/scenario", tags=["quantitative research"])
def quantitative_scenario(request: QuantScenarioRequest):
    years = [point.fiscal_year for point in request.history]
    if years != sorted(set(years)):
        raise HTTPException(
            status_code=422,
            detail="Annual observations must have unique, strictly increasing fiscal years.",
        )
    if any(years[index] - years[index - 1] > 2 for index in range(1, len(years))):
        raise HTTPException(
            status_code=422,
            detail="A gap greater than one missing fiscal year requires manual review.",
        )
    try:
        return run_fundamental_scenario(request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
