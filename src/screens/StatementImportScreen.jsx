// Bank statement import. Pick the account, pick a statement file (CSV, Excel or a text PDF), review every row, tick what to add, press Import.
// Reading creates nothing. Imported rows are plain transactions (no category: they show under "Needs details"); each carries a key and a
// batch id, so the same file can be imported again safely and a whole import can be undone. Existing entries are never changed.
import { useMemo, useRef, useState } from "react";
import { withImportKeys } from "../domain/imports/statement.js";
import { matchStatement } from "../domain/imports/matchStatement.js";
import { buildImportTxns, importedKeysOf, looksLikeCardBill, findCardByText } from "../domain/imports/buildImport.js";

const fmt = (paise, sym) => `${sym}${(Math.abs(paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const niceDate = iso => { const [y, m, d] = iso.split("-"); return `${d}-${m}-${y}`; };

export default function StatementImportScreen({ accounts = [], txns = [], genId, T, sym = "₹", onImport, onUndoBatch, onBack }) {
  const fileRef = useRef(null);
  const banks = accounts.filter(a => a.type === "bank");
  const cards = accounts.filter(a => a.type === "cc");
  const [accountId, setAccountId] = useState(banks.length === 1 ? String(banks[0].id) : "");
  const [state, setState] = useState({ phase: "idle" });          // idle | reading | result | done
  const [ticked, setTicked] = useState({});                       // importKey -> bool
  const keys = useMemo(() => importedKeysOf(txns), [txns]);

  const card = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, marginBottom: 12 };
  const label = { color: T.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 };
  const btn = (primary, disabled) => ({ border: primary ? "0" : `1px solid ${T.border}`, background: primary ? T.accent : "none", color: primary ? "#fff" : T.text, borderRadius: 12, padding: "11px 14px", fontWeight: 800, fontSize: 14, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, fontFamily: "inherit" });
  const note = (tone, children, tid) => <div data-testid={tid} style={{ background: tone === "amb" ? "rgba(240,165,0,0.16)" : T.accentSoft, color: T.text, borderRadius: 12, padding: "10px 12px", fontSize: 13, marginBottom: 12, lineHeight: 1.45 }}>{children}</div>;

  const analyse = (parsed, accId) => {
    const keyed = withImportKeys(parsed.rows, accId);
    const m = matchStatement(keyed, { transactions: txns, accountId: accId, importedKeys: keys });
    const start = {}; m.results.forEach(r => { start[r.row.importKey] = r.status === "new"; });
    setTicked(start);
    return m;
  };

  const onFile = async e => {
    const file = e.target.files && e.target.files[0]; e.target.value = "";
    if (!file) return;
    if (!accountId) { setState({ phase: "idle", error: "Choose the bank account first." }); return; }
    setState({ phase: "reading", fileName: file.name });
    try {
      const [{ readStatementFile }, { default: workerSrc }] = await Promise.all([import("../domain/imports/readStatementFile.js"), import("../domain/invoices/pdfWorkerUrl.js")]);
      const parsed = await readStatementFile(new Uint8Array(await file.arrayBuffer()), { name: file.name, workerSrc });
      if (!parsed.ok) { setState({ phase: "idle", error: parsed.reason, fileName: file.name }); return; }
      setState({ phase: "result", fileName: file.name, parsed, match: analyse(parsed, accountId), accountId });
    } catch { setState({ phase: "idle", error: "This file could not be read." }); }
  };

  const chosen = state.phase === "result" ? state.match.results.filter(r => ticked[r.row.importKey] && r.status !== "already-imported") : [];
  const net = chosen.reduce((s, r) => s + r.row.amountPaise, 0);
  const doImport = () => {
    const batchId = genId();
    const made = buildImportTxns(chosen, { accountId: state.accountId, batchId, cards, newId: genId });
    onImport(made, { batchId, fileName: state.fileName });
    setState({ phase: "done", count: made.length, batchId, cardBills: made.filter(t => t.type === "cc_payment").length, unmatched: made.filter(t => t.cardBillUnmatched).length });
  };

  const batches = useMemo(() => {
    const m = new Map();
    for (const t of txns) if (t.importBatchId) { const b = m.get(t.importBatchId) || { id: t.importBatchId, n: 0, from: t.date, to: t.date, accId: t.accId || t.fromAccId }; b.n++; if (t.date < b.from) b.from = t.date; if (t.date > b.to) b.to = t.date; m.set(t.importBatchId, b); }
    return [...m.values()];
  }, [txns]);

  const p = state.parsed, bal = p && p.balance;
  return (
    <div style={{ padding: "14px 16px 24px" }} data-testid="statement-import">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} aria-label="Back" style={{ background: "none", border: "none", color: T.accent, cursor: "pointer", fontSize: 22, padding: 0 }}>←</button>
        <div style={{ color: T.text, fontSize: 18, fontWeight: 900, flex: 1 }}>Import bank statement</div>
      </div>
      {note("mute", <><b>Review first. Nothing is added until you press Import.</b> The file is read on this device and is not stored or uploaded. Rows already in Arth are skipped, and existing entries are never changed.</>, "stmt-banner")}

      {state.phase !== "done" && <div style={card}>
        <div style={label}>Bank account</div>
        {banks.length === 0 ? <div style={{ color: T.warn, fontSize: 13, fontWeight: 700 }}>Add a bank account first (Settings → Accounts).</div>
          : <select data-testid="stmt-account" value={accountId} onChange={e => { setAccountId(e.target.value); setState({ phase: "idle" }); }} style={{ width: "100%", minHeight: 44, borderRadius: 10, border: `1px solid ${T.border}`, background: T.input, color: T.text, padding: "0 10px", fontSize: 14 }}>
            <option value="">Choose the account this statement is for</option>
            {banks.map(a => <option key={a.id} value={String(a.id)}>{a.name}{a.last4 ? ` ····${a.last4}` : ""}</option>)}
          </select>}
        <div style={{ ...label, marginTop: 14 }}>Statement file</div>
        <input ref={fileRef} data-testid="stmt-file" type="file" accept=".csv,.tsv,.txt,.xlsx,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onFile} style={{ display: "none" }} />
        <button data-testid="stmt-pick" style={btn(true, !banks.length)} disabled={!banks.length} onClick={() => fileRef.current && fileRef.current.click()}>Choose CSV, Excel or PDF</button>
        {state.phase === "reading" && <div style={{ color: T.sub, fontSize: 13, marginTop: 10 }}>Reading {state.fileName}…</div>}
        {state.error && <div data-testid="stmt-error" style={{ color: T.warn, fontSize: 13, fontWeight: 700, marginTop: 10, lineHeight: 1.45 }}>{state.error}</div>}
      </div>}

      {state.phase === "result" && <>
        <div style={card} data-testid="stmt-summary">
          <div style={{ color: T.text, fontSize: 15, fontWeight: 800 }}>{state.fileName}</div>
          <div style={{ color: T.sub, fontSize: 13, marginTop: 4 }}>{p.rows.length} rows · {niceDate(p.period.from)} to {niceDate(p.period.to)}</div>
          <div style={{ color: T.sub, fontSize: 13, marginTop: 4 }}>New {state.match.summary.new} · Looks already in Arth {state.match.summary.probableMatch} · Imported before {state.match.summary.alreadyImported}{p.skipped.length ? ` · Could not read ${p.skipped.length}` : ""}</div>
          {bal.checked > 0 && bal.mismatches.length === 0 && <div data-testid="stmt-balance-ok" style={{ color: T.sub, fontSize: 12, marginTop: 6 }}>✓ The statement's running balance adds up across all {bal.checked + 1} rows.</div>}
          {bal.checked > 0 && bal.mismatches.length > 0 && note("amb", <><b>The running balance does not add up on {bal.mismatches.length} row(s).</b> A row may be missing or misread (lines {bal.mismatches.slice(0, 6).join(", ")}). Check the amounts before importing.</>, "stmt-balance-bad")}
          {bal.signsReversed && <div data-testid="stmt-reversed" style={{ color: T.sub, fontSize: 12, marginTop: 6 }}>The column headings said Debit/Credit the other way round; Arth followed the running balance (money out reduces it).</div>}
          {bal.checked === 0 && <div style={{ color: T.sub, fontSize: 12, marginTop: 6 }}>No running-balance column, so amounts could not be cross-checked. Look through the rows before importing.</div>}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button style={btn(false)} onClick={() => setTicked(Object.fromEntries(state.match.results.map(r => [r.row.importKey, r.status === "new"])))}>Only new</button>
          <button style={btn(false)} onClick={() => setTicked(Object.fromEntries(state.match.results.map(r => [r.row.importKey, r.status !== "already-imported"])))}>All</button>
          <button style={btn(false)} onClick={() => setTicked({})}>None</button>
        </div>

        <div data-testid="stmt-rows">
          {state.match.results.map(({ row, status }) => {
            const out = row.amountPaise < 0, bill = out && looksLikeCardBill(row.desc), cardHit = bill ? findCardByText(row.desc, cards) : null;
            return (
              <label key={row.importKey} data-testid="stmt-row" data-status={status} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 4px", borderBottom: `1px solid ${T.border}`, opacity: status === "already-imported" ? 0.5 : 1 }}>
                <input type="checkbox" checked={Boolean(ticked[row.importKey]) && status !== "already-imported"} disabled={status === "already-imported"} onChange={e => setTicked(t => ({ ...t, [row.importKey]: e.target.checked }))} style={{ marginTop: 3, width: 20, height: 20 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: T.text, fontSize: 13, fontWeight: 700, wordBreak: "break-word" }}>{row.desc || "(no description)"}</div>
                  <div style={{ color: T.sub, fontSize: 11, marginTop: 2 }}>{niceDate(row.date)}
                    {status === "probable-match" && " · looks like an entry already in Arth"}{status === "already-imported" && " · imported before"}
                    {bill && (cardHit ? ` · card bill payment → ${cardHit.name}` : " · looks like a card bill payment, but no card matched: it will be an expense")}</div>
                </div>
                <div style={{ color: out ? T.text : T.accent, fontSize: 14, fontWeight: 800, whiteSpace: "nowrap" }}>{out ? "−" : "+"}{fmt(row.amountPaise, sym)}</div>
              </label>
            );
          })}
        </div>
        {p.skipped.length > 0 && <div style={{ color: T.sub, fontSize: 12, marginTop: 10 }}>Rows not read ({p.skipped.length}): {p.skipped.slice(0, 5).map(s => `line ${s.line} (${s.why})`).join("; ")}{p.skipped.length > 5 ? "…" : ""}</div>}

        <div style={{ position: "sticky", bottom: 0, background: T.bg, paddingTop: 12 }}>
          {chosen.length > 0 && <div data-testid="stmt-effect" style={{ color: T.sub, fontSize: 12, marginBottom: 8, lineHeight: 1.45 }}>These rows will change this account's balance in Arth by {net < 0 ? "−" : "+"}{fmt(net, sym)}. If the account's starting balance in Arth already includes these dates, adjust it afterwards. Imported expenses have no category yet; they will appear under "Needs details".</div>}
          <button data-testid="stmt-import" style={{ ...btn(true, chosen.length === 0), width: "100%" }} disabled={chosen.length === 0} onClick={doImport}>Import {chosen.length} row{chosen.length === 1 ? "" : "s"}</button>
        </div>
      </>}

      {state.phase === "done" && <div style={card} data-testid="stmt-done">
        <div style={{ color: T.text, fontSize: 16, fontWeight: 900 }}>Imported {state.count} transaction{state.count === 1 ? "" : "s"}</div>
        {state.cardBills > 0 && <div style={{ color: T.sub, fontSize: 13, marginTop: 6 }}>{state.cardBills} card bill payment{state.cardBills === 1 ? " was" : "s were"} added as card payments, not spending.</div>}
        {state.unmatched > 0 && <div style={{ color: T.warn, fontSize: 13, marginTop: 6 }}>{state.unmatched} looked like card bill payments but no card matched; they were added as expenses. Open them and choose "Card bill payment" if so.</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button data-testid="stmt-undo" style={btn(false)} onClick={() => { onUndoBatch(state.batchId); setState({ phase: "idle" }); }}>Undo this import</button>
          <button style={btn(true)} onClick={onBack}>Done</button>
        </div>
      </div>}

      {batches.length > 0 && state.phase !== "done" && <div style={{ ...card, marginTop: 16 }} data-testid="stmt-batches">
        <div style={label}>Earlier imports</div>
        {batches.map(b => <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
          <div style={{ flex: 1, color: T.text, fontSize: 13 }}>{b.n} transaction{b.n === 1 ? "" : "s"} · {niceDate(b.from)} to {niceDate(b.to)}</div>
          <button data-testid="stmt-undo-batch" style={{ ...btn(false), padding: "6px 10px", fontSize: 12 }} onClick={() => { if (window.confirm(`Remove these ${b.n} imported transactions? Entries you added by hand are not touched.`)) onUndoBatch(b.id); }}>Undo</button>
        </div>)}
      </div>}
    </div>
  );
}
