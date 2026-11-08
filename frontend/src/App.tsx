import { useState } from "react";
import { Activity, ArrowUpRight, FileText, ShieldCheck, UploadCloud } from "lucide-react";

type Inspection = {
  filename: string;
  size_bytes: number;
  sha256: string;
  extraction_status: string;
  message: string;
};

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Inspection | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function inspectFile() {
    if (!file) return;
    setBusy(true); setError(""); setResult(null);
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch(`${API_URL}/v1/documents/inspect`, { method: "POST", body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Upload inspection failed.");
      setResult(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the API. Check VITE_API_URL.");
    } finally { setBusy(false); }
  }

  return <main className="shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark">PFI</span><span>Pakistan Fundamental Intelligence<small>RESEARCH TERMINAL</small></span></a>
      <span className="status"><i /> Prototype environment</span>
    </header>

    <section className="hero">
      <div className="eyebrow">PSX · FUNDAMENTAL RESEARCH</div>
      <h1>Understand the business.<br/><em>Verify the numbers.</em></h1>
      <p className="lead">A source-first workspace for analysing financial strength, earnings quality, sustainable growth, leverage and valuation across Pakistan-listed companies.</p>
      <div className="hero-actions"><a className="primary-link" href="#intake">Start with a source document <ArrowUpRight size={16}/></a><span>Evidence before conclusions</span></div>
    </section>

    <section className="metrics">
      <article><Activity/><span>Research focus</span><strong>Fundamentals</strong><small>Not price predictions</small></article>
      <article><FileText/><span>Source integrity</span><strong>Traceable</strong><small>Document fingerprints</small></article>
      <article><ShieldCheck/><span>Data policy</span><strong>No fabrication</strong><small>Missing stays missing</small></article>
    </section>

    <section className="workspace" id="intake">
      <div className="section-head"><div><div className="eyebrow">01 / SOURCE INTAKE</div><h2>Register a financial report</h2></div><span className="tag">PDF · XLSX · XLS · CSV</span></div>
      <p className="muted">This first-stage endpoint validates the upload and calculates a SHA-256 fingerprint. It does not yet extract financial statements or permanently store the file.</p>
      <label className="dropzone">
        <UploadCloud size={28}/>
        <strong>{file ? file.name : "Choose an annual report or financial workbook"}</strong>
        <span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB selected` : "Select a file from your device · Maximum 25 MB"}</span>
        <input type="file" accept=".pdf,.xlsx,.xls,.csv" onChange={e => {setFile(e.target.files?.[0] || null);setResult(null);setError("");}}/>
      </label>
      <button className="submit" onClick={inspectFile} disabled={!file || busy}>{busy ? "Inspecting source…" : "Inspect source document"}</button>
      {error && <div className="notice error">{error}</div>}
      {result && <div className="notice success"><strong>Source fingerprint created</strong><p>{result.message}</p><small>{result.filename} · {result.size_bytes.toLocaleString()} bytes · {result.extraction_status}</small><code>{result.sha256}</code></div>}
    </section>

    <section className="workflow">
      <div className="eyebrow">RESEARCH PIPELINE</div><h2>From filings to defensible analysis</h2>
      <div className="steps">
        {[
          ["01","Source intake","Capture issuer, period, statement scope and original filing."],
          ["02","Structured extraction","Extract line items with page-level source references."],
          ["03","Quality controls","Reconcile statements and flag inconsistencies or gaps."],
          ["04","Fundamental analysis","Evaluate growth, cash conversion, debt, returns and valuation."]
        ].map(([n,t,d])=><article key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></article>)}
      </div>
    </section>
    <footer>Pakistan Fundamental Intelligence <span>Research prototype · Not investment advice</span></footer>
  </main>;
}
