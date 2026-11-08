from fastapi.testclient import TestClient
from app.main import app

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
