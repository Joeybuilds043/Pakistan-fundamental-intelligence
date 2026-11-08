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


class AnnualFinancialPoint(BaseModel):
    fiscal_year: int = Field(ge=1900, le=2200)
    revenue: float = Field(gt=0)
    operating_cash_flow: float
    capex: float = Field(ge=0)


class QuantScenarioRequest(BaseModel):
    ticker: str = Field(min_length=1, max_length=20, pattern=r"^[A-Za-z0-9&._-]+$")
    history: list[AnnualFinancialPoint] = Field(min_length=4, max_length=20)
    forecast_years: int = Field(default=3, ge=1, le=5)
    simulations: int = Field(default=10000, ge=1000, le=50000)
    growth_hurdle: float = Field(default=0.05, ge=-0.5, le=1.0)
    sector_growth_prior_mean: float = Field(default=0.08, ge=-0.5, le=1.0)
    sector_growth_prior_std: float = Field(default=0.12, gt=0.005, le=1.0)
    stress_growth_delta: float = Field(default=-0.10, ge=-1.0, le=1.0)
    stress_fcf_margin_delta: float = Field(default=-0.05, ge=-1.0, le=1.0)
