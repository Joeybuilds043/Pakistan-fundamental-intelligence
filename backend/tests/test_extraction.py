import pytest

from app.extraction import extract_candidates_from_text, extract_pdf_candidates, parse_amount


def test_parse_amount_handles_commas_and_parentheses():
    assert parse_amount("1,234.50") == 1234.5
    assert parse_amount("(2,000)") == -2000
    assert parse_amount("—") is None


def test_extracts_revenue_with_page_provenance():
    rows = extract_candidates_from_text("Revenue from contracts with customers 12,450 10,200\nOther comprehensive income 500", 7)
    assert len(rows) == 1
    assert rows[0]["metric_code"] == "revenue"
    assert rows[0]["values"][0]["value"] == 12450
    assert rows[0]["page"] == 7
    assert rows[0]["unit"] == "unknown"


def test_skips_fiscal_year_tokens():
    rows = extract_candidates_from_text("Total assets 2025 2024 45,000 41,000", 3)
    assert rows[0]["values"][0]["value"] == 45000

def test_cost_of_sales_is_not_misclassified_as_revenue():
    rows = extract_candidates_from_text("Cost of sales 8,000 7,500", 2)
    assert rows[0]["metric_code"] == "cost_of_sales"

def test_extract_pdf_returns_reviewable_page_referenced_candidates(monkeypatch):
    class FakePage:
        def extract_text(self):
            return (
                "Statement of Profit or Loss\n"
                "Revenue from contracts with customers 12,450 10,200\n"
                "Cost of sales 8,000 7,500\n"
                "Profit after tax 1,250 900"
            )

    class FakePdf:
        pages = [FakePage()]

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    monkeypatch.setattr("app.extraction.pdfplumber.open", lambda _: FakePdf())
    result = extract_pdf_candidates(b"%PDF-test")
    assert result["extraction_status"] == "review_required"
    assert result["page_count"] == 1
    assert result["candidate_count"] == 3
    assert [row["metric_code"] for row in result["candidates"]] == [
        "revenue", "cost_of_sales", "profit_after_tax"
    ]
    assert result["candidates"][0]["values"][0]["value"] == 12450
    assert result["candidates"][0]["page"] == 1


def test_scanned_pdf_uses_ocr_and_marks_candidates_for_review(monkeypatch):
    class FakePage:
        def extract_text(self):
            return None

    class FakePdf:
        pages = [FakePage()]

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    class FakeOcrDocument:
        def close(self):
            pass

    monkeypatch.setattr("app.extraction.pdfplumber.open", lambda _: FakePdf())
    monkeypatch.setattr("app.extraction.fitz.open", lambda **kwargs: FakeOcrDocument())
    monkeypatch.setattr(
        "app.extraction._ocr_page",
        lambda document, page_index: (
            "Statement of Profit or Loss\\n"
            "Revenue from contracts with customers 12,450 10,200\\n"
            "Profit after tax 1,250 900"
        ),
    )

    result = extract_pdf_candidates(b"%PDF-scanned-test")

    assert result["extraction_status"] == "review_required"
    assert result["ocr_page_count"] == 1
    assert result["ocr_pages"] == [1]
    assert result["candidate_count"] == 2
    assert all(row["extraction_method"] == "ocr" for row in result["candidates"])
    assert all(row["confidence"] == "review_required" for row in result["candidates"])
    assert any("OCR was used" in warning for warning in result["warnings"])
