import pytest

from app.extraction import extract_candidates_from_text, parse_amount


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
