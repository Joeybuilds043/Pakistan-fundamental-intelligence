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
type ExtractedCandidate = {
  metric_code: string; label: string; values: { raw: string; value: number }[];
  page: number; source_line: string; confidence: string; extraction_method?: "text" | "ocr"; unit: string; period: string; scope: string;
};
type AnalysisResult = {
  extraction_status: string; page_count: number; candidate_count: number;
  candidates: ExtractedCandidate[]; warnings: string[];
};
type DocumentRow = { id: string; original_filename: string; storage_key: string; document_type: string; fiscal_year: number | null; statement_scope: string; size_bytes: number; uploaded_at: string; extraction_status: string };
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
  distribution_histograms: {
    terminal_revenue: { lower: number; upper: number; count: number }[];
    cumulative_fcf: { lower: number; upper: number; count: number }[];
  };
  risk_statistics: {
    terminal_revenue_mean: number; terminal_revenue_std_dev: number;
    cumulative_fcf_mean: number; cumulative_fcf_lower_decile_mean: number;
  };
  limitations: string[];
};
const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
const emptyRow = (): HistoryRow => ({ fiscal_year: "", revenue: "", operating_cash_flow: "", capex: "" });
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const number = (value: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value);
const ratioText = (value: number | null, percentage = false) => value === null || !Number.isFinite(value) ? "—" : percentage ? pct(value) : `${value.toFixed(2)}x`;

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
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState("annual_report");
  const [fiscalYear, setFiscalYear] = useState("");
  const [statementScope, setStatementScope] = useState("consolidated");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Inspection | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [candidateSelections, setCandidateSelections] = useState<Record<number, number>>({});
  const [analysisError, setAnalysisError] = useState("");
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
      .select("id,original_filename,storage_key,document_type,fiscal_year,statement_scope,size_bytes,uploaded_at,extraction_status")
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

  async function analyzeStoredDocument(document: DocumentRow) {
    if (!supabase) return;
    setAnalyzingId(document.id);
    setAnalysis(null); setAnalysisError(""); setDocumentError("");
    try {
      const { data, error: downloadError } = await supabase.storage.from(DOCUMENT_BUCKET).download(document.storage_key);
      if (downloadError) throw downloadError;
      const form = new FormData();
      form.append("file", data, document.original_filename);
      const response = await fetch(`${API_URL}/v1/documents/analyze`, { method: "POST", headers: { Authorization: `Bearer ${session?.access_token || ""}` }, body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "PDF extraction failed.");
      const extracted = payload as AnalysisResult;
      const persistedStatus = "needs_review";
      setAnalysis(extracted);
      setCandidateSelections(Object.fromEntries(extracted.candidates.map((_, index) => [index, 0])));
      const { error: updateError } = await supabase.from("source_documents")
        .update({ extraction_status: persistedStatus }).eq("id", document.id);
      if (updateError) setAnalysisError("Extraction succeeded, but its status could not be saved: " + updateError.message);
      else setDocuments(current => current.map(item => item.id === document.id ? { ...item, extraction_status: persistedStatus } : item));
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : "Could not analyze the stored report.");
    } finally { setAnalyzingId(null); }
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
      }).select("id,original_filename,storage_key,document_type,fiscal_year,statement_scope,size_bytes,uploaded_at,extraction_status").single();
      if (metadataError) {
        await supabase.storage.from(DOCUMENT_BUCKET).remove([storageKey]);
        throw metadataError;
      }
      const saved = data as DocumentRow;
      setDocuments(current => [saved, ...current]);

      let extracted: AnalysisResult | null = null;
      let extractionFailure = "";
      if (extension === "pdf") {
        try {
          const form = new FormData();
          form.append("file", file, file.name);
          const response = await fetch(`${API_URL}/v1/documents/analyze`, { method: "POST", headers: { Authorization: `Bearer ${session?.access_token || ""}` }, body: form });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.detail || "The PDF was stored but extraction failed.");
          extracted = payload as AnalysisResult;
        } catch (analysisException) {
          extractionFailure = analysisException instanceof Error ? analysisException.message : "PDF extraction could not be completed.";
        }
      } else {
        extractionFailure = "The source is stored. Automatic extraction currently supports text-based PDFs; spreadsheet extraction is not enabled yet.";
      }
      if (extracted) {
        const persistedStatus = "needs_review";
        const { error: statusError } = await supabase.from("source_documents")
          .update({ extraction_status: persistedStatus }).eq("id", saved.id);
        if (statusError) extractionFailure = "Extraction completed, but its status could not be saved: " + statusError.message;
        else setDocuments(current => current.map(item => item.id === saved.id ? { ...item, extraction_status: persistedStatus } : item));
      }
      setAnalysis(extracted);
      setCandidateSelections(extracted ? Object.fromEntries(extracted.candidates.map((_, index) => [index, 0])) : {});
      setAnalysisError(extractionFailure);
      setResult({
        filename: file.name, size_bytes: file.size, sha256: hash,
        extraction_status: extracted?.extraction_status || "stored_extraction_pending",
        message: extracted
          ? `Report stored. ${extracted.candidate_count} financial line-item candidates detected across ${extracted.page_count} pages. Review them before using any figure.`
          : "Original report securely stored. " + (extractionFailure || "No extraction result was returned."),
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
      const years = history.map(row => row.fiscal_year);
      if (new Set(years).size !== years.length || years.some((year, index) => index > 0 && year <= years[index - 1])) {
        throw new Error("Enter fiscal years once each, in ascending order from oldest to newest.");
      }
      if (years.some((year, index) => index > 0 && year - years[index - 1] > 2)) {
        throw new Error("There is a gap of more than one missing fiscal year. Review the history before running the model.");
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
      if (!response.ok) {
        const detail = Array.isArray(payload.detail) ? payload.detail.map((item: { msg?: string }) => item.msg || "Invalid input").join("; ") : payload.detail;
        throw new Error(detail || "Quantitative analysis failed.");
      }
      setQuantResult(payload);
    } catch (e) {
      setQuantError(e instanceof Error ? e.message : "Could not run the scenario.");
    } finally { setQuantBusy(false); }
  }

  const selectedMetricValues: Record<string, number> = {};
  const metricCandidateCounts: Record<string, number> = {};
  analysis?.candidates.forEach(candidate => {
    metricCandidateCounts[candidate.metric_code] = (metricCandidateCounts[candidate.metric_code] ?? 0) + 1;
  });
  analysis?.candidates.forEach((candidate, index) => {
    const selected = candidate.values[candidateSelections[index] ?? 0];
    if (selected && metricCandidateCounts[candidate.metric_code] === 1) {
      selectedMetricValues[candidate.metric_code] = selected.value;
    }
  });
  const getMetric = (code: string) => selectedMetricValues[code];
  const ratio = (numerator: number | undefined, denominator: number | undefined): number | null =>
    numerator === undefined || denominator === undefined || denominator === 0 ? null : numerator / denominator;
  const fcf = getMetric("operating_cash_flow") === undefined || getMetric("capital_expenditure") === undefined
    ? null : getMetric("operating_cash_flow") - Math.abs(getMetric("capital_expenditure"));
  const ratioCards = analysis ? [
    { label: "Gross margin", value: ratio(getMetric("gross_profit"), getMetric("revenue")), percentage: true, formula: "Gross profit / revenue" },
    { label: "Operating margin", value: ratio(getMetric("operating_profit"), getMetric("revenue")), percentage: true, formula: "Operating profit / revenue" },
    { label: "Net margin", value: ratio(getMetric("profit_after_tax"), getMetric("revenue")), percentage: true, formula: "Profit after tax / revenue" },
    { label: "Current ratio", value: ratio(getMetric("current_assets"), getMetric("current_liabilities")), percentage: false, formula: "Current assets / current liabilities" },
    { label: "Debt / equity", value: ratio(getMetric("total_borrowings"), getMetric("total_equity")), percentage: false, formula: "Borrowings / total equity" },
    { label: "Cash conversion", value: ratio(getMetric("operating_cash_flow"), getMetric("profit_after_tax")), percentage: false, formula: "Operating cash flow / profit after tax" },
    { label: "Interest coverage", value: ratio(getMetric("operating_profit"), getMetric("finance_cost")), percentage: false, formula: "Operating profit / finance cost" },
    { label: "ROA (closing assets)", value: ratio(getMetric("profit_after_tax"), getMetric("total_assets")), percentage: true, formula: "Profit after tax / closing total assets" },
    { label: "ROE (closing equity)", value: ratio(getMetric("profit_after_tax"), getMetric("total_equity")), percentage: true, formula: "Profit after tax / closing total equity" },
    { label: "Cash flow after capex", value: fcf, percentage: false, formula: "Operating cash flow − capital expenditure" },
    { label: "Post-capex cash margin", value: ratio(fcf ?? undefined, getMetric("revenue")), percentage: true, formula: "Cash flow after capex / revenue" },
  ] : [];

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
      <p className="muted">Enter at least four annual observations from the same reporting basis and currency. The model shrinks historical revenue growth toward an explicit prior, simulates future growth and post-capex cash-flow margins, then applies a downside shock. These are conditional business scenarios—not stock-return forecasts.</p>
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
          <article><span>At least one negative post-capex cash flow year</span><strong>{pct(quantResult.base_case_probabilities.at_least_one_forecast_year_fcf_negative)}</strong></article>
          <article><span>Terminal revenue below starting level</span><strong>{pct(quantResult.base_case_probabilities.terminal_revenue_below_starting_revenue)}</strong></article>
          <article><span>Cumulative post-capex cash flow negative</span><strong>{pct(quantResult.base_case_probabilities.cumulative_fcf_negative)}</strong></article>
          <article><span>Revenue CAGR meets {pct(quantResult.growth_hurdle)} hurdle</span><strong>{pct(quantResult.base_case_probabilities.revenue_cagr_meets_hurdle)}</strong></article>
          <article><span>Stress: any negative post-capex cash flow year</span><strong>{pct(quantResult.stress_case.probability_any_year_fcf_negative)}</strong></article>
        </div>
        <div className="distribution-grid">
          <article><h4>Terminal revenue</h4><div><span>P10</span><b>{number(quantResult.terminal_revenue.p10)}</b></div><div><span>Median</span><b>{number(quantResult.terminal_revenue.median)}</b></div><div><span>P90</span><b>{number(quantResult.terminal_revenue.p90)}</b></div></article>
          <article><h4>Cumulative cash flow after capex</h4><div><span>P10</span><b>{number(quantResult.cumulative_fcf.p10)}</b></div><div><span>Median</span><b>{number(quantResult.cumulative_fcf.median)}</b></div><div><span>P90</span><b>{number(quantResult.cumulative_fcf.p90)}</b></div></article>
          <article><h4>Bayesian growth posterior</h4><div><span>Mean</span><b>{pct(quantResult.posterior_revenue_growth.mean)}</b></div><div><span>Std. deviation</span><b>{pct(quantResult.posterior_revenue_growth.std_dev)}</b></div><div><span>Prior mean</span><b>{pct(quantResult.posterior_revenue_growth.prior_mean)}</b></div></article>
        </div>
        <div className="histogram-grid">
          {([
            ["Terminal revenue simulation", quantResult.distribution_histograms.terminal_revenue],
            ["Cumulative cash flow after capex simulation", quantResult.distribution_histograms.cumulative_fcf],
          ] as const).map(([title,bins]) => {
            const maxCount = Math.max(...bins.map(bin=>bin.count),1);
            return <article key={title}><h4>{title}</h4><svg viewBox="0 0 560 150" role="img" aria-label={title + " histogram"} preserveAspectRatio="none">
              {bins.map((bin,index)=><rect key={index} x={index*40+3} y={132-(bin.count/maxCount)*112} width="34" height={(bin.count/maxCount)*112} rx="2" />)}
              <line x1="0" y1="133" x2="560" y2="133" stroke="#42566e" strokeWidth="1"/>
            </svg><div className="histogram-range"><span>{number(bins[0]?.lower ?? 0)}</span><span>{number(bins[bins.length-1]?.upper ?? 0)}</span></div></article>;
          })}
        </div>
        <div className="risk-stats">
          <article><span>Mean terminal revenue</span><strong>{number(quantResult.risk_statistics.terminal_revenue_mean)}</strong></article>
          <article><span>Terminal revenue volatility (σ)</span><strong>{number(quantResult.risk_statistics.terminal_revenue_std_dev)}</strong></article>
          <article><span>Mean cumulative FCF</span><strong>{number(quantResult.risk_statistics.cumulative_fcf_mean)}</strong></article>
          <article><span>Average worst-decile cash flow after capex</span><strong>{number(quantResult.risk_statistics.cumulative_fcf_lower_decile_mean)}</strong></article>
        </div>
        <p className="result-disclaimer">Amounts use the units and currency you entered. The model assumes a supplied sector prior (8% mean, 12% standard deviation) and fixed stress shocks. The hurdle is {pct(quantResult.growth_hurdle)}. Results are not calibrated market odds, intrinsic value or expected share returns.</p>
        <details><summary>Model limitations and validation requirements</summary><ul>{quantResult.limitations.map(item=><li key={item}>{item}</li>)}</ul></details>
      </div>}
    </section>

    <section className="workspace" id="intake">
      <div className="section-head"><div><div className="eyebrow">02 / SOURCE INTAKE</div><h2>Register a financial report</h2></div><span className="tag">PDF · XLSX · XLS · CSV</span></div>
      <p className="muted">Reports are stored in a private Supabase bucket. Text-based PDFs are then scanned for reviewable financial line-item candidates with page references. Figures remain unverified until you confirm the reporting column, period, currency and units. Spreadsheet extraction is not enabled yet.</p>
      <div className="document-meta">
        <label>Document type<select value={documentType} onChange={e=>setDocumentType(e.target.value)}><option value="annual_report">Annual report</option><option value="quarterly_report">Quarterly report</option><option value="financial_statement">Financial statement</option><option value="other">Other</option></select></label>
        <label>Fiscal year (optional)<input type="number" min="1900" max="2200" placeholder="e.g. 2025" value={fiscalYear} onChange={e=>setFiscalYear(e.target.value)}/></label>
        <label>Statement scope<select value={statementScope} onChange={e=>setStatementScope(e.target.value)}><option value="consolidated">Consolidated</option><option value="standalone">Standalone</option><option value="unknown">Unknown</option></select></label>
      </div>
      <label className="dropzone">
        <UploadCloud size={28}/><strong>{file ? file.name : "Choose an annual report or financial workbook"}</strong>
        <span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB selected` : "Select a file from your device · Maximum 25 MB"}</span>
        <input type="file" accept=".pdf,.xlsx,.xls,.csv" onChange={e => {setFile(e.target.files?.[0] || null);setResult(null);setAnalysis(null);setCandidateSelections({});setAnalysisError("");setError("");}}/>
      </label>
      <button className="submit" onClick={inspectFile} disabled={!file || busy}>{busy ? "Inspecting source…" : "Inspect source document"}</button>
      {error && <div className="notice error">{error}</div>}
      {result && <div className="notice success"><strong>Private source stored</strong><p>{result.message}</p><small>{result.filename} · {result.size_bytes.toLocaleString()} bytes · {result.extraction_status}</small><code>{result.sha256}</code></div>}
      {analysisError && <div className="notice error"><strong>Extraction needs attention</strong><p>{analysisError}</p></div>}
      {analysis && <div className="analysis-panel">
        <div className="result-title"><div><div className="eyebrow">DOCUMENT INTELLIGENCE</div><h3>Extracted statement candidates</h3></div><span className="tag">{analysis.candidate_count} CANDIDATES · {analysis.page_count} PAGES</span></div>
        <p className="muted">These are unverified extraction candidates, not approved financial observations. The parser does not guess the year column, currency, unit or statement scope.</p>
        {analysis.warnings.map((warning,index)=><p className="analysis-warning" key={index}>{warning}</p>)}
        {analysis.candidates.length > 0 ? <div className="candidate-table">
          <div className="candidate-row candidate-head"><span>Metric / source line</span><span>Choose value column</span><span>Page</span></div>
          {analysis.candidates.map((candidate,index)=><div className="candidate-row" key={index}>
            <span><strong>{candidate.metric_code.replace(/_/g," ")}</strong><small>{candidate.label}</small></span>
            <span className="candidate-values">{candidate.values.length > 1
              ? <select value={candidateSelections[index] ?? 0} onChange={event=>setCandidateSelections(current=>({...current,[index]:Number(event.target.value)}))}>{candidate.values.map((value,valueIndex)=><option value={valueIndex} key={valueIndex}>{value.raw}</option>)}</select>
              : candidate.values[0]?.raw ?? "—"}</span>
            <span className="candidate-source">Page {candidate.page}<small>{candidate.extraction_method === "ocr" ? "OCR · verify carefully" : "PDF text"}</small></span>
          </div>)}
        </div> : <div className="notice error">No supported financial line items could be extracted. The PDF may be scanned, low quality, or use unfamiliar labels.</div>}
        {ratioCards.length > 0 && <div className="ratio-review">
          <div className="eyebrow">PROVISIONAL ANALYSIS</div><h4>Financial health snapshot</h4>
          <p className="muted">Calculated only where a metric has one detected source row. Select the correct current-period column above. Duplicate rows and missing inputs remain unavailable rather than being guessed.</p>
          <div className="ratio-grid">{ratioCards.map(card=><article key={card.label}>
            <span>{card.label}</span><strong>{card.label === "Cash flow after capex" ? (card.value === null ? "—" : number(card.value)) : ratioText(card.value,card.percentage)}</strong><small>{card.formula}</small>
          </article>)}</div>
          <p className="result-disclaimer">This snapshot is not yet saved as validated financial observations. Confirm the reporting period, scope and unit before relying on it. Cash conversion, margins and balance-sheet ratios require consistent statement units.</p>
        </div>}
      </div>}
      {documentError && <div className="notice error">{documentError}</div>}
      <div className="history-heading"><strong>Your private source library</strong><span>{documents.length} stored document(s)</span></div>
      {documents.length === 0 ? <p className="muted">No reports stored yet. Upload a company filing to begin your source register.</p> : <div className="document-list">{documents.map(document=><article className="document-item" key={document.id}><div><strong>{document.original_filename}</strong><span>{document.document_type.replace(/_/g," ")} · {document.fiscal_year ?? "Year not set"} · {document.statement_scope} · {(document.size_bytes/1024/1024).toFixed(2)} MB</span><small className="document-status">Extraction: {document.extraction_status || "pending"}</small></div><div className="document-actions"><button className="secondary" disabled={analyzingId === document.id} onClick={()=>analyzeStoredDocument(document)}>{analyzingId === document.id ? "Analyzing…" : "Analyze report"}</button><button className="secondary" onClick={()=>downloadDocument(document)}><FileText size={14}/> Download</button></div></article>)}</div>}
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
