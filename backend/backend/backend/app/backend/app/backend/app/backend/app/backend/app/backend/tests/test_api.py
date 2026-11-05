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
    assert (
        response.json()["service"]
        == "Pakistan Fundamental Intelligence API"
    )


def test_rejects_unsupported_extension():
    response = client.post(
        "/v1/documents/inspect",
        files={
            "file": (
                "malware.exe",
                b"test",
                "application/octet-stream"
            )
        }
    )

    assert response.status_code == 415


def test_hashes_pdf_upload_without_storing():
    response = client.post(
        "/v1/documents/inspect",
        files={
            "file": (
                "sample.pdf",
                b"%PDF-1.4 test payload",
                "application/pdf"
            )
        }
    )

    assert response.status_code == 200

    body = response.json()

    assert body["status"] == "inspected_not_stored"
    assert len(body["sha256"]) == 64
