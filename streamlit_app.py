from datetime import datetime, timezone
from hashlib import sha256
from io import BytesIO
import pandas as pd
import streamlit as st

st.set_page_config(page_title="PFI | Fundamental Intelligence", page_icon="📊", layout="wide")

st.markdown("""
<style>
.stApp { background: #080d16; color: #e8eef8; }
section[data-testid="stSidebar"] { background: #0d1522; }
.block-container { padding-top: 2rem; max-width: 1440px; }
div[data-testid="stMetric"] { background: #111d2d; border: 1px solid #24364d; padding: 16px; border-radius: 12px; }
.pfi-muted { color: #91a4bc; }
</style>
""", unsafe_allow_html=True)

st.title("Pakistan Fundamental Intelligence")
st.caption("PSX-first financial research workspace · Source-first, evidence-led")

if "documents" not in st.session_state:
    st.session_state.documents = []

with st.sidebar:
    st.subheader("Research scope")
    company = st.text_input("Company name", placeholder="e.g. Systems Limited")
    ticker = st.text_input("PSX ticker", placeholder="e.g. SYS")
    period = st.text_input("Reporting period", placeholder="FY2025 / Q1 2026")
    scope = st.selectbox("Statement scope", ["Consolidated", "Standalone", "Not specified"])
    st.divider()
    st.caption("Prototype mode: files are held only in this browser session.")

left, right = st.columns([1.5, 1])
with left:
    st.subheader("Source documents")
    uploads = st.file_uploader(
        "Upload annual reports, quarterly reports or financial workbooks",
        type=["pdf", "xlsx", "xls", "csv"],
        accept_multiple_files=True,
    )
    if st.button("Register selected files", type="primary", disabled=not uploads):
        if not company.strip() or not ticker.strip() or not period.strip():
            st.error("Enter company, ticker and reporting period before registering files.")
        else:
            for item in uploads:
                raw = item.getvalue()
                record = {
                    "company": company.strip(),
                    "ticker": ticker.strip().upper(),
                    "period": period.strip(),
                    "scope": scope,
                    "filename": item.name,
                    "size_bytes": len(raw),
                    "sha256": sha256(raw).hexdigest(),
                    "registered_at": datetime.now(timezone.utc).isoformat(),
                    "status": "Registered · not extracted",
                }
                if not any(d["sha256"] == record["sha256"] for d in st.session_state.documents):
                    st.session_state.documents.append(record)
            st.success("Source fingerprints registered in this session.")

with right:
    st.subheader("Research controls")
    st.metric("Registered sources", len(st.session_state.documents))
    st.metric("Financial observations", "0")
    st.info("No financial figures are inferred from uploaded files in this prototype.")
    st.warning("Session-only: documents are not persisted or sent to cloud storage.")

st.divider()
st.subheader("Document register")
if st.session_state.documents:
    df = pd.DataFrame(st.session_state.documents)
    st.dataframe(df, use_container_width=True, hide_index=True)
    st.download_button(
        "Export register as CSV",
        data=df.to_csv(index=False).encode("utf-8"),
        file_name="pfi-source-register.csv",
        mime="text/csv",
    )
else:
    st.caption("No source documents registered yet.")

st.divider()
st.subheader("Analytical workflow")
steps = [
    ("01 · Intake", "Register a source document and capture company, period and statement scope."),
    ("02 · Extraction", "Future module: extract statement line items with page and table references."),
    ("03 · Validation", "Reconcile totals, compare periods and flag missing or inconsistent values."),
    ("04 · Analysis", "Assess growth, margins, cash conversion, leverage, capital allocation and valuation."),
]
cols = st.columns(4)
for col, (heading, detail) in zip(cols, steps):
    with col:
        st.markdown(f"**{heading}**")
        st.caption(detail)

st.caption("PFI is a research tool, not investment advice. Always verify reported figures against original filings.")
