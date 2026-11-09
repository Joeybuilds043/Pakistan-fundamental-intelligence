import base64
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

def test_extract_pdf_returns_page_referenced_candidates_from_real_pdf_bytes():
    fixture = base64.b64decode(
        "JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMSAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjMgMCBvago8PAovQ29udGVudHMgNyAwIFIgL01lZGlhQm94IFsgMCAwIDYxMiA3OTIgXSAvUGFyZW50IDYgMCBSIC9SZXNvdXJjZXMgPDwKL0ZvbnQgMSAwIFIgL1Byb2NTZXQgWyAvUERGIFAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgNiAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL0F1dGhvciAoYW5vbnltb3VzKSAvQ3JlYXRpb25EYXRlIChEOjIwMjYxMTA5MTM0OTQ4KzAwJzAwJykgL0NyZWF0b3IgKGFub255bW91cykgL0tleXdvcmRzICgpIC9Nb2REYXRlIChEOjIwMjYxMTA5MTM0OTQ4KzAwJzAwJykgL1Byb2R1Y2VyIChSZXBvcnRMYWIgUERGIExpYnJhcnkgLSBcKG9wZW5zb3VyY2VcKSkgCiAgL1N1YmplY3QgKHVuc3BlY2lmaWVkKSAvVGl0bGUgKHVudGl0bGVkKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjYgMCBvYmoKPDwKL0NvdW50IDEgL0tpZHMgWyAzIDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKNyAwIG9iago8PAovTGVuZ3RoIDMwMwo+PgpzdHJlYW0KMSAwIDAgMSAwIDAgY20gIEJUIC9GMSAxMiBUZiAxNC40IFRMIEVUCkJUIDEgMCAwIDEgNzIgNzIwIFRtIChTdGF0ZW1lbnQgb2YgUHJvZml0IG9yIExvc3MpIFRqIFQqIEVUCkJUIDEgMCAwIDEgNzIgNjkwIFRtIChSZXZlbnVlIGZyb20gY29udHJhY3RzIHdpdGggY3VzdG9tZXJzIDEyLDQ1MCAxMCwyMDApIFRqIFQqIEVUCkJUIDEgMCAwIDEgNzIgNjcwIFRtIChDb3N0IG9mIHNhbGVzIDgsMDAwIDcsNTAwKSBUaiBUKiBFVApCVCAxIDAgMCAxIDcyIDY1MCBUbSAoUHJvZml0IGFmdGVyIHRheCAxLDI1MCA5MDApIFRqIFQqIEVUCiAKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgOAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwNjEgMDAwMDAgbiAKMDAwMDAwMDA5MiAwMDAwMCBuIAowMDAwMDAwMTk5IDAwMDAwIG4gCjAwMDAwMDAzOTIgMDAwMDAgbiAKMDAwMDAwMDQ2MCAwMDAwMCBuIAowMDAwMDAwNzIxIDAwMDAwIG4gCjAwMDAwMDA3ODAgMDAwMDAgbiAKdHJhaWxlcgo8PAovSUQgCls8YTVhOWIyNzJlNmE4YTVjOWIwMmVlZGRhYzM1MWE0MmM+PGE1YTliMjcyZTZhOGE1YzliMDJlZWRkYWMzNTFhNDJjPl0KJSBSZXBvcnRMYWIgZ2VuZXJhdGVkIFBERiBkb2N1bWVudCAtLSBkaWdlc3QgKG9wZW5zb3VyY2UpCgovSW5mbyA1IDAgUgovUm9vdCA0IDAgUiAvU2l6ZSA4Cj4+CnN0YXJ0eHJlZgoxMTMzCiUlRU9GCg=="
    )t base64
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

def test_extract_pdf_returns_page_referenced_candidates_from_real_pdf_bytes():
    fixture = base64.b64decode(
        "JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMSAvU3VidHlwZSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQ29udGVudHMgNyAwIFIgL01lZGlhQm94IFsgMCAwIDYxMiA3OTIgXSAvUGFyZW50IDYgMCBSIC9SZXNvdXJjZXMgPDwKL0ZvbnQgMSAwIFIgL1Byb2NTZXQgWyAvUERGIC9UZXh0IC9JbWFnZUIgL0ltYWdlQyAvSW1hZ2VJIF0KPj4gL1JvdGF0ZSAwIC9UcmFucyA8PAo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNCAwIG9iago8PAovUGFnZU1vZGUgL1VzZU5vbmUgL1BhZ2VzIDYgMCBSIC9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iago1IDAgb2JqCjw8Ci9BdXRob3IgKGFub255bW91cykgL0NyZWF0aW9uRGF0ZSAoRDoyMDI2MTEwOTEzNDk0OCswMCcwMCcpIC9DcmVhdG9yIChhbm9ueW1vdXMpIC9LZXl3b3JkcyAoKSAvTW9kRGF0ZSAoRDoyMDI2MTEwOTEzNDk0OCswMCcwMCcpIC9Qcm9kdWNlciAoUmVwb3J0TGFiIFBERiBMaWJyYXJ5IC0gXChvcGVuc291cmNlXCl)CiAgL1N1YmplY3QgKHVuc3BlY2lmaWVkKSAvVGl0bGUgKHVudGl0bGVkKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjYgMCBvYmoKPDwKL0NvdW50IDEgL0tpZHMgWyAzIDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKNyAwIG9iago8PAovTGVuZ3RoIDMwMwo+PgpzdHJlYW0KMSAwIDAgMSAwIDAgY20gIEJUIC9GMSAxMiBUZiAxNC40IFRMIEVUCkJUIDEgMCAwIDEgNzIgNzIwIFRtIChTdGF0ZW1lbnQgb2YgUHJvZml0IG9yIExvc3MpIFRqIFQqIEVUCkJUIDEgMCAwIDEgNzIgNjkwIFRtIChSZXZlbnVlIGZyb20gY29udHJhY3RzIHdpdGggY3VzdG9tZXJzIDEyLDQ1MCAxMCwyMDApIFRqIFQqIEVUCkJUIDEgMCAwIDEgNzIgNjcwIFRtIChDb3N0IG9mIHNhbGVzIDgsMDAwIDcsNTAwKSBUaiBUKiBFVApCVCAxIDAgMCAxIDcyIDY1MCBUbSAoUHJvZml0IGFmdGVyIHRheCAxLDI1MCA5MDApIFRqIFQqIEVUCiAKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgOAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwNjEgMDAwMDAgbiAKMDAwMDAwMDA5MiAwMDAwMCBuIAowMDAwMDAwMTk5IDAwMDAwIG4gCjAwMDAwMDAzOTIgMDAwMDAgbiAKMDAwMDAwMDQ2MCAwMDAwMCBuIAowMDAwMDAwNzIxIDAwMDAwIG4gCjAwMDAwMDA3ODAgMDAwMDAgbiAKdHJhaWxlcgo8PAovSUQgCls8YTVhOWIyNzJlNmE4YTVjOWIwMmVlZGRhYzM1MWE0MmM+PGE1YTliMjcyZTZhOGE1YzliMDJlZWRkYWMzNTFhNDJjPl0KJSBSZXBvcnRMYWIgZ2VuZXJhdGVkIFBERiBkb2N1bWVudCAtLSBkaWdlc3QgKG9wZW5zb3VyY2UpCgovSW5mbyA1IDAgUgovUm9vdCA0IDAgUgovU2l6ZSA4Cj4+CnN0YXJ0eHJlZgoxMTMzCiUlRU9GCg=="
    )
    result = extract_pdf_candidates(fixture)
    assert result["extraction_status"] == "review_required"
    assert result["page_count"] == 1
    assert result["candidate_count"] == 3
    assert [row["metric_code"] for row in result["candidates"]] == [
        "revenue", "cost_of_sales", "profit_after_tax"
    ]
    assert result["candidates"][0]["values"][0]["value"] == 12450
    assert result["candidates"][0]["page"] == 1
