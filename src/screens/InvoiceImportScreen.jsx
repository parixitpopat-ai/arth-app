// Invoice import — PHASE 1 PREVIEW ONLY. Reads a Blinkit tax invoice PDF on this device, shows what is printed, flags what needs checking and suggests
// possible matching expenses. Nothing is saved, linked or created; the PDF is not stored. (See docs/engineering/INVOICE-IMPORT-001-discovery-and-decisions.md.)
import { useRef, useState } from "react";
import { buildInvoicePreviews, describeNextStep, diagnosticEntry, validatePaymentDate } from "../domain/invoices/invoicePreview.js";

const money = (n, sym = "₹") => (n == null ? "—" : `${sym}${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 3 }).replace(/(\.\d\d)0$/, "$1")}`);

export default function InvoiceImportScreen({ accounts = [], txns = [], T, sym = "₹", onBack, onAddByHand }) {
  const fileRef = useRef(null);
  const [state, setState] = useState({ phase: "idle" });
  const [payDates, setPayDates] = useState({});
  const [picked, setPicked] = useState({});
  const [seen, setSeen] = useState([]);                                   // invoice keys looked at in THIS session (memory only)
  const lastRef = useRef(null);                                           // the last analysis, kept in memory so a changed payment date can re-run the matching without re-reading the file

  const card = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, marginBottom: 12 };
  const label = { color: T.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 };
  const btn = (primary, disabled) => ({ border: primary ? "0" : `1px solid ${T.border}`, background: primary ? T.accent : "none", color: primary ? "#fff" : T.text, borderRadius: 12, padding: "11px 14px", fontWeight: 800, fontSize: 13, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1 });
  const banner = (tone, children, tid) => (
    <div data-testid={tid} style={{ background: tone === "amb" ? "rgba(240,165,0,0.16)" : tone === "info" ? "rgba(6,182,212,0.16)" : T.accentSoft, color: T.text, borderRadius: 12, padding: "10px 12px", fontSize: 12, marginBottom: 10 }}>{children}</div>
  );

  const compute = (analysis, dates, fileName) => {
    const previews = buildInvoicePreviews(analysis, { transactions: txns, accounts, paymentDates: dates });
    return { phase: "result", previews, diag: diagnosticEntry(analysis, analysis.__bytes || 0), fileName };
  };

  const onFile = async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    setState({ phase: "reading" }); setPayDates({}); setPicked({});
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const [{ analyseBlinkitPdf }, { default: workerSrc }] = await Promise.all([import("../domain/invoices/blinkitPdf.js"), import("../domain/invoices/pdfWorkerUrl.js")]);
      const analysis = await analyseBlinkitPdf(bytes, { workerSrc }); analysis.__bytes = bytes.length;
      lastRef.current = { analysis, fileName: f.name };
      const next = compute(analysis, {}, f.name);
      next.seenKeys = seen;                                              // keys looked at BEFORE this reading
      setState(next);
      const keys = next.previews.invoices.map(i => i.view && i.view.importKey).filter(Boolean);
      setSeen(prev => [...new Set([...prev, ...keys])]);
    } catch { setState({ phase: "result", previews: { status: "unreadable", outcome: { tone: "amb", title: "Couldn't open this file", message: "Something went wrong while reading it. Choose the file again.", actions: [{ id: "choose-another", label: "Choose another file" }] }, invoices: [], notes: [] }, diag: { status: "unreadable", pages: 0, pageStatuses: [], codes: ["read-failed"], sizeBucket: "unknown" } }); }
  };

  const reset = () => { setState({ phase: "idle" }); setPayDates({}); setPicked({}); lastRef.current = null; };
  const act = id => { if (id === "choose-another") fileRef.current && fileRef.current.click(); else if (id === "add-by-hand") onAddByHand && onAddByHand(); else reset(); };
  const setPayDate = (page, v) => {
    const next = { ...payDates, [page]: v }; setPayDates(next);
    if (lastRef.current && validatePaymentDate(v).ok) setState(prev => ({ ...compute(lastRef.current.analysis, next, lastRef.current.fileName), seenKeys: prev.seenKeys }));
  };

  const outcomeCard = (o, key, extra) => o && (
    <div key={key} data-testid="invoice-error" data-status={extra && extra.status} style={{ ...card, borderColor: o.tone === "amb" ? "#f0a500" : T.border }}>
      <div style={{ color: T.text, fontSize: 14, fontWeight: 800, marginBottom: 4 }}>{o.title}</div>
      <div style={{ color: T.sub, fontSize: 12, marginBottom: 10 }}>{o.message}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{o.actions.map(a => <button key={a.id} data-testid={`action-${a.id}`} onClick={() => act(a.id)} style={btn(a.id === "choose-another")}>{a.label}</button>)}</div>
    </div>
  );

  const field = (id, name, value, opts = {}) => (
    <div data-testid={`field-${id}`} style={{ borderBottom: `1px solid ${T.border}`, padding: "8px 0" }}>
      <div style={label}>{name}</div>
      <div style={{ color: value ? T.text : T.sub, fontSize: 14, fontFamily: opts.mono ? "'IBM Plex Mono', monospace" : "inherit", overflowWrap: "anywhere" }}>{value || "Not on the invoice"}</div>
      {opts.note && <div style={{ color: T.sub, fontSize: 11, marginTop: 2 }}>{opts.note}</div>}
    </div>
  );

  const invoiceCard = (inv, idx, total) => {
    const v = inv.view, key = `p${inv.page}`, sel = picked[key], chosen = inv.matches.find(m => m.id === sel) || null, typed = payDates[inv.page] ?? inv.paymentDate, dateCheck = validatePaymentDate(typed);
    return (
      <div key={key} data-testid="invoice-card" data-status={inv.status} style={{ marginBottom: 16 }}>
        {total > 1 && <div style={{ color: T.sub, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Invoice {idx + 1} of {total}</div>}
        {inv.status === "needs-review" && banner("amb", <><b>Check this before relying on it.</b> Shown exactly as printed; nothing is corrected.<ul style={{ margin: "6px 0 0 16px", padding: 0 }}>{inv.reasons.map(r => <li key={r}>{r}</li>)}</ul></>, "review-banner")}
        {inv.duplicate.status !== "new" && banner("info", <>{inv.duplicate.status === "no-key" ? <b>Can't check for duplicates. </b> : <b>Possible duplicate. </b>}{inv.duplicate.why}</>, "duplicate-banner")}
        {v.importKey && (state.seenKeys || []).includes(v.importKey) && banner("info", "You already looked at this invoice earlier in this session. Nothing has been imported.", "seen-banner")}
        <div style={card}>
          {field("merchant", "Seller", v.merchant, { note: v.merchantFormerly ? `formerly ${v.merchantFormerly}` : "" })}
          {field("invoice-date", "Invoice date", v.invoiceDate, { note: v.invoiceDate ? "As printed. The invoice has no time, so none is shown." : (v.invoiceDateAsPrinted ? `Printed as "${v.invoiceDateAsPrinted}"; day and month order is not guessed.` : "") })}
          {field("order-id", "Order ID", v.orderId, { mono: true })}
          {field("invoice-number", "Invoice number", v.invoiceNumber, { mono: true })}
          {field("seller-gstin", "Seller GSTIN", v.sellerGstin, { mono: true })}
          {field("place", "Place of supply", v.placeOfSupply)}
          {field("payment", "Paid with", null, { note: v.paymentMethod.note })}
          <div style={{ paddingTop: 10 }}>
            <div style={label}>Payment date</div>
            <input data-testid="payment-date" type="date" value={typed || ""} onChange={e => setPayDate(inv.page, e.target.value)} style={{ padding: 8, borderRadius: 10, border: `1px solid ${dateCheck.ok ? T.border : "#f0a500"}`, background: T.card, color: T.text, fontSize: 14 }} />
            {!dateCheck.ok && <div data-testid="payment-date-error" style={{ color: "#f0a500", fontSize: 11, marginTop: 4 }}>{dateCheck.error}</div>}
            <div style={{ color: T.sub, fontSize: 11, marginTop: 4 }}>Starts as the invoice date. Change it to the day you paid. Used only to look for matching expenses; nothing is saved.</div>
          </div>
        </div>

        <div style={label}>Items ({v.items.length})</div>
        {v.items.map(i => (
          <div key={i.srNo} data-testid="item-row" style={{ ...card, marginBottom: 8, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div style={{ color: T.text, fontSize: 13, fontWeight: 700, overflowWrap: "anywhere" }}>{i.name}</div>
              <div data-testid="item-total" style={{ color: T.text, fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", fontFamily: "'IBM Plex Mono', monospace" }}>{money(i.lineTotal, sym)}</div>
            </div>
            <div style={{ color: T.sub, fontSize: 11, marginTop: 4 }}>{i.qty} × MRP {money(i.mrp, sym)}{i.discount > 0 ? ` · discount ${money(i.discount, sym)} is already inside the line total` : ""}</div>
            {i.qty > 1 && <div style={{ color: T.sub, fontSize: 11 }}>≈ {money(i.perUnitAfterDiscount, sym)} each after discount (calculated, not printed)</div>}
            <div style={{ color: T.sub, fontSize: 11 }}>Taxable {money(i.taxable, sym)} · CGST {i.cgstRate}% {money(i.cgst, sym)} · SGST {i.sgstRate}% {money(i.sgst, sym)}</div>
            <div style={{ color: T.sub, fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}>UPC {i.upc} · HSN {i.hsn} · Uncategorised</div>
          </div>
        ))}
        {v.handling && (
          <div data-testid="handling-charge" data-verified={String(v.handling.verified)} style={{ ...card, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><div style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{v.handling.label}</div><div style={{ color: T.text, fontSize: 13, fontWeight: 800, fontFamily: "'IBM Plex Mono', monospace" }}>{money(v.handling.total, sym)}</div></div>
            {v.handling.consolidated && <div style={{ color: T.sub, fontSize: 11, marginTop: 4 }}>Taxable {money(v.handling.taxable, sym)} · CGST {money(v.handling.cgst, sym)} · SGST {money(v.handling.sgst, sym)}</div>}
            <div style={{ color: T.sub, fontSize: 11, marginTop: 4 }}>{v.handling.note}</div>
            <details style={{ marginTop: 6 }}><summary style={{ color: T.accent, fontSize: 11, cursor: "pointer" }}>Printed rows ({v.handling.sourceRows.length})</summary>
              {v.handling.sourceRows.map((r, n) => <div key={n} data-testid="handling-source-row" style={{ color: T.sub, fontSize: 11, marginTop: 4 }}>Under item {r.afterItem}: taxable {money(r.taxable, sym)} + CGST {money(r.cgst, sym)} + SGST {money(r.sgst, sym)} = {money(r.total, sym)}</div>)}
            </details>
          </div>
        )}
        {v.totals && (
          <div style={card}>
            <div style={{ color: T.sub, fontSize: 12 }}>Taxable {money(v.totals.taxable, sym)} · CGST {money(v.totals.cgst, sym)} · SGST {money(v.totals.sgst, sym)}</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}><div style={{ color: T.text, fontSize: 15, fontWeight: 800 }}>Invoice total</div><div data-testid="invoice-total" style={{ color: T.text, fontSize: 17, fontWeight: 800, fontFamily: "'IBM Plex Mono', monospace" }}>{money(v.totals.invoiceTotal, sym)}</div></div>
            <div data-testid="reconciliation" data-level={v.reconciliation.level} style={{ color: v.reconciliation.level === "does-not-add-up" ? "#f0a500" : T.sub, fontSize: 12, marginTop: 6 }}>
              {v.reconciliation.level === "adds-up" ? "Items, charge and taxes add up to the invoice total." : v.reconciliation.level === "adds-up-with-printed-rounding" ? "Adds up to the invoice total. The invoice has ₹0.01 rounding differences of its own, kept as printed." : "Does not add up. Values are shown exactly as printed; nothing was corrected."}
            </div>
            {v.reconciliation.issues.length > 0 && <details style={{ marginTop: 4 }}><summary style={{ color: T.accent, fontSize: 11, cursor: "pointer" }}>What was flagged ({v.reconciliation.issues.length})</summary>{v.reconciliation.issues.map((x, n) => <div key={n} style={{ color: T.sub, fontSize: 11, marginTop: 3 }}>{x.level === "error" ? "Check: " : "Note: "}{x.message}</div>)}</details>}
          </div>
        )}
        {banner("mute", v.split.message, "split-note")}

        <div style={label}>Might already be in Arth</div>
        <div style={{ color: T.sub, fontSize: 11, marginBottom: 6 }}>Suggestions only. Arth never links anything on its own, and a match does not need the exact amount.</div>
        <div data-testid="match-rules-note" style={{ color: "#f0a500", fontSize: 11, marginBottom: 6 }}>Early matching rules, not yet verified on real data: an expense within 3 days; a similar amount means within ₹25 or 5%, and the expense must mention Blinkit.</div>
        {inv.matches.length === 0 && <div data-testid="no-matches" style={{ ...card, color: T.sub, fontSize: 12 }}>No expense within 3 days looks like this invoice.</div>}
        {inv.matches.map(m => (
          <button key={m.id} data-testid="match-row" data-id={m.id} data-strength={m.strength} data-selected={String(sel === m.id)} onClick={() => setPicked({ ...picked, [key]: sel === m.id ? null : m.id })} style={{ ...card, display: "block", width: "100%", textAlign: "left", cursor: "pointer", border: `2px solid ${sel === m.id ? T.accent : T.border}`, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>{m.label} · {money(m.amount, sym)}</span><span style={{ color: T.sub, fontSize: 11 }}>{m.strength === "same-amount" ? "Same amount" : "Similar amount"}</span></div>
            <div style={{ color: T.sub, fontSize: 11, marginTop: 2 }}>{m.date}{m.account ? ` · ${m.account}` : ""}</div>
            {m.reasons.map(r => <div key={r} style={{ color: T.sub, fontSize: 11 }}>• {r}</div>)}
          </button>
        ))}
        {inv.hints.map(h => <div key={h.id} data-testid="match-hint" style={{ color: T.sub, fontSize: 11, marginBottom: 6 }}>Note: {h.label} on {h.date} is {money(h.amount, sym)}. {h.message}</div>)}
        <div data-testid="next-step" style={{ ...card, background: T.accentSoft }}>
          <div style={{ color: T.text, fontSize: 12 }}>{describeNextStep(v, chosen)}</div>
          <button disabled data-testid="save-disabled" style={{ ...btn(true, true), marginTop: 8, width: "100%" }}>Saving arrives in a later update</button>
        </div>
      </div>
    );
  };

  const res = state.phase === "result" ? state.previews : null;
  return (
    <div style={{ padding: "14px 16px 24px" }} data-testid="invoice-import">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} aria-label="Back" style={{ background: "none", border: "none", color: T.accent, cursor: "pointer", fontSize: 22, padding: 0 }}>←</button>
        <div style={{ color: T.text, fontSize: 18, fontWeight: 900, flex: 1 }}>Import invoice</div>
      </div>
      {banner("mute", <><b>Preview only. Nothing is saved.</b> No expense is created or changed, and the PDF is not stored.</>, "import-preview-banner")}
      <div style={card}>
        <div style={label}>Platform</div>
        <div style={{ display: "flex", gap: 8 }}>
          <span data-testid="platform-blinkit" style={{ ...btn(true), padding: "8px 12px" }}>Blinkit</span>
          <span style={{ ...btn(false, true), padding: "8px 12px" }}>Amazon · later</span>
          <span style={{ ...btn(false, true), padding: "8px 12px" }}>Flipkart · later</span>
        </div>
        <label style={{ display: "block", marginTop: 12, textAlign: "center", padding: 12, borderRadius: 12, border: `1px dashed ${T.accent}`, color: T.accent, fontWeight: 800, cursor: "pointer" }}>
          Choose invoice PDF
          <input ref={fileRef} data-testid="invoice-file" type="file" accept=".pdf,application/pdf" onChange={onFile} style={{ display: "none" }} />
        </label>
        <div style={{ color: T.sub, fontSize: 11, marginTop: 8 }}>Use the tax invoice PDF from Blinkit: one order per file, up to 10 MB. Screenshots and photos are not read. Arth reads the file on this device; it is not uploaded or stored.</div>
      </div>
      {state.phase === "reading" && <div style={card} data-testid="invoice-reading"><div style={{ color: T.sub, fontSize: 13 }}>Reading the invoice on this device…</div></div>}
      {res && res.outcome && outcomeCard(res.outcome, "top", { status: res.status })}
      {res && res.notes.map(n => <div key={n}>{banner("info", n, "multi-page-note")}</div>)}
      {res && res.invoices.map((inv, i) => inv.view ? invoiceCard(inv, i, res.invoices.length) : outcomeCard(inv.outcome, `o${i}`, { status: inv.status }))}
      {res && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button data-testid="try-another" onClick={() => fileRef.current && fileRef.current.click()} style={btn(false)}>Try another file</button>
          <span data-testid="diag-code" style={{ color: T.sub, fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}>Code: {state.diag.status}{state.diag.codes.length ? ` · ${state.diag.codes.join(", ")}` : ""}</span>
        </div>
      )}
      <div data-testid="preview-footer" style={{ color: T.sub, fontSize: 11, textAlign: "center", marginTop: 16 }}>Preview only · nothing is saved</div>
    </div>
  );
}
