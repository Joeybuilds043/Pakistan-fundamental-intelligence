from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    service: str


class DocumentInspection(BaseModel):
    filename: str
    content_type: str
    size_bytes: int = Field(ge=0)
    sha256: str
    classification: str = "source_document"
    extraction_status: str = "not_started"
    message: str
