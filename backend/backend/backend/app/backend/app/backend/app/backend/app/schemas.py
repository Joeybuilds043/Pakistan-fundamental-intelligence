from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    environment: str


class UploadMetadata(BaseModel):
    ticker: str = Field(min_length=1, max_length=20)
    company_name: str = Field(min_length=1, max_length=200)
    fiscal_year: int = Field(ge=1900, le=2100)
    period: str
    statement_scope: str
