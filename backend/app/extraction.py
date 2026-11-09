"""Conservative PDF statement extraction.

The parser returns reviewable candidates, never accounting facts. It preserves the
page and source line and deliberately does not infer units or choose between
current/prior-year columns.
"""
from __future__ import annotations

import io
import re
from typing import Any

import pdfplumber
import pymupdf as fitz
import pytesseract
from PIL import Image

MAX_PAGES = 200
MAX_CANDIDATES = 1200

METRICS: list[tuple[str, re.Pattern[str]]] = [
    ("cost_of_sales", re.compile(r"\b(cost of sales|cost of revenue)\b", re.I)),
    ("revenue", re.compile(r"\b(revenue|turnover|net sales|sales)\b", re.I)),
    ("gross_profit", re.compile(r"\bgross profit\b", re.I)),
    ("operating_profit", re.compile(r"\b(operating profit|profit from operations|operating income)\b", re.I)),
    ("finance_cost", re.compile(r"\b(finance cost|finance costs|finance expense|interest expense)\b", re.I)),
    ("profit_before_tax", re.compile(r"\b(profit before tax|loss before tax)\b", re.I)),
    ("tax_expense", re.compile(r"\b(income tax expense|taxation|tax expense)\b", re.I)),
    ("profit_after_tax", re.compile(r"\b(profit after tax|profit for the year|net profit|net income)\b", re.I)),
    ("operating_cash_flow", re.compile(r"\b(net cash (generated from|from) operating activities|cash flows from operating activities)\b", re.I)),
    ("capital_expenditure", re.compile(r"\b(purchase of property|additions to property|capital expenditure|purchase of fixed assets)\b", re.I)),
    ("total_assets", re.compile(r"\btotal assets\b", re.I)),
    ("current_assets", re.compile(r"\btotal current assets\b", re.I)),
    ("current_liabilities", re.compile(r"\btotal current liabilities\b", re.I)),
    ("total_equity", re.compile(r"\b(total equity|equity attributable to owners)\b", re.I)),
    ("total_borrowings", re.compile(r"\b(total borrowings|total loans and borrowings|loans and borrowings)\b", re.I)),
    ("cash_and_equivalents", re.compile(r"\b(cash and cash equivalents|cash equivalents)\b", re.I)),
    ("trade_receivables", re.compile(r"\b(trade receivables|accounts receivable)\b", re.I)),
    ("inventories", re.compile(r"\b(inventories|stock in trade)\b", re.I)),
    ("depreciation_amortisation", re.compile(r"\b(depreciation and amortisation|depreciation expense)\b", re.I)),
    ("dividends", re.compile(r"\b(dividend per share|dividends paid|cash dividend)\b", re.I)),
]

AMOUNT_RE = re.compile(r"(?<![A-Za-z])(?:\(?-?\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\)?)(?![A-Za-z])")


def parse_amount(token: str) -> float | None:
    value = token.strip().replace(",", "").replace(" ", "")
    if value in {"-", "—", "–"}:
        return None
    negative = value.startswith("(") and value.endswith(")")
    value = value.strip("()")
    try:
        number = float(value)
    except ValueError:
        return None
    if not number == number or number in (float("inf"), float("-inf")):
        return None
    return -abs(number) if negative else number


def extract_candidates_from_text(text: str, page_number: int, extraction_method: str = "text") -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for line in text.splitlines():
        clean = " ".join(line.split())
        if len(clean) < 5:
            continue
        for metric_code, pattern in METRICS:
            match = pattern.search(clean)
            if not match:
                continue
            tail = clean[match.end():]
            tokens = AMOUNT_RE.findall(tail)
            values: list[dict[str, Any]] = []
            for token in tokens[:6]:
                parsed = parse_amount(token)
                if parsed is None or (parsed.is_integer() and 1900 <= parsed <= 2200):
                    continue
                values.append({"raw": token, "value": parsed})
            if values:
                candidates.append({
                    "metric_code": metric_code,
                    "label": clean[:160],
                    "values": values,
                    "page": page_number,
                    "source_line": clean[:500],
                    "confidence": "review_required",
                    "extraction_method": extraction_method,
                    "unit": "unknown",
                    "period": "unknown",
                    "scope": "unknown",
                })
            break
    return candidates


def _ocr_page(document: fitz.Document, page_index: int) -> str:
    """OCR one rendered PDF page. OCR output remains unverified candidate text."""
    page = document.load_page(page_index)
    # 2x rendering is approximately 144 DPI for a standard PDF page.
    pixmap = page.get_pixmap(
        matrix=fitz.Matrix(2, 2),
        colorspace=fitz.csGRAY,
        alpha=False,
    )
    image = Image.open(io.BytesIO(pixmap.tobytes("png")))
    return pytesseract.image_to_string(
        image,
        lang="eng",
        config="--psm 6",
        timeout=25,
    )


def extract_pdf_candidates(content: bytes) -> dict[str, Any]:
    if not content.startswith(b"%PDF-"):
        raise ValueError("The selected file does not have a valid PDF signature.")

    candidates: list[dict[str, Any]] = []
    warnings: list[str] = []
    ocr_pages: list[int] = []
    ocr_document = None

    with pdfplumber.open(io.BytesIO(content)) as pdf:
        page_count = len(pdf.pages)
        if page_count > MAX_PAGES:
            raise ValueError(f"PDF has {page_count} pages; the current limit is {MAX_PAGES}.")

        for page_index, page in enumerate(pdf.pages):
            page_number = page_index + 1
            text = page.extract_text() or ""
            extraction_method = "text"

            if not text.strip():
                # Only image-only pages are sent through OCR. Text-based PDFs
                # continue using the existing parser without extra rendering.
                try:
                    if ocr_document is None:
                        ocr_document = fitz.open(stream=content, filetype="pdf")
                    text = _ocr_page(ocr_document, page_index) or ""
                    extraction_method = "ocr"
                    if text.strip():
                        ocr_pages.append(page_number)
                        warnings.append(
                            f"Page {page_number}: OCR was used. Verify every digit, sign and value column against the original page."
                        )
                    else:
                        warnings.append(
                            f"Page {page_number}: no selectable text and OCR returned no readable text."
                        )
                except Exception as exc:
                    # A missing Tesseract binary, timeout or damaged page must
                    # not turn the entire document into fabricated/partial data.
                    warnings.append(
                        f"Page {page_number}: OCR could not run ({type(exc).__name__}). Check the scan or OCR runtime."
                    )
                    continue

            if text.strip():
                candidates.extend(
                    extract_candidates_from_text(
                        text,
                        page_number,
                        extraction_method=extraction_method,
                    )
                )

            if len(candidates) >= MAX_CANDIDATES:
                warnings.append("Candidate limit reached; remaining pages were not fully indexed.")
                candidates = candidates[:MAX_CANDIDATES]
                break

    if ocr_document is not None:
        ocr_document.close()

    if not candidates:
        warnings.append(
            "No supported financial line items were detected. The PDF may be scanned, low quality, or use unfamiliar labels."
        )
    warnings.append(
        "All values are extraction candidates. Confirm the reporting column, unit, currency, period and consolidated/standalone scope before using them."
    )

    return {
        "extraction_status": "review_required" if candidates else "no_text_candidates",
        "page_count": page_count,
        "candidate_count": len(candidates),
        "ocr_page_count": len(ocr_pages),
        "ocr_pages": ocr_pages,
        "candidates": candidates,
        "warnings": warnings,
    }
