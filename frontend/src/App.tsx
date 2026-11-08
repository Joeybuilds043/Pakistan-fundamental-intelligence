import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { DOCUMENT_BUCKET, supabase } from "./lib/supabase";
import { Activity, ArrowUpRight, FileText, ShieldCheck, UploadCloud, Plus, Trash2, FlaskConical } from "lucide-react";

type Inspection = {
  filename: string;
  size_bytes: number;
  sha256: string;
  extraction_status: string;
  message: string;
};
type DocumentRow = { id: string; original_filename: string; storage_key: string; document_type: string; fiscal_year: number | null; statement_scope: string; size_bytes: number; uploaded_at: string };
type HistoryRow = { fiscal_year: string; revenue: string; operating_cash_flow: string; capex: string };
type QuantResult = {
  ticker: string;
  model: string;
  model_version: string;
  status: string;
  horizon_years: number;
  growth_hurdle: number;
  simulations: number;
  posterior_revenue_growth: { mean: number; std_dev: number; prior_mean: number; prior_std_dev: number };
  base_case_probabilities: {
    all_forecast_years_fcf_positive: number;
    at_least_one_forecast_year_fcf_negative: number;
    revenue_cagr_meets_hurdle: number;
    terminal_revenue_below_starting_revenue: number;
    cumulative_fcf_negative: number;
  };
  stress_case: { growth_delta_per_year: number; fcf_margin_delta: number; probability_any_year_fcf_negative: number };
  terminal_revenue: { p10: number; median: number; p90: number; currency: string };
  cumulative_fcf: { p10: number; median: number; p90: number; currency: string };
  limitations: string[];
};
const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
const emptyRow = (): HistoryRow => ({ fiscal_year: "", revenue: "", operating_cash_flow: "", capex: "" });
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const number = (value: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value);

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [documentError, setDocumentError] = useState("");
  const [documentType, setDocumentType] = useState("annual_report");
  const [fiscalYear, setFiscalYear] = useState("");
  const [statementScope, setStatementScope] = useState("consolidated");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Inspection | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ticker, setTicker] = useState("");
  const [rows, setRows] = useState<HistoryRow[]>([emptyRow(), emptyRow(), emptyRow(), emptyRow()]);
  const [quantBusy, setQuantBusy] = useState(false);
  const [quantError, setQuantError] = useState("");
  const [quantResult, setQuantResult] = useState<QuantResult | null>(null);
  const [hurdle, setHurdle] = useState("5");
  const [horizon, setHorizon] = useState("3");

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user.id) { setDocuments([]); return; }
    let active = true;
    supabase.from("source_documents")
      .select("id,original_filename,storage_key,document_type,fiscal_year,statement_scope,size_bytes,uploaded_at")
      .order("uploaded_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setDocumentError(error.message);
        else { setDocuments((data ?? []) as DocumentRow[]); setDocumentError(""); }
      });
    return () => { active = false; };
  }, [session?.user.id]);

  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setAuthBusy(true); setAuthMessage("");
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        setAuthMessage(data.session ? "Account created and signed in." : "Account created. Check your email to confirm the address, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally { setAuthBusy(false); }
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setAuthMessage(error.message);
  }

  async function downloadDocument(document: DocumentRow) {
    if (!supabase) return;
    const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).download(document.storage_key);
    if (error) { setDocumentError(error.message); return; }
    const url = URL.createObjectURL(data);
    const anchor = window.document.createElement("a");
    anchor.href = url; anchor.download = document.original_filename; anchor.click();
    URL.revokeObjectURL(url);
  }

  async function inspectFile() {
    if (!file || !supabase || !session?.user) return;
    setBusy(true); setError(""); setResult(null); setDocumentError("");
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      const allowed = ["pdf", "xlsx", "xls", "csv"];
      if (!allowed.includes(extension)) throw new Error("Upload a PDF, XLSX, XLS or CSV file.");
      if (file.size <= 0 || file.size > 25 * 1024 * 1024) throw new Error("File must be between 1 byte and 25 MB.");
      const mimeByExtension: Record<string, string> = {
        pdf: "application/pdf",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        xls: "application/vnd.ms-excel",
        csv: "text/csv",
      };
      const contentType = file.type || mimeByExtension[extension];
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const hash = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
      const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-120);
      const storageKey = session.user.id + "/" + crypto.randomUUID() + "-" + safeName;
      const { error: uploadError } = await supabase.storage.from(DOCUMENT_BUCKET).upload(storageKey, file, {
        cacheControl: "3600", contentType, upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data, error: metadataError } = await supabase.from("source_documents").insert({
        original_filename: file.name,
        storage_key: storageKey,
        mime_type: contentType,
        size_bytes: file.size,
        sha256: hash,
        document_type: documentType,
        fiscal_year: fiscalYear ? Number(fiscalYear) : null,
        statement_scope: statementScope,
      }).select("id,original_filename,storage_key,document_type,fiscal_year,statement_scope,size_bytes,uploaded_at").single();
      if (metadataError) {
        await supabase.storage.from(DOCUMENT_BUCKET).remove([storageKey]);
        throw metadataError;
      }
      const saved = data as DocumentRow;
      setDocuments(current => [saved, ...current]);
      setResult({
        filename: file.name, size_bytes: file.size, sha256: hash,
        extraction_status: "stored_pending_extraction",
        message: "Original report securely stored in your private account. Financial figures have not yet been extracted or validated.",
      });
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not store the document. Check your session and Storage policies.");
    } finally { setBusy(false); }
  }

  function updateRow(index: number, field: keyof HistoryRow, value: string) {
    setRows(current => current.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }

  async function runQuant(event: FormEvent) {
    event.preventDefault();
    setQuantBusy(true); setQuantError(""); setQuantResult(null);
    try {
      const history = rows.map(row => ({
        fiscal_year: Number(row.fiscal_year),
        revenue: Number(row.revenue),
        operating_cash_flow: Number(row.operating_cash_flow),
        capex: Number(row.capex),
      }));
      if (history.some(row => !row.fiscal_year || !row.revenue || !Number.isFinite(row.operating_cash_flow) || !Number.isFinite(row.capex))) {
        throw new Error("Complete every year, revenue, operating cash flow and capex field. Use 0 only when the reported value is genuinely zero.");
      }
      const response = await fetch(`${API_URL}/v1/quant/scenario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: ticker.trim().toUpperCase(),
          history,
          forecast_years: Number(horizon),
          simulations: 10000,
          growth_hurdle: Number(hurdle) / 100,
          sector_growth_prior_mean: 0.08,
          sector_growth_prior_std: 0.12,
          stress_growth_delta: -0.10,
          stress_fcf_margin_delta: -0.05,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Quantitative analysis failed.");
      setQuantResult(payload);
    } catch (e) {
      setQuantError(e instanceof Error ? e.message : "Could not run the scenario.");
    } finally { setQuantBusy(false); }
  }

  if (!supabase) return <main className="auth-screen"><section className="auth-card"><div className="brand-mark">PFI</div><h1>Supabase configuration required</h1><p>Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to Cloudflare Pages environment variables, then redeploy.</p></section></main>;
  if (authLoading) return <main className="auth-screen"><section className="auth-card"><div className="brand-mark">PFI</div><p>Checking secure session…</p></section></main>;
  if (!session) return <main className="auth-screen"><section className="auth-card">
    <div className="brand-mark">PFI</div><div className="eyebrow">PRIVATE RESEARCH WORKSPACE</div>
    <h1>{authMode === "signin" ? "Sign in to PFI" : "Create your PFI account"}</h1>
    <p>Financial reports are stored in a private bucket. Your account controls access to its documents and metadata.</p>
    <form onSubmit={handleAuth} className="auth-form">
      <label>Email address<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@example.com"/></label>
      <label>Password<input type="password" autoComplete={authMode === "signin" ? "current-password" : "new-password"} minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required placeholder="At least 8 characters"/></label>
      <button className="submit" type="submit" disabled={authBusy}>{authBusy ? "Please wait…" : authMode === "signin" ? "Sign in" : "Create account"}</button>
    </form>
    {authMessage && <div className="notice error">{authMessage}</div>}
    <button className="auth-switch" onClick={()=>{setAuthMode(mode=>mode === "signin" ? "signup" : "signin");setAuthMessage("");}}>{authMode === "signin" ? "New to PFI? Create an account" : "Already registered? Sign in"}</button>
  </section></main>;

  return <main className="shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark">PFI</span><span>Pakistan Fundamental Intelligence<small>RESEARCH TERMINAL</small></span></a>
      <div className="account-actions"><span className="status"><i /> {session.user.email}</span><button className="signout" onClick={signOut}>Sign out</button></div>
    </header>

    <section className="hero">
      <div className="eyebrow">PSX · FUNDAMENTAL & QUANTITATIVE RESEARCH</div>
      <h1>Understand the business.<br/><em>Quantify the uncertainty.</em></h1>
      <p className="lead">A source-first research workspace for financial strength, earnings quality, sustainable growth, cash generation, leverage and valuation. Quantitative outputs remain conditional on the data and assumptions supplied.</p>
      <div className="hero-actions"><a className="primary-link" href="#quant">Open Quant Lab <ArrowUpRight size={16}/></a><span>Evidence before conclusions</span></div>
    </section>

    <section className="metrics">
      <article><Activity/><span>Research focus</span><strong>Business quality</strong><small>Cash flows over narratives</small></article>
      <article><FlaskConical/><span>Quant framework</span><strong>Bayesian + Monte Carlo</strong><small>Conditional scenario probabilities</small></article>
      <article><ShieldCheck/><span>Data policy</span><strong>No fabricated figures</strong><small>Missing stays missing</small></article>
    </section>

    <section className="workspace quant-workspace" id="quant">
      <div className="section-head"><div><div className="eyebrow">01 / QUANTITATIVE RESEARCH</div><h2>Fundamental scenario lab</h2></div><span className="tag">10,000 SIMULATIONS</span></div>
      <p className="muted">Enter at least four annual observations from the same reporting basis and currency. The model shrinks historical revenue growth toward an explicit prior, simulates future growth and free-cash-flow margins, then applies a downside shock. These are conditional business scenarios—not stock-return forecasts.</p>
      <form onSubmit={runQuant}>
        <div className="quant-controls">
          <label>PSX ticker<input value={ticker} onChange={e=>setTicker(e.target.value)} placeholder="e.g. LUCK" required maxLength={20}/></label>
          <label>Forecast horizon<select value={horizon} onChange={e=>setHorizon(e.target.value)}><option value="1">1 year</option><option value="2">2 years</option><option value="3">3 years</option><option value="4">4 years</option><option value="5">5 years</option></select></label>
          <label>Revenue CAGR hurdle (%)<input type="number" min="-50" max="100" step="0.5" value={hurdle} onChange={e=>setHurdle(e.target.value)} required/></label>
        </div>
        <div className="history-heading"><strong>Annual financial history</strong><span>Use consistent units, e.g. PKR million</span></div>
        <div className="history-table">
          <div className="history-row history-labels"><span>Fiscal year</span><span>Revenue</span><span>Operating cash flow</span><span>Capital expenditure</span><span /></div>
          {rows.map((row,index)=><div className="history-row" key={index}>
            <input aria-label={`Fiscal year ${index+1}`} type="number" placeholder="2021" value={row.fiscal_year} onChange={e=>updateRow(index,"fiscal_year",e.target.value)} required/>
            <input aria-label={`Revenue ${index+1}`} type="number" min="0.01" step="any" placeholder="Revenue" value={row.revenue} onChange={e=>updateRow(index,"revenue",e.target.value)} required/>
            <input aria-label={`Operating cash flow ${index+1}`} type="number" step="any" placeholder="Operating CF" value={row.operating_cash_flow} onChange={e=>updateRow(index,"operating_cash_flow",e.target.value)} required/>
            <input aria-label={`Capex ${index+1}`} type="number" min="0" step="any" placeholder="Capex" value={row.capex} onChange={e=>updateRow(index,"capex",e.target.value)} required/>
            <button type="button" className="icon-button" aria-label="Remove year" disabled={rows.length<=4} onClick={()=>setRows(current=>current.filter((_,i)=>i!==index))}><Trash2 size={15}/></button>
          </div>)}
        </div>
        <div className="form-actions"><button type="button" className="secondary" onClick={()=>setRows(current=>[...current,emptyRow()])} disabled={rows.length>=20}><Plus size={15}/> Add year</button><button className="submit" type="submit" disabled={quantBusy || !ticker.trim()}>{quantBusy ? "Running simulations…" : "Run probability analysis"}</button></div>
      </form>
      {quantError && <div className="notice error">{quantError}</div>}
      {quantResult && <div className="quant-results">
        <div className="result-title"><div><div className="eyebrow">{quantResult.ticker} / MODEL OUTPUT</div><h3>Conditional scenario distribution</h3></div><span className="tag">MODEL {quantResult.model_version} · {quantResult.simulations.toLocaleString()} RUNS</span></div>
        <div className="probability-grid">
          <article><span>At least one negative FCF year</span><strong>{pct(quantResult.base_case_probabilities.at_least_one_forecast_year_fcf_negative)}</strong></article>
          <article><span>Terminal revenue below starting level</span><strong>{pct(quantResult.base_case_probabilities.terminal_revenue_below_starting_revenue)}</strong></article>
          <article><span>Cumulative forecast FCF negative</span><strong>{pct(quantResult.base_case_probabilities.cumulative_fcf_negative)}</strong></article>
          <article><span>Revenue CAGR meets {pct(quantResult.growth_hurdle)} hurdle</span><strong>{pct(quantResult.base_case_probabilities.revenue_cagr_meets_hurdle)}</strong></article>
          <article><span>Stress: any negative FCF year</span><strong>{pct(quantResult.stress_case.probability_any_year_fcf_negative)}</strong></article>
        </div>
        <div className="distribution-grid">
          <article><h4>Terminal revenue</h4><div><span>P10</span><b>{number(quantResult.terminal_revenue.p10)}</b></div><div><span>Median</span><b>{number(quantResult.terminal_revenue.median)}</b></div><div><span>P90</span><b>{number(quantResult.terminal_revenue.p90)}</b></div></article>
          <article><h4>Cumulative free cash flow</h4><div><span>P10</span><b>{number(quantResult.cumulative_fcf.p10)}</b></div><div><span>Median</span><b>{number(quantResult.cumulative_fcf.median)}</b></div><div><span>P90</span><b>{number(quantResult.cumulative_fcf.p90)}</b></div></article>
          <article><h4>Bayesian growth posterior</h4><div><span>Mean</span><b>{pct(quantResult.posterior_revenue_growth.mean)}</b></div><div><span>Std. deviation</span><b>{pct(quantResult.posterior_revenue_growth.std_dev)}</b></div><div><span>Prior mean</span><b>{pct(quantResult.posterior_revenue_growth.prior_mean)}</b></div></article>
        </div>
        <p className="result-disclaimer">Amounts use the units and currency you entered. The model assumes a supplied sector prior (8% mean, 12% standard deviation) and fixed stress shocks. The hurdle is {pct(quantResult.growth_hurdle)}. Results are not calibrated market odds, intrinsic value or expected share returns.</p>
        <details><summary>Model limitations and validation requirements</summary><ul>{quantResult.limitations.map(item=><li key={item}>{item}</li>)}</ul></details>
      </div>}
    </section>

    <section className="workspace" id="intake">
      <div className="section-head"><div><div className="eyebrow">02 / SOURCE INTAKE</div><h2>Register a financial report</h2></div><span className="tag">PDF · XLSX · XLS · CSV</span></div>
      <p className="muted">Reports are uploaded to a private Supabase Storage bucket under your user ID. Metadata and SHA-256 fingerprints are recorded separately. This stage stores the source; it does not yet extract or validate financial figures.</p>
      <div className="document-meta">
        <label>Document type<select value={documentType} onChange={e=>setDocumentType(e.target.value)}><option value="annual_report">Annual report</option><option value="quarterly_report">Quarterly report</option><option value="financial_statement">Financial statement</option><option value="other">Other</option></select></label>
        <label>Fiscal year (optional)<input type="number" min="1900" max="2200" placeholder="e.g. 2025" value={fiscalYear} onChange={e=>setFiscalYear(e.target.value)}/></label>
        <label>Statement scope<select value={statementScope} onChange={e=>setStatementScope(e.target.value)}><option value="consolidated">Consolidated</option><option value="standalone">Standalone</option><option value="unknown">Unknown</option></select></label>
      </div>
      <label className="dropzone">
        <UploadCloud size={28}/><strong>{file ? file.name : "Choose an annual report or financial workbook"}</strong>
        <span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB selected` : "Select a file from your device · Maximum 25 MB"}</span>
        <input type="file" accept=".pdf,.xlsx,.xls,.csv" onChange={e => {setFile(e.target.files?.[0] || null);setResult(null);setError("");}}/>
      </label>
      <button className="submit" onClick={inspectFile} disabled={!file || busy}>{busy ? "Inspecting source…" : "Inspect source document"}</button>
      {error && <div className="notice error">{error}</div>}
      {result && <div className="notice success"><strong>Private source stored</strong><p>{result.message}</p><small>{result.filename} · {result.size_bytes.toLocaleString()} bytes · {result.extraction_status}</small><code>{result.sha256}</code></div>}
      {documentError && <div className="notice error">{documentError}</div>}
      <div className="history-heading"><strong>Your private source library</strong><span>{documents.length} stored document(s)</span></div>
      {documents.length === 0 ? <p className="muted">No reports stored yet. Upload a company filing to begin your source register.</p> : <div className="document-list">{documents.map(document=><article className="document-item" key={document.id}><div><strong>{document.original_filename}</strong><span>{document.document_type.replaceAll("_"," ")} · {document.fiscal_year ?? "Year not set"} · {document.statement_scope} · {(document.size_bytes/1024/1024).toFixed(2)} MB</span></div><button className="secondary" onClick={()=>downloadDocument(document)}><FileText size={14}/> Download</button></article>)}</div>}
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
    <footer>Pakistan Fundamental Intelligence <span>Research prototype · Probabilities are conditional scenarios · Not investment advice</span></footer>
  </main>;
}
