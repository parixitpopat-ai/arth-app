// Bank statement import. Pick the account, pick a statement file (CSV, Excel or a text PDF), review every row, tick what to add, press Import.
// Reading creates nothing. Imported rows are plain transactions (no category: they show under "Needs details"); each carries a key and a
// batch id, so the same file can be imported again safely and a whole import can be undone. Existing entries are never changed.
import { useMemo, useRef, useState } from "react";
import { withImportKeys } from "../domain/imports/statement.js";
import { matchStatement } from "../domain/imports/matchStatement.js";
import { getLinkedMethodIds } from "../domain/accounts/accountBalance.js";
import { statementBalances, planBalanceMatch } from "../domain/imports/statementBalances.js";
import { buildImportTxns, importedKeysOf, looksLikeCardBill, findCardByText } from "../domain/imports/buildImport.js";

const fmt = (paise, sym) => `${sym}${(Math.abs(paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const niceDate = iso => { const [y, m, d] = iso.split("-"); return `${d}-${m}-${y}`; };

export default function StatementImportScreen({ accounts = [], txns = [], genId, T, sym = "₹", onImport, onUndoBatch, onBack, fixedAccountId = "", checkpoints = {}, onMatchBalance, onUndoBalance }) {
  const fileRef = useRef(null);
  const banks = accounts.filter(a => a.type === "bank");
  const cards = accounts.filter(a => a.type === "cc");
  const [accountId, setAccountId] = useState(fixedAccountId || (banks.length === 1 ? String(banks[0].id) : ""));
  const [state, setState] = useState({ phase: "idle" });          // idle | reading | result | done
  const [ticked, setTicked] = useState({});                       // importKey -> bool (add as a new transaction)
  const [merged, setMerged] = useState({});                       // importKey -> bool (link to the entry it looks like; adds nothing)
  const [sb, setSb] = useState(null);                         // what the last file says the balance was at its start and end
  const [balUndo, setBalUndo] = useState(null);                // set after "Match", used by its Undo
  const acctNow = accounts.find(a => String(a.id) === String(fixedAccountId || accountId));
  const isCard = Boolean(acctNow && acctNow.type === "cc");     // a credit card: a plain amount is a charge; payments/refunds are matched, not created
  const canAdd = r => r.status !== "already-imported" && !(isCard && r.row.amountPaise > 0);
  const keys = useMemo(() => importedKeysOf(txns), [txns]);

  const card = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, marginBottom: 12 };
  const label = { color: T.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 };
  const btn = (primary, disabled) => ({ border: primary ? "0" : `1px solid ${T.border}`, background: primary ? T.accent : "none", color: primary ? "#fff" : T.text, borderRadius: 12, padding: "11px 14px", fontWeight: 800, fontSize: 14, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, fontFamily: "inherit" });
  const note = (tone, children, tid) => <div data-testid={tid} style={{ background: tone === "amb" ? "rgba(240,165,0,0.16)" : T.accentSoft, color: T.text, borderRadius: 12, padding: "10px 12px", fontSize: 13, marginBottom: 12, lineHeight: 1.45 }}>{children}</div>;

  const analyse = (parsed, accId) => {
    const keyed = withImportKeys(parsed.rows, accId);
    const m = matchStatement(keyed, { transactions: txns, accountId: accId, importedKeys: keys, linkedIds: getLinkedMethodIds(accId, accounts) });
    const start = {}; m.results.forEach(r => { start[r.row.importKey] = r.status === "new" && !(isCard && r.row.amountPaise > 0); });
    setTicked(start); setMerged({});
    return m;
  };

  const onFile = async e => {
    const file = e.target.files && e.target.files[0]; e.target.value = "";
    if (!file) return;
    if (!accountId) { setState({ phase: "idle", error: "Choose the bank account first." }); return; }
    setState({ phase: "reading", fileName: file.name });
    let stage = "start";
    try {
      stage = "load the readers";
      const [{ readStatementFile }, { default: workerSrc }] = await Promise.all([import("../domain/imports/readStatementFile.js"), import("../domain/invoices/pdfWorkerUrl.js")]);
      stage = "open the file from the phone";
      const bytes = new Uint8Array(await file.arrayBuffer());
      stage = "read the statement";
      const parsed = await readStatementFile(bytes, { name: file.name, workerSrc, accountKind: isCard ? "card" : undefined });
      if (!parsed.ok) { setState({ phase: "idle", error: parsed.reason, detail: parsed.detail, fileName: file.name }); return; }
      stage = "compare with your entries";
      setSb(statementBalances(parsed)); setBalUndo(null);
      setState({ phase: "result", fileName: file.name, parsed, match: analyse(parsed, accountId), accountId });
    } catch (err) {
      // The detail names the step and the error only (no file content), so it is safe to send to whoever is fixing this.
      setState({ phase: "idle", error: "This file could not be read.", detail: `failed while trying to ${stage}: ${(err && err.name) || "error"}${err && err.message ? " — " + String(err.message).slice(0, 140) : " (no message)"}` });
    }
  };

  const chosen = state.phase === "result" ? state.match.results.filter(r => ticked[r.row.importKey] && r.status !== "already-imported") : [];
  const net = chosen.reduce((s, r) => s + r.row.amountPaise, 0);
  const txnById = id => txns.find(t => String(t.id) === String(id));
  const merges = state.phase === "result" ? state.match.results.filter(r => r.status === "probable-match" && merged[r.row.importKey] && !ticked[r.row.importKey] && txnById(r.matchId) && !txnById(r.matchId).importKey).map(r => ({ txnId: r.matchId, row: r.row })) : [];
  const doImport = () => {
    const batchId = genId();
    const made = buildImportTxns(chosen, { accountId: state.accountId, batchId, cards, newId: genId, plainExpenses: isCard });
    onImport(made, { batchId, fileName: state.fileName, merges });
    setState({ phase: "done", count: made.length, mergedCount: merges.length, batchId, cardBills: made.filter(t => t.type === "cc_payment").length, unmatched: made.filter(t => t.cardBillUnmatched).length });
  };

  const batches = useMemo(() => {
    // when opened from one account, show only that account's earlier imports
    const m = new Map();
    for (const t of txns) if (t.importBatchId && (!fixedAccountId || String(t.accId || t.fromAccId) === String(fixedAccountId))) { const b = m.get(t.importBatchId) || { id: t.importBatchId, n: 0, from: t.date, to: t.date, accId: t.accId || t.fromAccId }; b.n++; if (t.date < b.from) b.from = t.date; if (t.date > b.to) b.to = t.date; m.set(t.importBatchId, b); }
    return [...m.values()];
  }, [txns, fixedAccountId]);

  const balanceCard = () => {
    const acc = accounts.find(a => String(a.id) === String(state.accountId || accountId));
    if (!sb || !acc || !onMatchBalance) return null;
    const plan = planBalanceMatch(acc, checkpoints[acc.id] || null, sb, txns, acc.id);
    const m = v => `${sym}${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const same = plan.opening.to === plan.opening.from && plan.opening.toDate === plan.opening.fromDate && plan.current.from === plan.current.to && plan.current.fromDate === plan.current.toDate;
    return (
      <div style={card} data-testid="stmt-balance-card">
        <div style={label}>Match Arth's balance to this statement</div>
        <div style={{ color: T.text, fontSize: 13, lineHeight: 1.5 }}>
          <div>Opening balance: {plan.opening.from === 0 && !plan.opening.fromDate ? "not set" : `${m(plan.opening.from)} (${plan.opening.fromDate ? niceDate(plan.opening.fromDate) : "no date"})`} → <b>{m(plan.opening.to)}</b> on {niceDate(plan.opening.toDate)}</div>
          <div>Current balance: {plan.current.from === null ? "worked out from entries" : `${m(plan.current.from)} (${niceDate(plan.current.fromDate)})`} → <b>{m(plan.current.to)}</b> as of {niceDate(plan.current.toDate)}</div>
        </div>
        {plan.entriesBeforeOpening > 0 && <div data-testid="stmt-balance-warn" style={{ color: T.warn, fontSize: 12, marginTop: 8, lineHeight: 1.45 }}>{plan.entriesBeforeOpening} entr{plan.entriesBeforeOpening === 1 ? "y" : "ies"} in this account dated before {niceDate(plan.opening.toDate)} will stop counting toward its balance (they stay in your records).</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {!balUndo && <button data-testid="stmt-balance-match" style={btn(true, same)} disabled={same} onClick={() => setBalUndo(onMatchBalance(acc.id, plan))}>{same ? "Already matches" : "Set these balances"}</button>}
          {balUndo && <><div data-testid="stmt-balance-done" style={{ color: T.sub, fontSize: 13, alignSelf: "center", flex: 1 }}>Balances set.</div><button data-testid="stmt-balance-undo" style={btn(false)} onClick={() => { onUndoBalance(acc.id, balUndo); setBalUndo(null); }}>Undo</button></>}
        </div>
      </div>
    );
  };

  const cardSummaryBlock = parsed => {
    const sm = parsed.summary, chk = parsed.summaryCheck;
    const m = v => `${sym}${(v / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const has = k => typeof sm[k] === "number", fd = d => (d ? niceDate(d) : "");
    const f = id => chk && chk.findings.find(x => x.id === id);
    return (
      <div data-testid="stmt-card-summary" style={{ marginTop: 8, fontSize: 12, color: T.sub, lineHeight: 1.5 }}>
        {(sm.statementDate || sm.dueDate) && <div>{sm.statementDate ? `Statement ${fd(sm.statementDate)}` : ""}{sm.dueDate ? ` · due ${fd(sm.dueDate)}` : ""}</div>}
        {has("totalDuePaise") && <div>Total due <b style={{ color: T.text }}>{m(sm.totalDuePaise)}</b>{has("minDuePaise") ? ` · minimum ${m(sm.minDuePaise)}` : ""}</div>}
        {has("previousBalancePaise") && has("purchasesPaise") && has("paymentsPaise") && <div>Previous {m(sm.previousBalancePaise)} + purchases {m(sm.purchasesPaise)}{has("cashAdvancesPaise") && sm.cashAdvancesPaise ? ` + cash ${m(sm.cashAdvancesPaise)}` : ""} − payments {m(sm.paymentsPaise)}</div>}
        {f("equation") && (f("equation").ok ? <div data-testid="stmt-card-ok">✓ The statement's own figures add up.</div> : <div data-testid="stmt-card-warn" style={{ color: T.warn }}>The statement's printed figures do not add up (fees or interest may be included in the total). Check before importing.</div>)}
        {f("charges") && (f("charges").ok ? <div data-testid="stmt-card-ok2">✓ The charges read from the file match the statement's purchases ({m(f("charges").rows)}).</div> : <div data-testid="stmt-card-warn2" style={{ color: T.warn }}>Charges read from the file are {m(f("charges").rows)}, but the statement says {m(f("charges").stated)}. A row may be missing or misread.{parsed.rowsPerPage ? ` Rows read per page: ${parsed.rowsPerPage.join(", ")}.` : ""}</div>)}
        {f("credits") && !f("credits").ok && <div style={{ color: T.warn }}>Payments/credits read from the file are {m(f("credits").rows)}, but the statement says {m(f("credits").stated)}.</div>}
        {!chk || chk.findings.length === 0 ? <div>No totals could be read from this file, so the rows could not be cross-checked.</div> : null}
        {parsed.rows.some(r => r.amountPaise > 0) && <div>Payments and refunds are not added from a card statement. A payment is added from your bank (import the bank statement: it becomes a card payment), and a row that matches one you already have can be merged below.</div>}
      </div>
    );
  };

  const p = state.parsed, bal = p && p.balance;
  return (
    <div style={{ padding: "14px 16px 24px" }} data-testid="statement-import">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} aria-label="Back" style={{ background: "none", border: "none", color: T.accent, cursor: "pointer", fontSize: 22, padding: 0 }}>←</button>
        <div style={{ color: T.text, fontSize: 18, fontWeight: 900, flex: 1 }}>{isCard ? "Import card statement" : "Import bank statement"}</div>
      </div>
      {note("mute", <><b>Review first. Nothing is added until you press Import.</b> The file is read on this device and is not stored or uploaded. Rows already in Arth are skipped, and existing entries are never changed.</>, "stmt-banner")}

      {state.phase !== "done" && <div style={card}>
        <div style={label}>{isCard ? "Credit card" : "Bank account"}</div>
        {fixedAccountId ? <div data-testid="stmt-fixed-account" style={{ color: T.text, fontSize: 14, fontWeight: 800 }}>{(accounts.find(a => String(a.id) === String(fixedAccountId)) || {}).name || "This account"}</div>
          : banks.length === 0 ? <div style={{ color: T.warn, fontSize: 13, fontWeight: 700 }}>Add a bank account first (Settings → Accounts).</div>
          : <select data-testid="stmt-account" value={accountId} onChange={e => { setAccountId(e.target.value); setState({ phase: "idle" }); }} style={{ width: "100%", minHeight: 44, borderRadius: 10, border: `1px solid ${T.border}`, background: T.input, color: T.text, padding: "0 10px", fontSize: 14 }}>
            <option value="">Choose the account this statement is for</option>
            {banks.map(a => <option key={a.id} value={String(a.id)}>{a.name}{a.last4 ? ` ····${a.last4}` : ""}</option>)}
          </select>}
        <div style={{ ...label, marginTop: 14 }}>Statement file</div>
        <input ref={fileRef} data-testid="stmt-file" type="file" accept=".csv,.tsv,.txt,.xlsx,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onFile} style={{ display: "none" }} />
        <button data-testid="stmt-pick" style={btn(true, !banks.length)} disabled={!banks.length} onClick={() => fileRef.current && fileRef.current.click()}>Choose CSV, Excel or PDF</button>
        {state.phase === "reading" && <div style={{ color: T.sub, fontSize: 13, marginTop: 10 }}>Reading {state.fileName}…</div>}
        {state.error && <div data-testid="stmt-error" style={{ color: T.warn, fontSize: 13, fontWeight: 700, marginTop: 10, lineHeight: 1.45 }}>{state.error}</div>}
        {state.error && state.detail && <div data-testid="stmt-error-detail" style={{ color: T.sub, fontSize: 11, marginTop: 6, lineHeight: 1.4, wordBreak: "break-word" }}>Detail (no statement content, safe to share): {state.detail}</div>}
      </div>}

      {state.phase === "result" && <>
        <div style={card} data-testid="stmt-summary">
          <div style={{ color: T.text, fontSize: 15, fontWeight: 800 }}>{state.fileName}</div>
          <div style={{ color: T.sub, fontSize: 13, marginTop: 4 }}>{p.rows.length} rows · {niceDate(p.period.from)} to {niceDate(p.period.to)}</div>
          <div style={{ color: T.sub, fontSize: 13, marginTop: 4 }}>New {state.match.summary.new} · Looks already in Arth {state.match.summary.probableMatch} · Imported before {state.match.summary.alreadyImported}{p.skipped.length ? ` · Could not read ${p.skipped.length}` : ""}</div>
          {!isCard && bal.checked > 0 && bal.mismatches.length === 0 && <div data-testid="stmt-balance-ok" style={{ color: T.sub, fontSize: 12, marginTop: 6 }}>✓ The statement's running balance adds up across all {bal.checked + 1} rows.</div>}
          {!isCard && bal.checked > 0 && bal.mismatches.length > 0 && note("amb", <><b>The running balance does not add up on {bal.mismatches.length} row(s).</b> A row may be missing or misread (lines {bal.mismatches.slice(0, 6).join(", ")}). Check the amounts before importing.</>, "stmt-balance-bad")}
          {!isCard && bal.signsReversed && <div data-testid="stmt-reversed" style={{ color: T.sub, fontSize: 12, marginTop: 6 }}>The column headings said Debit/Credit the other way round; Arth followed the running balance (money out reduces it).</div>}
          {isCard && p.summary && cardSummaryBlock(p)}
          {p.skipped.length > 0 && <div data-testid="stmt-skipped-top" style={{ color: T.warn, fontSize: 12, marginTop: 8, lineHeight: 1.45, wordBreak: "break-word" }}><b>{p.skipped.length} row{p.skipped.length === 1 ? "" : "s"} could not be read</b> (not added): {p.skipped.slice(0, 5).map(s => `line ${s.line} — ${s.why}${s.text ? `: ${s.text}` : ""}`).join("; ")}{p.skipped.length > 5 ? "…" : ""}</div>}
          {!isCard && bal.checked === 0 && <div style={{ color: T.sub, fontSize: 12, marginTop: 6 }}>No running-balance column, so amounts could not be cross-checked. Look through the rows before importing.</div>}
        </div>

        {balanceCard()}
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button style={btn(false)} onClick={() => { setMerged({}); setTicked(Object.fromEntries(state.match.results.map(r => [r.row.importKey, r.status === "new" && canAdd(r)]))); }}>Only new</button>
          <button style={btn(false)} onClick={() => { setMerged({}); setTicked(Object.fromEntries(state.match.results.map(r => [r.row.importKey, canAdd(r)]))); }}>All</button>
          <button style={btn(false)} onClick={() => { setMerged({}); setTicked({}); }}>None</button>
        </div>

        <div data-testid="stmt-rows">
          {state.match.results.map(({ row, status, matchId }) => {
            const out = row.amountPaise < 0, bill = !isCard && out && looksLikeCardBill(row.desc), cardHit = bill ? findCardByText(row.desc, cards) : null;
            return (
              <label key={row.importKey} data-testid="stmt-row" data-status={status} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 4px", borderBottom: `1px solid ${T.border}`, opacity: status === "already-imported" ? 0.5 : 1 }}>
                <input type="checkbox" checked={Boolean(ticked[row.importKey]) && canAdd({ row, status })} disabled={!canAdd({ row, status })} onChange={e => { setTicked(t => ({ ...t, [row.importKey]: e.target.checked })); if (e.target.checked) setMerged(m => ({ ...m, [row.importKey]: false })); }} style={{ marginTop: 3, width: 20, height: 20 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: T.text, fontSize: 13, fontWeight: 700, wordBreak: "break-word" }}>{row.desc || "(no description)"}</div>
                  <div style={{ color: T.sub, fontSize: 11, marginTop: 2 }}>{niceDate(row.date)}
                    {status === "probable-match" && " · looks like an entry already in Arth"}{isCard && !out && status === "new" && " · payment or refund: not added here (see below)"}{status === "already-imported" && " · imported before"}
                    {bill && (cardHit ? ` · card bill payment → ${cardHit.name}` : " · looks like a card bill payment, but no card matched: it will be an expense")}</div>
                  {status === "probable-match" && (() => {
                    const mine = txnById(matchId); if (!mine) return null;
                    const linked = Boolean(mine.importKey);
                    return (
                      <div data-testid="stmt-match" style={{ marginTop: 6, background: T.pill, borderRadius: 10, padding: "6px 8px", fontSize: 11, color: T.sub }}>
                        <div>Your entry: <b style={{ color: T.text }}>{mine.desc || mine.merchant || mine.type}</b> · {niceDate(mine.date)} · {sym}{Number(mine.amount).toLocaleString("en-IN")}</div>
                        {linked ? <div>Already linked to a statement row.</div>
                          : <button type="button" data-testid="stmt-merge" onClick={e => { e.preventDefault(); const on = !merged[row.importKey]; setMerged(m => ({ ...m, [row.importKey]: on })); if (on) setTicked(t => ({ ...t, [row.importKey]: false })); }}
                              style={{ marginTop: 6, border: `1px solid ${merged[row.importKey] ? T.accent : T.border}`, background: merged[row.importKey] ? T.accent + "22" : "none", color: merged[row.importKey] ? T.accent : T.text, borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                              {merged[row.importKey] ? "✓ Will merge into my entry" : "Merge into my entry"}</button>}
                      </div>
                    );
                  })()}
                </div>
                <div style={{ color: out ? T.text : T.accent, fontSize: 14, fontWeight: 800, whiteSpace: "nowrap" }}>{out ? "−" : "+"}{fmt(row.amountPaise, sym)}</div>
              </label>
            );
          })}
        </div>
        {p.skipped.length > 0 && <div style={{ color: T.sub, fontSize: 12, marginTop: 10 }}>Rows not read ({p.skipped.length}): {p.skipped.slice(0, 5).map(s => `line ${s.line} (${s.why}${s.text ? `: ${s.text}` : ""})`).join("; ")}{p.skipped.length > 5 ? "…" : ""}</div>}

        <div style={{ position: "sticky", bottom: 0, background: T.bg, paddingTop: 12 }}>
          {chosen.length > 0 && (isCard
            ? <div data-testid="stmt-effect" style={{ color: T.sub, fontSize: 12, marginBottom: 8, lineHeight: 1.45 }}>These charges ({fmt(net, sym)}) will be added to this card on their dates and count in its bill. Imported expenses have no category yet; they will appear under "Needs details".</div>
            : <div data-testid="stmt-effect" style={{ color: T.sub, fontSize: 12, marginBottom: 8, lineHeight: 1.45 }}>These rows will change this account's balance in Arth by {net < 0 ? "−" : "+"}{fmt(net, sym)}. If the account's starting balance in Arth already includes these dates, adjust it afterwards. Imported expenses have no category yet; they will appear under "Needs details".</div>)}
          <button data-testid="stmt-import" style={{ ...btn(true, chosen.length + merges.length === 0), width: "100%" }} disabled={chosen.length + merges.length === 0} onClick={doImport}>Import {chosen.length} row{chosen.length === 1 ? "" : "s"}{merges.length > 0 ? ` · merge ${merges.length}` : ""}</button>
        </div>
      </>}

      {state.phase === "done" && <div style={card} data-testid="stmt-done">
        <div style={{ color: T.text, fontSize: 16, fontWeight: 900 }}>Imported {state.count} transaction{state.count === 1 ? "" : "s"}{state.mergedCount > 0 ? ` · merged ${state.mergedCount} into entries you already had` : ""}</div>
        {state.cardBills > 0 && <div style={{ color: T.sub, fontSize: 13, marginTop: 6 }}>{state.cardBills} card bill payment{state.cardBills === 1 ? " was" : "s were"} added as card payments, not spending.</div>}
        {state.unmatched > 0 && <div style={{ color: T.warn, fontSize: 13, marginTop: 6 }}>{state.unmatched} looked like card bill payments but no card matched; they were added as expenses. Open them and choose "Card bill payment" if so.</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button data-testid="stmt-undo" style={btn(false)} onClick={() => { onUndoBatch(state.batchId); setState({ phase: "idle" }); }}>Undo this import</button>
          <button style={btn(true)} onClick={onBack}>Done</button>
        </div>
      </div>}

      {state.phase === "done" && balanceCard()}

      {batches.length > 0 && state.phase !== "done" && <div style={{ ...card, marginTop: 16 }} data-testid="stmt-batches">
        <div style={label}>Earlier imports</div>
        {batches.map(b => <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
          <div style={{ flex: 1, color: T.text, fontSize: 13 }}>{b.n} transaction{b.n === 1 ? "" : "s"} · {niceDate(b.from)} to {niceDate(b.to)}</div>
          <button data-testid="stmt-undo-batch" style={{ ...btn(false), padding: "6px 10px", fontSize: 12 }} onClick={() => { if (window.confirm(`Undo this import? Entries it created are removed; entries it was merged into go back exactly as they were. Anything else you added by hand is not touched.`)) onUndoBatch(b.id); }}>Undo</button>
        </div>)}
      </div>}
    </div>
  );
}
