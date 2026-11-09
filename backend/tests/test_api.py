from fastapi.testclient import TestClient
from app.main import app, require_authenticated_user

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["name"] == "Pakistan Fundamental Intelligence API"


def test_rejects_unsupported_file():
    response = client.post(
        "/v1/documents/inspect",
        files={"file": ("notes.txt", b"not a supported report", "text/plain")},
    )
    assert response.status_code == 415


def test_inspects_pdf_without_claiming_extraction():
    response = client.post(
        "/v1/documents/inspect",
        files={"file": ("annual-report.pdf", b"%PDF-1.4 test", "application/pdf")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["filename"] == "annual-report.pdf"
    assert body["extraction_status"] == "not_started"
    assert len(body["sha256"]) == 64


def test_quant_scenario_endpoint():
    response = client.post(
        "/v1/quant/scenario",
        json={
            "ticker": "DEMO",
            "history": [
                {"fiscal_year": 2021, "revenue": 1000, "operating_cash_flow": 130, "capex": 40},
                {"fiscal_year": 2022, "revenue": 1100, "operating_cash_flow": 150, "capex": 45},
                {"fiscal_year": 2023, "revenue": 1210, "operating_cash_flow": 160, "capex": 50},
                {"fiscal_year": 2024, "revenue": 1331, "operating_cash_flow": 180, "capex": 55},
            ],
            "forecast_years": 3,
            "simulations": 1000,
            "growth_hurdle": 0.05,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "scenario_estimate_not_forecast"
    assert body["simulations"] == 1000
    assert 0 <= body["base_case_probabilities"]["revenue_cagr_meets_hurdle"] <= 1


def test_quant_rejects_non_ascending_fiscal_years():
    response = client.post(
        "/v1/quant/scenario",
        json={
            "ticker": "DEMO",
            "history": [
                {"fiscal_year": 2022, "revenue": 1000, "operating_cash_flow": 130, "capex": 40},
                {"fiscal_year": 2021, "revenue": 1100, "operating_cash_flow": 150, "capex": 45},
                {"fiscal_year": 2023, "revenue": 1210, "operating_cash_flow": 160, "capex": 50},
                {"fiscal_year": 2024, "revenue": 1331, "operating_cash_flow": 180, "capex": 55},
            ],
        },
    )
    assert response.status_code == 422

def test_analyze_pdf_requires_authenticated_user():
    response = client.post(
        "/v1/documents/analyze",
        files={"file": ("annual-report.pdf", b"%PDF-test", "application/pdf")},
    )
    assert response.status_code == 401


def analyze_as_user(upload):
    app.dependency_overrides[require_authenticated_user] = lambda: {"id": "test-user"}
    try:
        return client.post("/v1/documents/analyze", files={"file": upload})
    finally:
        app.dependency_overrides.pop(require_authenticated_user, None)


def test_analyze_pdf_rejects_invalid_pdf_signature():
    response = analyze_as_user(("annual-report.pdf", b"not a real PDF", "application/pdf"))
    assert response.status_code == 422
    assert "valid PDF signature" in response.json()["detail"]


def test_analyze_pdf_rejects_non_pdf_file():
    response = analyze_as_user(("annual-report.csv", b"revenue,100", "text/csv"))
    assert response.status_code == 415
