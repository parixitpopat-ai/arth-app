// Monthly statement for one bank/cash account or credit card: pick a month (or custom dates), see opening balance, money in/out, closing balance and the
// rows with a running balance — laid out like a bank's statement so it can be compared line by line. A card shows charges and credits (no balance).
import { useMemo, useRef, useState } from "react";
import BottomSheet from "./BottomSheet";
import { buildStatement, monthBounds, shiftMonth, dayBefore, statementCsv } from "../domain/accounts/accountStatement";
import { compareStatements } from "../domain/accounts/compareStatement";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dmy = d => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;

export default function AccountStatementSheet({ T, sym, fmt, account, rows, balanceAt, ignoreBefore = "", onClose, onOpenTxn }) {
  const isCard = account.type === "cc";
  const latest = useMemo(() => (rows || []).map(r => String(r.t.date || "").slice(0, 10)).filter(Boolean).sort().pop() || "", [rows]);
  const now = new Date();
  const start = latest ? { year: +latest.slice(0, 4), month: +latest.slice(5, 7) } : { year: now.getFullYear(), month: now.getMonth() + 1 };
  const [ym, setYm] = useState(start);
  const [custom, setCustom] = useState(false);
  const mb = monthBounds(ym.year, ym.month);
  const [cFrom, setCFrom] = useState(mb.from), [cTo, setCTo] = useState(mb.to);
  const from = custom ? cFrom : mb.from, to = custom ? cTo : mb.to;
  const valid = from && to && from <= to;
  const opening = !isCard && balanceAt && valid ? balanceAt(dayBefore(from)) : null;
  const st = useMemo(() => (valid ? buildStatement({ rows, from, to, openingBalance: opening, ignoreBefore: isCard ? "" : ignoreBefore }) : null), [rows, from, to, opening, ignoreBefore, isCard, valid]);
  const arthClosing = !isCard && balanceAt && valid ? balanceAt(to) : null;
  // Compare with the bank's own statement file (read on this device, never stored): same amounts within 2 days are matched; the rest is listed on each side.
  const fileRef = useRef(null);
  const [cmpState, setCmpState] = useState({ phase: "idle" });
  const cmp = useMemo(() => (cmpState.parsed && st ? compareStatements({ parsed: cmpState.parsed, arthLines: st.lines, from, to }) : null), [cmpState.parsed, st, from, to]);
  const onCompareFile = async e => {
    const file = e.target.files && e.target.files[0]; e.target.value = "";
    if (!file) return;
    setCmpState({ phase: "reading", fileName: file.name });
    try {
      const [{ readStatementFile }, { default: workerSrc }] = await Promise.all([import("../domain/imports/readStatementFile.js"), import("../domain/invoices/pdfWorkerUrl.js")]);
      const parsed = await readStatementFile(new Uint8Array(await file.arrayBuffer()), { name: file.name, workerSrc, accountKind: isCard ? "card" : undefined });
      if (!parsed.ok) { setCmpState({ phase: "error", fileName: file.name, error: parsed.reason, detail: parsed.detail }); return; }
      setCmpState({ phase: "done", fileName: file.name, parsed });
    } catch { setCmpState({ phase: "error", fileName: file.name, error: "This file could not be read." }); }
  };
  const m = p => `${sym}${(Math.abs(p) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;      // always two decimals, like a bank statement
  const mm = p => (p < 0 ? "−" : "") + m(p);
  const lbl = { color: T.sub, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" };
  const cell = (label, value, color) => <div style={{ flex: 1, minWidth: 0 }}><div style={lbl}>{label}</div><div style={{ color: color || T.text, fontSize: 14, fontWeight: 800, marginTop: 2 }}>{value}</div></div>;
  const navBtn = { background: T.pill, border: "none", color: T.text, borderRadius: 10, minWidth: 44, minHeight: 44, fontSize: 18, cursor: "pointer", fontFamily: "inherit" };
  const download = () => {
    if (!st) return;
    try {
      const blob = new Blob([statementCsv(st)], { type: "text/csv" }), url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = `${account.name.replace(/[^A-Za-z0-9]+/g, "-")}-${from}-to-${to}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { /* the browser refused the download */ }
  };
  return (
    <BottomSheet onClose={onClose} T={T} maxHeight="94vh" zIndex={400}>
      <div data-testid="acc-statement-sheet">
        <div style={{ color: T.text, fontSize: 17, fontWeight: 900 }}>📄 Statement · {account.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 8px" }}>
          {!custom ? (<>
            <button data-testid="stmt-prev" aria-label="Previous month" onClick={() => setYm(shiftMonth(ym, -1))} style={navBtn}>‹</button>
            <div data-testid="stmt-month" style={{ flex: 1, textAlign: "center", color: T.text, fontSize: 15, fontWeight: 800 }}>{MONTHS[ym.month - 1]} {ym.year}</div>
            <button data-testid="stmt-next" aria-label="Next month" onClick={() => setYm(shiftMonth(ym, 1))} style={navBtn}>›</button>
          </>) : (<>
            <input data-testid="stmt-from" type="date" value={cFrom} onChange={e => setCFrom(e.target.value)} style={{ flex: 1, minWidth: 0, minHeight: 44, borderRadius: 10, border: `1px solid ${T.border}`, background: T.input, color: T.text, padding: "0 8px", boxSizing: "border-box" }} />
            <span style={{ color: T.sub }}>to</span>
            <input data-testid="stmt-to" type="date" value={cTo} onChange={e => setCTo(e.target.value)} style={{ flex: 1, minWidth: 0, minHeight: 44, borderRadius: 10, border: `1px solid ${T.border}`, background: T.input, color: T.text, padding: "0 8px", boxSizing: "border-box" }} />
          </>)}
        </div>
        <button data-testid="stmt-custom" onClick={() => { if (!custom) { setCFrom(mb.from); setCTo(mb.to); } setCustom(c => !c); }} style={{ background: "none", border: "none", color: T.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "4px 0 10px", fontFamily: "inherit" }}>
          {custom ? "← Back to months" : isCard ? "Custom dates (e.g. your card's billing cycle)" : "Custom dates"}
        </button>
        {!valid && <div style={{ color: T.warn, fontSize: 12 }}>Choose a start date that is on or before the end date.</div>}
        {st && (<>
          <div data-testid="stmt-summary" style={{ background: T.input, borderRadius: 14, padding: "12px 14px", display: "flex", gap: 8, flexWrap: "wrap", rowGap: 12 }}>
            {st.hasBalance ? <>
              {cell("Opening", mm(st.openingPaise))}
              {cell("Money in", m(st.totalInPaise), T.success)}
              {cell("Money out", m(st.totalOutPaise), T.danger)}
              {cell("Closing", mm(st.closingPaise))}
            </> : <>
              {cell(isCard ? "Charges" : "Out", m(st.totalOutPaise), T.danger)}
              {cell(isCard ? "Payments & credits" : "In", m(st.totalInPaise), T.success)}
              {cell("Net", mm(st.totalInPaise - st.totalOutPaise))}
            </>}
          </div>
          <div style={{ color: T.sub, fontSize: 11, margin: "6px 2px 10px" }}>{dmy(from)} to {dmy(to)} · {st.count} entr{st.count === 1 ? "y" : "ies"}</div>
          {st.hasBalance && arthClosing !== null && Math.abs(arthClosing * 100 - st.closingPaise) > 1 && <div data-testid="stmt-diff" style={{ color: T.warn, fontSize: 11, marginBottom: 8 }}>Arth's balance on {dmy(to)} is {mm(Math.round(arthClosing * 100))}, which differs from this statement's closing figure.</div>}
          {st.count === 0 ? <div style={{ color: T.sub, fontSize: 13, padding: "16px 0", textAlign: "center" }}>No entries in this period.</div> : (
            <div data-testid="stmt-lines" style={{ borderTop: `1px solid ${T.border}` }}>
              {st.lines.map(l => (
                <div key={l.id} data-testid="stmt-line" onClick={() => onOpenTxn && onOpenTxn(l.t)} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "10px 0", borderBottom: `1px solid ${T.border}`, cursor: onOpenTxn ? "pointer" : "default" }}>
                  <div style={{ width: 46, color: T.sub, fontSize: 11, flexShrink: 0 }}>{l.date.slice(8, 10)}-{l.date.slice(5, 7)}</div>
                  <div style={{ flex: 1, minWidth: 0, color: T.text, fontSize: 12.5, wordBreak: "break-word" }}>{l.description || "—"}</div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ color: l.creditPaise ? T.success : T.danger, fontSize: 13, fontWeight: 800 }}>{l.creditPaise ? "+" : "−"}{m(l.creditPaise || l.debitPaise)}</div>
                    {l.balancePaise !== null && <div style={{ color: T.sub, fontSize: 10 }}>{mm(l.balancePaise)}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <input ref={fileRef} data-testid="stmt-compare-file" type="file" accept=".csv,.tsv,.txt,.xlsx,.pdf" onChange={onCompareFile} style={{ display: "none" }} />
          <button data-testid="stmt-compare" onClick={() => fileRef.current && fileRef.current.click()} style={{ width: "100%", boxSizing: "border-box", minHeight: 48, marginTop: 14, background: T.accentSoft, border: `1px solid ${T.accent}55`, borderRadius: 12, color: T.accent, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>🔍 Compare with {isCard ? "my card" : "my bank"}'s statement file</button>
          {cmpState.phase === "reading" && <div style={{ color: T.sub, fontSize: 12, marginTop: 8 }}>Reading {cmpState.fileName}…</div>}
          {cmpState.phase === "error" && <div data-testid="stmt-compare-error" style={{ color: T.warn, fontSize: 12, marginTop: 8, lineHeight: 1.45 }}>{cmpState.error}{cmpState.detail ? <div style={{ color: T.sub, fontSize: 10, marginTop: 4, wordBreak: "break-word" }}>Detail (no statement content): {cmpState.detail}</div> : null}</div>}
          {cmp && (
            <div data-testid="stmt-compare-result" style={{ marginTop: 12, background: T.input, borderRadius: 14, padding: "12px 14px" }}>
              <div style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>Compared with {cmpState.fileName}</div>
              <div style={{ color: T.sub, fontSize: 11, marginTop: 2 }}>{cmp.bankCount} row{cmp.bankCount === 1 ? "" : "s"} in the file for this period · {cmp.arthCount} in Arth · {cmp.matched.length} match</div>
              {cmp.bankCount === 0 && <div style={{ color: T.warn, fontSize: 12, marginTop: 8 }}>The file has no rows between {dmy(from)} and {dmy(to)}. Pick the month the file covers.</div>}
              {(() => {
                const row = (label, bankP, arthP) => { const same = bankP === arthP; return (<div key={label} style={{ display: "flex", gap: 8, padding: "6px 0", borderTop: `1px solid ${T.border}`, fontSize: 12 }}><div style={{ flex: 1, color: T.sub }}>{label}</div><div style={{ width: 92, textAlign: "right", color: T.text }}>{mm(bankP)}</div><div style={{ width: 92, textAlign: "right", color: same ? T.success : T.warn, fontWeight: 700 }}>{mm(arthP)}</div></div>); };
                return (<div data-testid="stmt-compare-table" style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", gap: 8, fontSize: 10, color: T.sub, fontWeight: 700 }}><div style={{ flex: 1 }} /><div style={{ width: 92, textAlign: "right" }}>BANK FILE</div><div style={{ width: 92, textAlign: "right" }}>ARTH</div></div>
                  {cmp.bankBalances && st.hasBalance && row("Opening", cmp.bankBalances.openingPaise, st.openingPaise)}
                  {row(isCard ? "Payments & credits" : "Money in", cmp.bankIn, cmp.arthIn)}
                  {row(isCard ? "Charges" : "Money out", cmp.bankOut, cmp.arthOut)}
                  {cmp.bankBalances && st.hasBalance && row("Closing", cmp.bankBalances.closingPaise, st.closingPaise)}
                </div>);
              })()}
              {cmp.bankCount > 0 && cmp.onlyInBank.length === 0 && cmp.onlyInArth.length === 0 && <div data-testid="stmt-compare-same" style={{ color: T.success, fontSize: 12, fontWeight: 700, marginTop: 10 }}>✓ Every row matches.</div>}
              {cmp.onlyInBank.length > 0 && (<div data-testid="stmt-only-bank" style={{ marginTop: 12 }}>
                <div style={{ color: T.warn, fontSize: 12, fontWeight: 800 }}>In the bank's file but not in Arth ({cmp.onlyInBank.length})</div>
                {cmp.onlyInBank.slice(0, 40).map((b, i) => <div key={i} data-testid="stmt-only-bank-row" style={{ display: "flex", gap: 8, padding: "5px 0", fontSize: 12, color: T.text }}><span style={{ width: 46, color: T.sub, flexShrink: 0 }}>{b.date.slice(8, 10)}-{b.date.slice(5, 7)}</span><span style={{ flex: 1, minWidth: 0, wordBreak: "break-word" }}>{b.desc}</span><span style={{ fontWeight: 700, flexShrink: 0 }}>{b.amountPaise < 0 ? "−" : "+"}{m(b.amountPaise)}</span></div>)}
                <div style={{ color: T.sub, fontSize: 11, marginTop: 4 }}>Add them from the account page → Import statement.</div>
              </div>)}
              {cmp.onlyInArth.length > 0 && (<div data-testid="stmt-only-arth" style={{ marginTop: 12 }}>
                <div style={{ color: T.warn, fontSize: 12, fontWeight: 800 }}>In Arth but not in the bank's file ({cmp.onlyInArth.length})</div>
                {cmp.onlyInArth.slice(0, 40).map(a => <div key={a.id} data-testid="stmt-only-arth-row" onClick={() => onOpenTxn && onOpenTxn(a.t)} style={{ display: "flex", gap: 8, padding: "5px 0", fontSize: 12, color: T.text, cursor: onOpenTxn ? "pointer" : "default" }}><span style={{ width: 46, color: T.sub, flexShrink: 0 }}>{a.date.slice(8, 10)}-{a.date.slice(5, 7)}</span><span style={{ flex: 1, minWidth: 0, wordBreak: "break-word" }}>{a.description}</span><span style={{ fontWeight: 700, flexShrink: 0 }}>{a.signedPaise < 0 ? "−" : "+"}{m(a.signedPaise)}</span></div>)}
                <div style={{ color: T.sub, fontSize: 11, marginTop: 4 }}>These may not have cleared yet, may be dated differently, or may be entered twice.</div>
              </div>)}
            </div>
          )}
          <button data-testid="stmt-download" onClick={download} style={{ width: "100%", boxSizing: "border-box", minHeight: 48, marginTop: 14, background: "none", border: `1px solid ${T.border}`, borderRadius: 12, color: T.text, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>⬇ Download as CSV</button>
        </>)}
      </div>
    </BottomSheet>
  );
}
