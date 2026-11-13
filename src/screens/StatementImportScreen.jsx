// Bank statement import. Pick the account, pick a statement file (CSV, Excel or a text PDF), review every row, tick what to add, press Import.
// Reading creates nothing. Imported rows are plain transactions (no category: they show under "Needs details"); each carries a key and a
// batch id, so the same file can be imported again safely and a whole import can be undone. Existing entries are never changed.
import * as smsBridge from "../native/smsBridge.js";
import { findNoticeEntries } from "../domain/sms/smsInbox.js";
import { payeeNamesByUpiId } from "../domain/imports/upiId.js";
import * as statementMod from "../domain/imports/statement.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { withImportKeys } from "../domain/imports/statement.js";
import { matchStatement } from "../domain/imports/matchStatement.js";
import { getLinkedMethodIds } from "../domain/accounts/accountBalance.js";
import { statementBalances, planBalanceMatch } from "../domain/imports/statementBalances.js";
import { planNameRepairs, planRefRepairs } from "../domain/imports/buildImport.js";
import { findImportedDuplicates } from "../domain/imports/duplicatePairs.js";
import { canTakeAnotherLink, buildImportTxns, importedKeysOf, looksLikeCardBill, findCardByText } from "../domain/imports/buildImport.js";

const fmt = (paise, sym) => `${sym}${(Math.abs(paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const addDay = iso => { const t = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + 1)); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`; };
const niceDate = iso => { const [y, m, d] = iso.split("-"); return `${d}-${m}-${y}`; };

export default function StatementImportScreen({ accounts = [], txns = [], genId, T, sym = "₹", onImport, onUndoBatch, onBack, fixedAccountId = "", checkpoints = {}, onMatchBalance, onUndoBalance, statementBillPlan, onSetStatementBill, onUndoStatementBill, onTidyNames, onUndoTidy, onMergeRepeats, onUndoRepeats, onRemoveNotices, onUndoNotices, people = [] }) {
  const fileRef = useRef(null);
  const banks = accounts.filter(a => a.type === "bank");
  const cards = accounts.filter(a => a.type === "cc");
  const [accountId, setAccountId] = useState(fixedAccountId || (banks.length === 1 ? String(banks[0].id) : ""));
  const [state, setState] = useState({ phase: "idle" });          // idle | reading | result | done
  const smsOn = smsBridge.smsAvailable();
  const [smsDays, setSmsDays] = useState(30), [smsWaiting, setSmsWaiting] = useState(null);   // smsWaiting: new messages found by the quiet check
  const [pasteOpen, setPasteOpen] = useState(false), [pasteText, setPasteText] = useState("");
  const [ticked, setTicked] = useState({});                       // importKey -> bool (add as a new transaction)
  const [merged, setMerged] = useState({});                       // importKey -> bool (link to the entry it looks like; adds nothing)
  const [sb, setSb] = useState(null);                         // what the last file says the balance was at its start and end
  const repairs = useMemo(() => [...planNameRepairs(txns).map(c => ({ field: "merchant", ...c })), ...planRefRepairs(txns)], [txns]);
  const [tidyUndo, setTidyUndo] = useState(null);
  const payeeByUpiId = useMemo(() => payeeNamesByUpiId(txns, people), [txns, people]);   // a UPI id already named by the person (or saved on a person) names new entries
  const notices = useMemo(() => findNoticeEntries(txns), [txns]);
  const [noticeUndo, setNoticeUndo] = useState(null);
  const repeatAccId = fixedAccountId || accountId;
  const repeats = useMemo(() => (repeatAccId ? findImportedDuplicates({ txns, accountId: repeatAccId, linkedIds: getLinkedMethodIds(repeatAccId, accounts) }) : []), [txns, repeatAccId, accounts]);
  const [repeatUndo, setRepeatUndo] = useState(null);
  const [lastSummary, setLastSummary] = useState(null);       // the card statement figures read from the last PDF
  const [billUndo, setBillUndo] = useState(null);               // set after "Set the statement bill", used by its Undo
  const [balUndo, setBalUndo] = useState(null);                // set after "Match", used by its Undo
  const acctNow = accounts.find(a => String(a.id) === String(fixedAccountId || accountId));
  const isCard = Boolean(acctNow && acctNow.type === "cc");     // a credit card: a plain amount is a charge; payments/refunds are matched, not created
  const canAdd = r => r.status !== "already-imported" && !(isCard && r.row.amountPaise > 0);
  const keys = useMemo(() => importedKeysOf(txns), [txns]);

  const card = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, marginBottom: 12 };
  const label = { color: T.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 };
  const btn = (primary, disabled) => ({ border: primary ? "0" : `1px solid ${T.border}`, background: primary ? T.accent : "none", color: primary ? "#fff" : T.text, borderRadius: 12, padding: "11px 14px", fontWeight: 800, fontSize: 14, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, fontFamily: "inherit" });
  const note = (tone, children, tid) => <div data-testid={tid} style={{ background: tone === "amb" ? "rgba(240,165,0,0.16)" : T.accentSoft, color: T.text, borderRadius: 12, padding: "10px 12px", fontSize: 13, marginBottom: 12, lineHeight: 1.45 }}>{children}</div>;

  const matchOnly = (parsed, accId) => matchStatement(withImportKeys(parsed.rows, accId), { transactions: txns, accountId: accId, importedKeys: keys, linkedIds: getLinkedMethodIds(accId, accounts), importedUtrs: txns.filter(t => t.importKey && t.transactionRef).map(t => t.transactionRef) });
  const analyse = (parsed, accId) => {
    const m = matchOnly(parsed, accId);
    const start = {}; m.results.forEach(r => { start[r.row.importKey] = r.status === "new" && !(isCard && r.row.amountPaise > 0); });
    setTicked(start); setMerged({});
    return m;
  };

  // Card app text ("Here are your transactions: 1. Amount: -₹222.14 …"): same matching as a file, so only missing entries are added.
  const onPasted = async () => {
    if (!accountId) { setState({ phase: "idle", error: "Choose the card first." }); return; }
    try {
      const [{ pastedTextToRows }, { parseStatementRows }] = await Promise.all([import("../domain/imports/pastedText.js"), Promise.resolve(statementMod)]);
      const t = pastedTextToRows(pasteText);
      if (!t.ok) { setState({ phase: "idle", error: t.reason }); return; }
      const parsed = parseStatementRows(t.rows, { kind: "card" });
      if (!parsed.ok) { setState({ phase: "idle", error: parsed.reason || "The pasted text could not be read." }); return; }
      const extra = t.unreadable.map(u => ({ line: u.n, why: u.text }));
      const withSkips = { ...parsed, skipped: [...(parsed.skipped || []), ...extra] };
      setSb(null); setBalUndo(null); setLastSummary(null); setBillUndo(null);
      setState({ phase: "result", fileName: "Pasted text", parsed: withSkips, match: analyse(withSkips, accountId), accountId });
    } catch (err) { setState({ phase: "idle", error: "The pasted text could not be read.", detail: `${(err && err.name) || "error"}${err && err.message ? " — " + String(err.message).slice(0, 140) : ""}` }); }
  };

  // Text messages from the phone (Android app only): read on request, sorted to this account by the last 4 digits they mention, then the same review as a file.
  const smsRowsFor = async (accId, days, { ask }) => {
    const acc = accounts.find(a => String(a.id) === String(accId));
    if (!acc) return { error: "Choose the account first." };
    if (!acc.last4) return { error: "This account has no last 4 digits saved, so its messages cannot be told apart. Add them in the account's settings." };
    const [br, mod, st] = await Promise.all([Promise.resolve(smsBridge), import("../domain/sms/smsInbox.js"), Promise.resolve(statementMod)]);
    let g = await br.smsStatus();
    if (!g.granted && ask) g = await br.smsRequest();
    if (!g.granted) return { error: ask ? "SMS access was not allowed. You can allow it in the phone's settings for Arth." : "", denied: true };
    const r = await br.smsReadInbox(Date.now() - days * 86400000);
    if (!r.ok) return { error: r.error };
    const sorted = mod.sortSmsToAccounts(r.messages, accounts);
    const mine = sorted.byAccount.get(String(acc.id)) || [];
    const other = sorted.noAccount.length;
    if (!mine.length) return { error: `No money messages for ····${acc.last4} ${days >= 3650 ? "on this phone" : `in the last ${days} days`}.${other ? ` (${other} other money message${other === 1 ? "" : "s"} did not name this account's last 4 digits and were left out.)` : ""}` };
    const rows = mod.smsRows(mine);
    return { parsed: { ok: true, rows, skipped: sorted.unreadable.map((u, i) => ({ line: i + 1, why: u.why, text: u.text })), balance: { checked: 0, mismatches: [], order: "unknown" }, period: { from: rows[0].date, to: rows[rows.length - 1].date } }, other, st };
  };
  // One scan for every account: messages are sorted to accounts by their last 4 digits; "Add all new" adds only rows that are new (matches stay for review).
  const [smsAll, setSmsAll] = useState(null);
  const isCardAcc = a => a.type === "cc";
  const onScanAll = async () => {
    setSmsAll({ busy: true });
    try {
      const [br, mod] = await Promise.all([Promise.resolve(smsBridge), import("../domain/sms/smsInbox.js")]);
      let g = await br.smsStatus(); if (!g.granted) g = await br.smsRequest();
      if (!g.granted) { setSmsAll({ error: "SMS access was not allowed. You can allow it in the phone's settings for Arth." }); return; }
      const r = await br.smsReadInbox(Date.now() - smsDays * 86400000);
      if (!r.ok) { setSmsAll({ error: r.error }); return; }
      const scan = accounts.filter(a => a.type === "bank" || a.type === "cc");
      const sorted = mod.sortSmsToAccounts(r.messages, scan);
      const groups = [...sorted.byAccount.entries()].map(([id, list]) => {
        const acc = scan.find(a => String(a.id) === id), rows = mod.smsRows(list);
        const parsed = { ok: true, rows, skipped: [], balance: { checked: 0, mismatches: [], order: "unknown" }, period: { from: rows[0].date, to: rows[rows.length - 1].date } };
        const m = matchOnly(parsed, id);
        const addable = m.results.filter(x => x.status === "new" && !(isCardAcc(acc) && x.row.amountPaise > 0));
        return { acc, parsed, addable, nMatch: m.results.filter(x => x.status === "probable-match").length };
      }).filter(x => x.addable.length || x.nMatch);
      setSmsAll({ groups, noAccount: sorted.noAccount.length, unreadable: sorted.unreadable.length, nothing: !groups.length });
    } catch (err) { setSmsAll({ error: "The messages could not be read.", detail: `${(err && err.name) || "error"}${err && err.message ? " — " + String(err.message).slice(0, 140) : ""}` }); }
  };
  const reviewGroup = grp => { const id = String(grp.acc.id); setAccountId(id); setSb(null); setBalUndo(null); setLastSummary(null); setBillUndo(null); setState({ phase: "result", fileName: "SMS from phone", parsed: grp.parsed, match: analyse(grp.parsed, id), accountId: id }); setSmsAll(null); };
  const addAllNew = () => {
    const added = [];
    for (const grp of smsAll.groups) {
      if (!grp.addable.length) continue;
      const batchId = genId();
      const made = buildImportTxns(grp.addable, { accountId: String(grp.acc.id), batchId, cards, newId: genId, plainExpenses: isCardAcc(grp.acc), accountType: grp.acc.type, payeeByUpiId });
      onImport(made, { batchId, fileName: "SMS from phone", merges: [] });
      added.push({ name: grp.acc.name, last4: grp.acc.last4, n: made.length, batchId, undone: false });
    }
    setSmsAll({ added });
  };
  const onReadSms = async () => {
    const accId = fixedAccountId || accountId;
    if (!accId) { setState({ phase: "idle", error: "Choose the account first." }); return; }
    setState({ phase: "reading", fileName: "SMS from phone" });
    try {
      const r = await smsRowsFor(accId, smsDays, { ask: true });
      if (r.error) { setState({ phase: "idle", error: r.error }); return; }
      setSb(null); setBalUndo(null); setLastSummary(null); setBillUndo(null);
      setState({ phase: "result", fileName: "SMS from phone", parsed: r.parsed, match: analyse(r.parsed, accId), accountId: accId });
    } catch (err) { setState({ phase: "idle", error: "The messages could not be read.", detail: `${(err && err.name) || "error"}${err && err.message ? " — " + String(err.message).slice(0, 140) : ""}` }); }
  };
  // quiet check when the screen opens: only counts, shows nothing and asks nothing
  const smsAcc = fixedAccountId || accountId;
  useEffect(() => {
    if (!smsOn || !smsAcc) { setSmsWaiting(null); return; }
    let live = true;
    smsRowsFor(smsAcc, smsDays, { ask: false }).then(r => { if (live) setSmsWaiting(r.parsed ? matchOnly(r.parsed, smsAcc).results.filter(x => x.status === "new").length : 0); }).catch(() => { if (live) setSmsWaiting(null); });
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smsOn, smsAcc, smsDays, txns]);

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
      setSb(statementBalances(parsed)); setBalUndo(null); setLastSummary(parsed.summary && typeof parsed.summary.totalDuePaise === "number" ? parsed.summary : null); setBillUndo(null);
      setState({ phase: "result", fileName: file.name, parsed, match: analyse(parsed, accountId), accountId });
    } catch (err) {
      // The detail names the step and the error only (no file content), so it is safe to send to whoever is fixing this.
      setState({ phase: "idle", error: "This file could not be read.", detail: `failed while trying to ${stage}: ${(err && err.name) || "error"}${err && err.message ? " — " + String(err.message).slice(0, 140) : " (no message)"}` });
    }
  };

  const chosen = state.phase === "result" ? state.match.results.filter(r => ticked[r.row.importKey] && r.status !== "already-imported") : [];
  const net = chosen.reduce((s, r) => s + r.row.amountPaise, 0);
  const txnById = id => txns.find(t => String(t.id) === String(id));
  const merges = state.phase === "result" ? state.match.results.filter(r => r.status === "probable-match" && merged[r.row.importKey] && !ticked[r.row.importKey] && txnById(r.matchId) && canTakeAnotherLink(txnById(r.matchId))).map(r => ({ txnId: r.matchId, row: r.row })) : [];
  const doImport = () => {
    const batchId = genId();
    const made = buildImportTxns(chosen, { accountId: state.accountId, batchId, cards, newId: genId, plainExpenses: isCard, accountType: acctNow ? acctNow.type : "", payeeByUpiId });
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

  const statementBillCard = () => {
    if (!isCard || !lastSummary || !statementBillPlan || !onSetStatementBill) return null;
    const plan = statementBillPlan(state.accountId || accountId, lastSummary);
    if (!plan.ok) return null;
    const m = v => `${sym}${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const pending = state.phase === "result" && chosen.length > 0;
    return (
      <div style={card} data-testid="stmt-bill-card">
        <div style={label}>Statement bill for this PDF</div>
        <div style={{ color: T.text, fontSize: 13, lineHeight: 1.5 }}>
          <div>Statement total <b>{m(plan.bankAmount)}</b>{lastSummary.dueDate ? ` · due ${niceDate(lastSummary.dueDate)}` : ""}</div>
          <div>Arth has <b>{m(plan.arthAmount)}</b> on this card for {niceDate(addDay(plan.periodFrom))} to {niceDate(plan.periodTo)}{plan.difference !== 0 ? <span style={{ color: T.warn }}> · {m(Math.abs(plan.difference))} {plan.difference > 0 ? "short" : "more than the statement"}</span> : <span style={{ color: T.success }}> · matches</span>}</div>
        </div>
        {pending && <div style={{ color: T.sub, fontSize: 11, marginTop: 6 }}>These figures do not include the rows you are about to import. Import first, then set the bill.</div>}
        {plan.notes.map((n, i) => <div key={i} data-testid="stmt-bill-note" style={{ color: T.warn, fontSize: 12, marginTop: 6, lineHeight: 1.4 }}>{n}</div>)}
        <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
          {!billUndo && plan.action !== "unchanged" && <button data-testid="stmt-bill-set" style={btn(true)} onClick={() => setBillUndo(onSetStatementBill(plan))}>{plan.action === "create" ? "Set the statement bill from this PDF" : "Update the statement bill from this PDF"}</button>}
          {!billUndo && plan.action === "unchanged" && <div data-testid="stmt-bill-same" style={{ color: T.success, fontSize: 13, fontWeight: 700 }}>✓ The statement bill already matches this PDF.</div>}
          {billUndo && <><div data-testid="stmt-bill-done" style={{ color: T.sub, fontSize: 13, flex: 1 }}>Statement bill set{plan.bill.verification === "matched" ? ": matched." : ": the difference is recorded for you to review."}</div><button data-testid="stmt-bill-undo" style={btn(false)} onClick={() => { onUndoStatementBill(billUndo); setBillUndo(null); }}>Undo</button></>}
        </div>
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

      {(repeats.length > 0 || repeatUndo) && state.phase !== "done" && (
        <div style={card} data-testid="stmt-repeats">
          <div style={label}>Repeats already in your books</div>
          {repeats.length > 0 && <>
            <div style={{ color: T.text, fontSize: 13, lineHeight: 1.45 }}>{repeats.length} payment{repeats.length === 1 ? " is" : "s are"} in twice: an entry you made, and a copy a statement import added (same amount, same account, within 2 days). Merging keeps <b>your</b> entry and removes the import's copy.</div>
            <div style={{ marginTop: 8 }}>
              {repeats.slice(0, 8).map(({ manual, imported }) => (
                <div key={manual.id} data-testid="stmt-repeat" style={{ fontSize: 12, color: T.sub, padding: "4px 0", borderTop: `1px solid ${T.border}`, wordBreak: "break-word" }}>
                  <span style={{ color: T.text, fontWeight: 700 }}>{manual.merchant || manual.desc || "Entry"}</span> · {niceDate(manual.date)} · {sym}{Number(manual.amount).toLocaleString("en-IN")} — import's copy: {imported.merchant || imported.desc}
                </div>
              ))}
              {repeats.length > 8 && <div style={{ color: T.sub, fontSize: 11, marginTop: 4 }}>and {repeats.length - 8} more</div>}
            </div>
          </>}
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
            {!repeatUndo ? <button data-testid="stmt-repeats-merge" style={btn(true)} onClick={() => setRepeatUndo(onMergeRepeats(repeats))}>Merge {repeats.length} repeat{repeats.length === 1 ? "" : "s"} (keep mine)</button>
              : <><div data-testid="stmt-repeats-done" style={{ color: T.sub, fontSize: 13, flex: 1 }}>Merged.</div><button data-testid="stmt-repeats-undo" style={btn(false)} onClick={() => { onUndoRepeats(repeatUndo); setRepeatUndo(null); }}>Undo</button></>}
          </div>
        </div>
      )}
      {(notices.length > 0 || noticeUndo) && state.phase !== "done" && onRemoveNotices && (
        <div style={card} data-testid="stmt-junk">
          <div style={label}>Not real transactions</div>
          {notices.length > 0 && <div style={{ color: T.text, fontSize: 13, lineHeight: 1.45 }}>
            {notices.length} imported entr{notices.length === 1 ? "y is" : "ies are"} bank notices, not money spent (a payment that will be debited, a statement-sent message). They were added by an earlier version.
            <div style={{ marginTop: 6 }}>{notices.slice(0, 6).map(t => <div key={t.id} style={{ color: T.sub, fontSize: 12 }}>{niceDate(t.date)} · {sym}{Number(t.amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · {String(t.merchant || t.desc || "").slice(0, 44)}</div>)}{notices.length > 6 && <div style={{ color: T.sub, fontSize: 12 }}>…and {notices.length - 6} more</div>}</div>
          </div>}
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
            {!noticeUndo ? <button data-testid="stmt-junk-remove" style={btn(true)} onClick={() => setNoticeUndo(onRemoveNotices(notices))}>Remove {notices.length} entr{notices.length === 1 ? "y" : "ies"}</button>
              : <><div data-testid="stmt-junk-done" style={{ color: T.sub, fontSize: 13, flex: 1 }}>Removed.</div><button data-testid="stmt-junk-undo" style={btn(false)} onClick={() => { onUndoNotices(noticeUndo); setNoticeUndo(null); }}>Undo</button></>}
          </div>
        </div>
      )}
      {(repairs.length > 0 || tidyUndo) && state.phase !== "done" && (
        <div style={card} data-testid="stmt-tidy">
          <div style={label}>Tidy imported entries</div>
          {repairs.length > 0 && <div style={{ color: T.text, fontSize: 13, lineHeight: 1.45 }}>{repairs.filter(c => c.field === "merchant").length > 0 && <div>{repairs.filter(c => c.field === "merchant").length} imported entr{repairs.filter(c => c.field === "merchant").length === 1 ? "y has" : "ies have"} an untidy or blank vendor name such as "{repairs.find(c => c.field === "merchant").from || "(blank)"}" ({repairs.find(c => c.field === "merchant").to ? `e.g. "${repairs.find(c => c.field === "merchant").to}"` : "a whole bank message was used as the name; it will be cleared"}).</div>}{repairs.filter(c => c.field === "transactionRef").length > 0 && <div data-testid="stmt-tidy-refs">{repairs.filter(c => c.field === "transactionRef" && !c.filled).length > 0 && <div>{repairs.filter(c => c.field === "transactionRef" && !c.filled).length} merged entr{repairs.filter(c => c.field === "transactionRef" && !c.filled).length === 1 ? "y has" : "ies have"} a statement serial number where the UPI reference belongs; the UPI reference will be put in its place.</div>}{repairs.filter(c => c.filled).length > 0 && <div>{repairs.filter(c => c.filled).length} imported entr{repairs.filter(c => c.filled).length === 1 ? "y has" : "ies have"} an empty UPI / bank reference; the number in the statement or SMS text will be filled in.</div>}</div>}<div style={{ color: T.sub, fontSize: 12 }}>Only the vendor name or reference changes.</div></div>}
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
            {!tidyUndo ? <button data-testid="stmt-tidy-fix" style={btn(true)} onClick={() => setTidyUndo(onTidyNames(repairs))}>Fix {repairs.length} entr{repairs.length === 1 ? "y" : "ies"}</button>
              : <><div data-testid="stmt-tidy-done" style={{ color: T.sub, fontSize: 13, flex: 1 }}>Names fixed.</div><button data-testid="stmt-tidy-undo" style={btn(false)} onClick={() => { onUndoTidy(tidyUndo); setTidyUndo(null); }}>Undo</button></>}
          </div>
        </div>
      )}
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
        {smsOn && <div style={{ marginTop: 8 }}>
          <button data-testid="stmt-sms-read" style={btn(false, !banks.length && !fixedAccountId)} onClick={onReadSms}>Read SMS from phone{smsWaiting ? ` · ${smsWaiting} new` : ""}</button>
          <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
            <span style={{ color: T.sub, fontSize: 11 }}>Look back</span>
            {[7, 30, 90, 180, 365, 3650].map(d => <button key={d} data-testid={`stmt-sms-days-${d}`} style={{ ...btn(smsDays === d), padding: "5px 10px", fontSize: 12 }} onClick={() => setSmsDays(d)}>{d === 3650 ? "All" : d === 365 ? "1 year" : `${d} days`}</button>)}
          </div>
          <div data-testid="stmt-sms-note" style={{ color: T.sub, fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>Reads only messages that mention an amount and this account's last 4 digits, on this phone. Nothing is uploaded, and nothing is added until you press Import. Tap again any time to catch up on missed ones.</div>
        </div>}
        {smsOn && <div style={{ marginTop: 8 }}>
          <button data-testid="stmt-sms-all" style={btn(true)} onClick={onScanAll}>Scan all accounts for new SMS</button>
          {smsAll && smsAll.busy && <div style={{ color: T.sub, fontSize: 13, marginTop: 8 }}>Reading messages…</div>}
          {smsAll && smsAll.error && <div data-testid="stmt-sms-all-error" style={{ color: T.warn, fontSize: 13, fontWeight: 700, marginTop: 8 }}>{smsAll.error}</div>}
          {smsAll && smsAll.nothing && <div data-testid="stmt-sms-all-none" style={{ color: T.sub, fontSize: 13, marginTop: 8 }}>No money messages found for your accounts {smsDays >= 3650 ? "on this phone" : `in the last ${smsDays} days`}.{smsAll.noAccount ? ` ${smsAll.noAccount} message${smsAll.noAccount === 1 ? "" : "s"} did not name any account's last 4 digits.` : ""}</div>}
          {smsAll && smsAll.groups && !smsAll.nothing && <div data-testid="stmt-sms-all-list" style={{ marginTop: 8 }}>
            {smsAll.groups.map(grp => <div key={grp.acc.id} data-testid={`stmt-sms-group-${grp.acc.id}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ flex: 1, color: T.text, fontSize: 13 }}><b>{grp.acc.name}{grp.acc.last4 ? ` ····${grp.acc.last4}` : ""}</b><div style={{ color: T.sub, fontSize: 12 }}>{grp.addable.length} new{grp.nMatch ? ` · ${grp.nMatch} look already in Arth` : ""}</div></div>
              {(!fixedAccountId || String(fixedAccountId) === String(grp.acc.id)) && <button style={{ ...btn(false), padding: "7px 12px", fontSize: 12 }} onClick={() => reviewGroup(grp)}>Review</button>}
            </div>)}
            {(smsAll.noAccount > 0 || smsAll.unreadable > 0) && <div style={{ color: T.sub, fontSize: 11, marginTop: 6, lineHeight: 1.4 }}>{smsAll.noAccount > 0 ? `${smsAll.noAccount} money message${smsAll.noAccount === 1 ? "" : "s"} did not name one of your accounts (or two accounts share the digits) and were left out. ` : ""}{smsAll.unreadable > 0 ? `${smsAll.unreadable} could not be read.` : ""}</div>}
            {smsAll.groups.some(x => x.addable.length) && <button data-testid="stmt-sms-add-all" style={{ ...btn(true), marginTop: 10, width: "100%" }} onClick={addAllNew}>Add all {smsAll.groups.reduce((n, x) => n + x.addable.length, 0)} new</button>}
            <div style={{ color: T.sub, fontSize: 11, marginTop: 4 }}>"Add all new" adds only rows that are not already in Arth. Rows that look like entries you have stay for you to review.</div>
          </div>}
          {smsAll && smsAll.added && <div data-testid="stmt-sms-all-done" style={{ marginTop: 8 }}>
            {smsAll.added.map(a => <div key={a.batchId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", color: T.text, fontSize: 13 }}>
              <span style={{ flex: 1 }}>{a.name}{a.last4 ? ` ····${a.last4}` : ""}: {a.undone ? "undone" : `${a.n} added`}</span>
              {!a.undone && <button style={{ ...btn(false), padding: "6px 10px", fontSize: 12 }} onClick={() => { onUndoBatch(a.batchId); setSmsAll(x => ({ ...x, added: x.added.map(y => y.batchId === a.batchId ? { ...y, undone: true } : y) })); }}>Undo</button>}
            </div>)}
          </div>}
        </div>}
        {isCard && <>
          <button data-testid="stmt-paste-toggle" style={{ ...btn(false, !banks.length), marginTop: 8 }} disabled={!banks.length} onClick={() => setPasteOpen(o => !o)}>{pasteOpen ? "Hide pasted text" : "Or paste text from the bank app"}</button>
          {pasteOpen && <div style={{ marginTop: 8 }}>
            <textarea data-testid="stmt-paste-text" value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder={"Paste the whole message, e.g.\nHere are your transactions:\n1. Amount: -₹222.14\nDate: 10 November 2026\nDescription: …"} rows={7} style={{ width: "100%", boxSizing: "border-box", borderRadius: 10, border: `1px solid ${T.border}`, background: T.input, color: T.text, padding: 10, fontSize: 13 }} />
            <div style={{ color: T.sub, fontSize: 11, margin: "4px 0 8px", lineHeight: 1.4 }}>A minus amount is read as a charge on the card; a plus amount as money back. Entries you already have are matched, not added twice.</div>
            <button data-testid="stmt-paste-read" style={btn(true, !pasteText.trim())} disabled={!pasteText.trim()} onClick={onPasted}>Read pasted text</button>
          </div>}
        </>}
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
        {statementBillCard()}
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button style={btn(false)} onClick={() => { setMerged({}); setTicked(Object.fromEntries(state.match.results.map(r => [r.row.importKey, r.status === "new" && canAdd(r)]))); }}>Only new</button>
          <button style={btn(false)} onClick={() => { setMerged({}); setTicked(Object.fromEntries(state.match.results.map(r => [r.row.importKey, canAdd(r)]))); }}>Everything (even matches)</button>
          <button style={btn(false)} onClick={() => { setMerged({}); setTicked({}); }}>None</button>
        </div>
        {(() => {
          const mergeable = state.match.results.filter(r => r.status === "probable-match" && txnById(r.matchId) && canTakeAnotherLink(txnById(r.matchId)));
          if (!mergeable.length) return null;
          const all = mergeable.every(r => merged[r.row.importKey]);
          return (
            <div style={{ marginBottom: 10 }}>
              <button data-testid="stmt-merge-all" style={{ ...btn(!all), width: "100%" }} onClick={() => {
                if (all) { setMerged({}); return; }
                setMerged(Object.fromEntries(mergeable.map(r => [r.row.importKey, true])));
                setTicked(t => ({ ...t, ...Object.fromEntries(mergeable.map(r => [r.row.importKey, false])) }));
              }}>{all ? `✓ All ${mergeable.length} matches will merge (tap to clear)` : `Merge all ${mergeable.length} match${mergeable.length === 1 ? "" : "es"} in one go`}</button>
              <div style={{ color: T.sub, fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>Merging adds nothing new: each of your entries is only linked to its statement row and stays as it is. Look through the matches first; tap a row's button to leave one out.</div>
            </div>
          );
        })()}

        <div data-testid="stmt-rows">
          {state.match.results.map(({ row, status, matchId, byUtr, otherAccount }) => {
            const out = row.amountPaise < 0, bill = !isCard && out && looksLikeCardBill(row.desc), cardHit = bill ? findCardByText(row.desc, cards) : null;
            return (
              <label key={row.importKey} data-testid="stmt-row" data-status={status} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 4px", borderBottom: `1px solid ${T.border}`, opacity: status === "already-imported" ? 0.5 : 1 }}>
                <input type="checkbox" checked={Boolean(ticked[row.importKey]) && canAdd({ row, status })} disabled={!canAdd({ row, status })} onChange={e => { setTicked(t => ({ ...t, [row.importKey]: e.target.checked })); if (e.target.checked) setMerged(m => ({ ...m, [row.importKey]: false })); }} style={{ marginTop: 3, width: 20, height: 20 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: T.text, fontSize: 13, fontWeight: 700, wordBreak: "break-word" }}>{row.desc || "(no description)"}</div>
                  <div style={{ color: T.sub, fontSize: 11, marginTop: 2 }}>{niceDate(row.date)}
                    {status === "probable-match" && (byUtr ? " · same UPI reference as an entry already in Arth" : otherAccount ? " · same amount and date as an entry on another account" : " · looks like an entry already in Arth")}{isCard && !out && status === "new" && " · payment or refund: not added here (see below)"}{status === "already-imported" && " · imported before"}
                    {bill && (cardHit ? ` · card bill payment → ${cardHit.name}` : " · looks like a card bill payment, but no card matched: it will be an expense")}</div>
                  {status === "probable-match" && (() => {
                    const mine = txnById(matchId); if (!mine) return null;
                    const linked = !canTakeAnotherLink(mine);
                    return (
                      <div data-testid="stmt-match" style={{ marginTop: 6, background: T.pill, borderRadius: 10, padding: "6px 8px", fontSize: 11, color: T.sub }}>
                        <div>Your entry: <b style={{ color: T.text }}>{mine.merchant || mine.desc || mine.type}</b> · {niceDate(mine.date)} · {sym}{Number(mine.amount).toLocaleString("en-IN")}{(() => { const ac = accounts.find(a => String(a.id) === String(mine.accId)); return ac ? ` · ${ac.name}` : ""; })()}</div>
                        {otherAccount && <div data-testid="stmt-other-account-note">That entry is on a different account from this statement. Merging only links it; it stays where it is.</div>}
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
      {state.phase === "done" && statementBillCard()}

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
