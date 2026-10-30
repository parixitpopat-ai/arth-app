// Invoice import. Reads a Blinkit tax invoice PDF on this device, shows what is printed, flags what needs checking, suggests possible matching expenses, and —
// only after the person reviews it and presses Confirm — adds it to Arth as ONE itemised expense (or adds its items to one same-amount expense they chose).
// The PDF is never stored. See docs/engineering/INVOICE-IMPORT-001 (decisions) and -003 (Phase 2).
import { useRef, useState } from "react";
import { buildInvoicePreviews, diagnosticEntry, validatePaymentDate } from "../domain/invoices/invoicePreview.js";
import { planConfirm, suggestLineCats, resolveItemNames } from "../domain/invoices/invoiceImport.js";
import { summariseOrders, batchCounts } from "../domain/invoices/amazonBatch.js";
import AmazonOrderPreview from "./AmazonOrderPreview.jsx";
import OrderSummaryPanel from "./OrderSummaryPanel.jsx";
import ReceiptPhotoReview from "./ReceiptPhotoReview.jsx";
import { rematch, chooseOrder, orderGate, attachmentConflicts } from "../domain/invoices/orderSummary.js";

const money = (n, sym = "₹") => (n == null ? "—" : `${sym}${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 3 }).replace(/(\.\d\d)0$/, "$1")}`);

export default function InvoiceImportScreen({ accounts = [], txns = [], cats = [], itemCatalog = [], invoiceImports = [], genId, onConfirmInvoice, onUndoInvoice, T, sym = "₹", onBack, onAddByHand, onAddReceipt }) {
  const fileRef = useRef(null);
  const [state, setState] = useState({ phase: "idle" });
  const [payDates, setPayDates] = useState({});
  const [picked, setPicked] = useState({});
  const [forms, setForms] = useState({});                                 // per invoice: mode, accountId, orderCat, lineCats, importAgain, ackNoKey
  const [outcomes, setOutcomes] = useState({});                           // per invoice: { busy, done:{record,plan,sentence}, error, undone }
  const setForm = (k, patch) => setForms(f => ({ ...f, [k]: { ...(f[k] || {}), ...patch } }));
  const setOutcome = (k, patch) => setOutcomes(o => ({ ...o, [k]: { ...(o[k] || {}), ...patch } }));
  const [amazon, setAmazon] = useState({ parsed: [], outcomes: [] });     // Amazon invoice readings (seller + item table only), memory only, cleared with the screen
  const knownRef = useRef({ files: new Set(), invoices: new Set() });    // what earlier batches in this session already read (repeats are counted once)
  const stopRef = useRef(false);
  const [summaries, setSummaries] = useState([]);                          // order summaries typed by the person: memory only, never saved
  const [seen, setSeen] = useState([]);                                   // invoice keys looked at in THIS session (memory only)
  const lastRef = useRef(null);                                           // the last analysis, kept in memory so a changed payment date can re-run the matching without re-reading the file

  const card = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, marginBottom: 12 };
  const label = { color: T.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 };
  const btn = (primary, disabled) => ({ border: primary ? "0" : `1px solid ${T.border}`, background: primary ? T.accent : "none", color: primary ? "#fff" : T.text, borderRadius: 12, padding: "11px 14px", fontWeight: 800, fontSize: 13, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1 });
  const banner = (tone, children, tid) => (
    <div data-testid={tid} style={{ background: tone === "amb" ? "rgba(240,165,0,0.16)" : tone === "info" ? "rgba(6,182,212,0.16)" : T.accentSoft, color: T.text, borderRadius: 12, padding: "10px 12px", fontSize: 12, marginBottom: 10 }}>{children}</div>
  );

  const compute = (analysis, dates, fileName) => {
    const previews = buildInvoicePreviews(analysis, { transactions: txns, accounts, paymentDates: dates, existingKeys: invoiceImports.map(r => r.key).filter(Boolean) });
    return { phase: "result", previews, diag: diagnosticEntry(analysis, analysis.__bytes || 0), fileName, fileHash: analysis.fileHash || null };
  };

  // Several PDFs (any mix of Amazon invoices, merged PDFs) are read one after another in memory, with progress and a per-file result.
  const readBatch = async picked => {
    stopRef.current = false;
    setState({ phase: "reading", progress: { done: 0, total: picked.length } });
    const [{ readInvoiceBatch }, { default: workerSrc }] = await Promise.all([import("../domain/invoices/amazonBatch.js"), import("../domain/invoices/pdfWorkerUrl.js")]);
    const r = await readInvoiceBatch(picked, { workerSrc, known: knownRef.current, shouldStop: () => stopRef.current,
      readFile: async f => new Uint8Array(await f.arrayBuffer()), onProgress: p => setState(prev => (prev.phase === "reading" ? { ...prev, progress: p } : prev)) });
    setAmazon(prev => ({ parsed: [...prev.parsed, ...r.parsed], outcomes: [...prev.outcomes, ...r.outcomes.map((o, i) => ({ ...o, index: prev.outcomes.length + i + 1 }))] }));
    setState({ phase: "amazon" });
    return r;
  };

  const onFile = async e => {
    const picked = e.target.files ? [...e.target.files] : []; e.target.value = "";
    if (!picked.length) return;
    setPayDates({}); setPicked({}); setForms({}); setOutcomes({});
    try {
      if (picked.length > 1 || state.phase === "amazon") { lastRef.current = null; await readBatch(picked); return; }
      const f = picked[0];
      setState({ phase: "reading" });
      const bytes = new Uint8Array(await f.arrayBuffer());
      const [{ analyseBlinkitPdf }, { default: workerSrc }] = await Promise.all([import("../domain/invoices/blinkitPdf.js"), import("../domain/invoices/pdfWorkerUrl.js")]);
      const analysis = await analyseBlinkitPdf(bytes, { workerSrc }); analysis.__bytes = bytes.length;
      if (!analysis.pages.some(p => p.parsed)) {                                   // not a Blinkit invoice: try it as Amazon.in invoice(s)
        lastRef.current = null;
        const r = await readBatch([f]);
        if (r.parsed.length || r.outcomes.some(o => o.kind === "exact-duplicate")) return;
        setAmazon({ parsed: [], outcomes: [] });                                   // nothing Amazon-like: show the Blinkit-style explanation below
      }
      lastRef.current = { analysis, fileName: f.name };
      const next = compute(analysis, {}, f.name);
      next.seenKeys = seen;                                              // keys looked at BEFORE this reading
      setState(next);
      const keys = next.previews.invoices.map(i => i.view && i.view.importKey).filter(Boolean);
      setSeen(prev => [...new Set([...prev, ...keys])]);
    } catch { setState({ phase: "result", previews: { status: "unreadable", outcome: { tone: "amb", title: "Couldn't open this file", message: "Something went wrong while reading it. Choose the file again.", actions: [{ id: "choose-another", label: "Choose another file" }, { id: "add-by-hand", label: "Add expense by hand" }] }, invoices: [], notes: [] }, diag: { status: "unreadable", codes: [] } }); }
  };

  const reset = () => { setSummaries([]); setAmazon({ parsed: [], outcomes: [] }); knownRef.current = { files: new Set(), invoices: new Set() }; stopRef.current = true; setState({ phase: "idle" }); setPayDates({}); setPicked({}); setForms({}); setOutcomes({}); lastRef.current = null; };
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
    const f = forms[key] || {}, oc = outcomes[key] || {}, defaultCat = (cats.find(c => c.id === "groceries") || {}).id || "";
    const orderCat = f.orderCat === undefined ? defaultCat : f.orderCat, mode = f.mode === "link" && chosen && chosen.strength === "same-amount" ? "link" : "create";
    const lineCats = Object.fromEntries(Object.entries(f.lineCats || {}).filter(([, val]) => val !== "__order").map(([k, val]) => [k, val || null]));   // "" = left uncategorised on purpose
    const sameAmount = inv.matches.find(m => m.strength === "same-amount");
    // What each item is called on the expense (brand removed; the brand is kept in the background) and which brand it is. The person can correct either.
    const names = resolveItemNames(v, invoiceImports, { itemNames: f.itemNames || {}, itemBrands: f.itemBrands || {}, stripBrands: f.stripBrands !== false });
    const suggested = suggestLineCats(v, itemCatalog, cats.map(c => c.id), names);            // what Arth already remembers for these item names
    const plan = planConfirm({ view: v, status: inv.status, mode, accountId: f.accountId, paymentDate: typed, orderCatId: orderCat || null, lineCats, suggestedCats: suggested, itemNames: f.itemNames || {}, itemBrands: f.itemBrands || {}, stripBrands: f.stripBrands !== false, rememberCats: f.remember !== false, linkTxnId: mode === "link" ? chosen.id : undefined, fileHash: state.fileHash },
      { accounts, txns, records: invoiceImports, catalog: itemCatalog, genId, acknowledgeNoKey: !!f.ackNoKey, importAgain: !!f.importAgain });
    const selStyle = { width: "100%", padding: 9, borderRadius: 10, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 13 };
    const confirm = async () => {
      if (!plan.ok || oc.busy) return;
      setOutcome(key, { busy: true, error: null });
      const r = await onConfirmInvoice(plan);
      if (r && r.ok) setOutcome(key, { busy: false, done: { record: plan.record, plan, sentence: plan.sentence }, undone: false });
      else setOutcome(key, { busy: false, error: (r && r.error) || "Couldn't add this invoice." });
    };
    const undo = () => { const r = onUndoInvoice(oc.done.record, oc.done.plan); setOutcome(key, r.ok ? { undone: true, done: null, undoError: null } : { undoError: r.reason }); };
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
              <div data-testid={`item-label-${i.srNo}`} style={{ color: T.text, fontSize: 13, fontWeight: 700, overflowWrap: "anywhere" }}>{names[i.srNo].label}</div>
              <div data-testid="item-total" style={{ color: T.text, fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", fontFamily: "'IBM Plex Mono', monospace" }}>{money(i.lineTotal, sym)}</div>
            </div>
            <div style={{ color: T.sub, fontSize: 11, marginTop: 4 }}>{i.qty} × MRP {money(i.mrp, sym)}{i.discount > 0 ? ` · discount ${money(i.discount, sym)} is already inside the line total` : ""}</div>
            {i.qty > 1 && <div style={{ color: T.sub, fontSize: 11 }}>≈ {money(i.perUnitAfterDiscount, sym)} each after discount (calculated, not printed)</div>}
            <div style={{ color: T.sub, fontSize: 11 }}>Taxable {money(i.taxable, sym)} · CGST {i.cgstRate}% {money(i.cgst, sym)} · SGST {i.sgstRate}% {money(i.sgst, sym)}</div>
            <div style={{ color: T.sub, fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}>UPC {i.upc} · HSN {i.hsn}</div>
            {mode === "create" && !oc.done && (
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <input data-testid={`item-name-${i.srNo}`} aria-label={`Name on the expense for ${i.name}`} value={names[i.srNo].label} onChange={e => setForm(key, { itemNames: { ...(f.itemNames || {}), [i.srNo]: e.target.value } })} style={{ ...selStyle, flex: 2, fontSize: 12, padding: 6 }} />
                <input data-testid={`item-brand-${i.srNo}`} aria-label={`Brand of ${i.name}`} placeholder="Brand" value={names[i.srNo].brand || ""} onChange={e => setForm(key, { itemBrands: { ...(f.itemBrands || {}), [i.srNo]: e.target.value } })} style={{ ...selStyle, flex: 1, fontSize: 12, padding: 6 }} />
              </div>
            )}
            {names[i.srNo].brand && names[i.srNo].label !== names[i.srNo].full && <div data-testid={`brand-note-${i.srNo}`} style={{ color: T.sub, fontSize: 10, marginTop: 2 }}>Brand {names[i.srNo].brand} is kept in the background for comparing brands; the expense shows the plain name.</div>}
            {mode === "create" && !oc.done && (
              <select data-testid={`line-cat-${i.srNo}`} aria-label={`Category for ${i.name}`} value={(f.lineCats || {})[i.srNo] === undefined ? (suggested[i.srNo] || "__order") : (f.lineCats || {})[i.srNo]} onChange={e => setForm(key, { lineCats: { ...(f.lineCats || {}), [i.srNo]: e.target.value } })} style={{ ...selStyle, marginTop: 6, fontSize: 12, padding: 6 }}>
                <option value="__order">Category: same as the order</option>
                <option value="">Leave uncategorised</option>
                {cats.map(c => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>)}
              </select>
            )}
            {mode === "create" && !oc.done && suggested[i.srNo] && (f.lineCats || {})[i.srNo] === undefined && <div data-testid={`remembered-${i.srNo}`} style={{ color: T.accent, fontSize: 10, marginTop: 2 }}>Remembered for this item from your earlier entries</div>}
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
        {/* ---- Add to Arth: nothing below writes anything until Confirm ---- */}
        <div style={label}>Add to Arth</div>
        {oc.done ? (
          <div data-testid="import-done" style={{ ...card, borderColor: "#22c55e" }}>
            <div style={{ color: T.text, fontSize: 14, fontWeight: 800 }}>Added to Arth</div>
            <div data-testid="import-done-sentence" style={{ color: T.sub, fontSize: 12, margin: "4px 0 10px" }}>{oc.done.sentence}</div>
            <button data-testid="undo-import" onClick={undo} style={btn(false)}>Undo</button>
            {oc.undoError && <div data-testid="undo-error" style={{ color: "#f0a500", fontSize: 11, marginTop: 6 }}>{oc.undoError}</div>}
          </div>
        ) : (
          <div data-testid="add-to-arth" style={card}>
            {oc.undone && <div data-testid="undone-note" style={{ color: T.sub, fontSize: 12, marginBottom: 8 }}>Undone. Nothing from this invoice is in Arth.</div>}
            {sameAmount && mode === "create" && <div data-testid="double-count-warning" style={{ color: "#f0a500", fontSize: 12, marginBottom: 8 }}>You already have a {money(sameAmount.amount, sym)} expense that looks like this invoice ({sameAmount.date}). Adding it as a new expense would count the spend twice. Select it above to add the items to it instead.</div>}
            {chosen && chosen.strength === "same-amount" && (
              <label style={{ display: "flex", gap: 8, alignItems: "center", color: T.text, fontSize: 13, marginBottom: 8 }}>
                <input data-testid="mode-link" type="checkbox" checked={mode === "link"} onChange={e => setForm(key, { mode: e.target.checked ? "link" : "create" })} />
                Add the items to the selected {money(chosen.amount, sym)} expense instead of creating a new one
              </label>
            )}
            {chosen && chosen.strength === "similar" && <div style={{ color: T.sub, fontSize: 11, marginBottom: 8 }}>A similar-amount expense can't be linked yet (the amounts differ). You can add this invoice as a new expense, or edit that expense yourself.</div>}
            {mode === "create" && (<>
              <div style={label}>Paid from (required)</div>
              <select data-testid="confirm-account" value={f.accountId || ""} onChange={e => setForm(key, { accountId: e.target.value })} style={selStyle}>
                <option value="">Choose the account you paid from</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <div style={{ color: T.sub, fontSize: 11, margin: "4px 0 8px" }}>The invoice doesn't say how it was paid. A credit-card purchase is added to that card; paying the card bill later is not counted again.</div>
              <div style={label}>Category for the order</div>
              <select data-testid="confirm-category" value={orderCat} onChange={e => setForm(key, { orderCat: e.target.value })} style={selStyle}>
                <option value="">Leave uncategorised</option>
                {cats.map(c => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>)}
              </select>
            </>)}
            {plan.errors.some(e => e.code === "no-key") && <label style={{ display: "flex", gap: 8, color: T.text, fontSize: 12, marginTop: 8 }}><input data-testid="ack-no-key" type="checkbox" checked={!!f.ackNoKey} onChange={e => setForm(key, { ackNoKey: e.target.checked })} />I understand duplicates cannot be checked for this invoice</label>}
            {plan.errors.some(e => e.code === "orphan") && <label style={{ display: "flex", gap: 8, color: T.text, fontSize: 12, marginTop: 8 }}><input data-testid="import-again" type="checkbox" checked={!!f.importAgain} onChange={e => setForm(key, { importAgain: e.target.checked })} />Add it again (the earlier expense no longer exists)</label>}
            {mode === "create" && <label style={{ display: "flex", gap: 8, alignItems: "center", color: T.text, fontSize: 12, marginTop: 8 }}><input data-testid="remember-cats" type="checkbox" checked={f.remember !== false} onChange={e => setForm(key, { remember: e.target.checked })} />Remember these item categories for next time</label>}
            {mode === "create" && <label style={{ display: "flex", gap: 8, alignItems: "center", color: T.text, fontSize: 12, marginTop: 8 }}><input data-testid="strip-brands" type="checkbox" checked={f.stripBrands !== false} onChange={e => setForm(key, { stripBrands: e.target.checked })} />Show item names without the brand (the brand is still kept in the background)</label>}
            {plan.ok && plan.uncategorised > 0 && <div data-testid="uncategorised-note" style={{ color: "#f0a500", fontSize: 11, marginTop: 8 }}>{plan.uncategorised} line{plan.uncategorised === 1 ? " has" : "s have"} no category. Arth's edit screen will ask for it the next time you edit this expense.</div>}
            <div data-testid="review-sentence" style={{ background: T.accentSoft, borderRadius: 10, padding: "8px 10px", color: T.text, fontSize: 12, marginTop: 10 }}>
              {plan.ok ? <>Arth will: {plan.sentence}</> : <>Not ready: {plan.errors.map(e => e.message).join(" ")}</>}
            </div>
            {oc.error && <div data-testid="import-error" style={{ color: "#f0a500", fontSize: 12, marginTop: 8 }}>{oc.error}</div>}
            <button data-testid="confirm-import" disabled={!plan.ok || oc.busy} onClick={confirm} style={{ ...btn(true, !plan.ok || oc.busy), marginTop: 10, width: "100%" }}>{oc.busy ? "Adding…" : mode === "link" ? "Confirm: add the items" : "Confirm: add this expense"}</button>
          </div>
        )}
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
      {banner("mute", <><b>Review first. Nothing is added until you press Confirm.</b> Reading the PDF creates or changes nothing, and the PDF itself is never stored.</>, "import-preview-banner")}
      <div style={card}>
        <div style={label}>Platform</div>
        <div style={{ display: "flex", gap: 8 }}>
          <span data-testid="platform-blinkit" style={{ ...btn(true), padding: "8px 12px" }}>Blinkit</span>
          <span data-testid="platform-amazon" style={{ ...btn(state.phase === "amazon"), padding: "8px 12px" }}>Amazon · preview</span>
          <span style={{ ...btn(false, true), padding: "8px 12px" }}>Flipkart · later</span>
        </div>
        <label style={{ display: "block", marginTop: 12, textAlign: "center", padding: 12, borderRadius: 12, border: `1px dashed ${T.accent}`, color: T.accent, fontWeight: 800, cursor: "pointer" }}>
          Choose invoice PDF
          <input ref={fileRef} data-testid="invoice-file" type="file" multiple accept=".pdf,application/pdf" onChange={onFile} style={{ display: "none" }} />
        </label>
        <div style={{ color: T.sub, fontSize: 11, marginTop: 8 }}>Use the tax invoice PDF from Blinkit or Amazon.in: one invoice per page; several files can be chosen together, up to 10 MB. Screenshots and photos are not read. Arth reads the file on this device; it is not uploaded or stored.</div>
      </div>
      <ReceiptPhotoReview T={T} sym={sym} card={card} label={label} onUse={prefill => onAddReceipt && onAddReceipt(prefill)} />
      {state.phase === "amazon" && (() => {
        const orders = summariseOrders(amazon.parsed);
        const live = summaries.map(x => ({ ...x, match: rematch(x.match, x.orderNumber, orders) }));            // unresolved matches are re-evaluated as invoices are added
        const conflicts = attachmentConflicts(live);
        const withViews = orders.map(o => { const sm = live.find(x => x.match.orderNumber === o.orderNumber && !x.match.blocks); return sm ? { ...o, summaryView: { summary: sm, gate: orderGate({ summary: sm, order: o, conflicts }) } } : o; });
        const choose = (id, orderNumber) => setSummaries(prev => prev.map(x => (x.id !== id ? x : orderNumber === undefined ? { ...x, match: { state: "choose", reason: "no-number", hints: [], blocks: true } } : { ...x, match: chooseOrder(x.match, orderNumber, orders) })));
        const panel = <OrderSummaryPanel T={T} sym={sym} card={card} label={label} orders={orders} summaries={live} onAdd={sm => setSummaries(prev => [...prev, sm])} onChoose={choose} onRemove={id => setSummaries(prev => prev.filter(x => x.id !== id))} />;
        return <AmazonOrderPreview orders={withViews} counts={batchCounts(amazon.outcomes, amazon.parsed)} outcomes={amazon.outcomes} panel={panel} T={T} sym={sym} card={card} label={label} onAddAnother={() => fileRef.current && fileRef.current.click()} onClear={reset} />;
      })()}
      {state.phase === "reading" && <div style={card} data-testid="invoice-reading"><div data-testid="reading-progress" style={{ color: T.sub, fontSize: 13 }}>{state.progress && state.progress.total > 1 ? `Reading ${Math.min(state.progress.done + 1, state.progress.total)} of ${state.progress.total} on this device…` : "Reading the invoice on this device…"}</div>{state.progress && state.progress.total > 1 && <button data-testid="reading-cancel" onClick={() => { stopRef.current = true; }} style={{ ...btn(false), marginTop: 8, minHeight: 44 }}>Stop</button>}</div>}
      {res && res.outcome && outcomeCard(res.outcome, "top", { status: res.status })}
      {res && res.notes.map(n => <div key={n}>{banner("info", n, "multi-page-note")}</div>)}
      {res && res.invoices.map((inv, i) => inv.view ? invoiceCard(inv, i, res.invoices.length) : outcomeCard(inv.outcome, `o${i}`, { status: inv.status }))}
      {res && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button data-testid="try-another" onClick={() => fileRef.current && fileRef.current.click()} style={btn(false)}>Try another file</button>
          <span data-testid="diag-code" style={{ color: T.sub, fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}>Code: {state.diag.status}{state.diag.codes.length ? ` · ${state.diag.codes.join(", ")}` : ""}</span>
        </div>
      )}
      <div data-testid="preview-footer" style={{ color: T.sub, fontSize: 11, textAlign: "center", marginTop: 16 }}>Nothing is added until you press Confirm</div>
    </div>
  );
}
