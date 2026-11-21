import React, { useState } from "react";
import BottomSheet from "./BottomSheet";
import { RADIUS, TOUCH, FONT } from "../constants/theme";

// "Make this a loan" on an older entry where one person owes the whole amount (domain/loans/collectToLoan.js). It shows exactly what will change BEFORE anything is saved:
// the entry stops being spending, how much has already been paid back, and what is still owed. It asks only for the optional return date and yearly interest.
export default function MakeLoanSheet({ T, sym, fmt, name, preview, dateLabel, catLabel, monthLabel, onConfirm, onClose }) {
  const [dueDate, setDueDate] = useState("");
  const [rate, setRate] = useState("");
  const [error, setError] = useState("");
  const lbl = { color: T.sub, fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", margin: "14px 0 6px", display: "block" };
  const input = { width: "100%", boxSizing: "border-box", minHeight: TOUCH.min, borderRadius: RADIUS.md, border: `1px solid ${T.border}`, background: T.input, color: T.text, padding: "0 14px", fontSize: 16, fontFamily: FONT.sans };
  const row = { display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, padding: "4px 0" };
  const go = () => { const msg = onConfirm({ dueDate, interestRate: rate }); if (msg) setError(msg); };
  return (
    <BottomSheet onClose={onClose} T={T} maxHeight="92vh">
      <div data-testid="make-loan-sheet">
        <div style={{ color: T.text, fontSize: 18, fontWeight: 900 }}>🤝 Make this a loan</div>
        <div style={{ color: T.sub, fontSize: 12, marginTop: 4 }}>This entry becomes money you lent to {name}. Your account balance does not change.</div>

        <div style={{ background: T.input, borderRadius: 12, padding: "10px 14px", marginTop: 14 }}>
          <div style={row}><span style={{ color: T.sub }}>Lent on</span><b style={{ color: T.text }}>{dateLabel} (the original date)</b></div>
          <div style={row}><span style={{ color: T.sub }}>Amount</span><b data-testid="make-loan-principal" style={{ color: T.text }}>{sym}{fmt(preview.principal)}</b></div>
          <div style={row}><span style={{ color: T.sub }}>Already paid back</span><b data-testid="make-loan-paid" style={{ color: T.text }}>{sym}{fmt(preview.paid)}</b></div>
          <div style={row}><span style={{ color: T.sub }}>Still owed to you</span><b data-testid="make-loan-outstanding" style={{ color: T.accent }}>{sym}{fmt(preview.outstanding)}</b></div>
        </div>
        {preview.spendDrop.amount > 0
          ? <div data-testid="make-loan-spend" style={{ color: T.warn, fontSize: 12, fontWeight: 700, marginTop: 10 }}>It stops counting as spending: {sym}{fmt(preview.spendDrop.amount)} comes off {catLabel || "your spending"} in {monthLabel}.</div>
          : <div data-testid="make-loan-spend" style={{ color: T.success, fontSize: 12, fontWeight: 700, marginTop: 10 }}>Your spending does not change. This entry already counted as money owed to you, not as yours.</div>}
        {preview.receipts.length > 0 && <div style={{ color: T.sub, fontSize: 11, marginTop: 6 }}>{preview.receipts.length} repayment{preview.receipts.length === 1 ? "" : "s"} you recorded become money received on the loan.</div>}
        {preview.unrecorded > 0 && <div style={{ color: T.sub, fontSize: 11, marginTop: 6 }}>{sym}{fmt(preview.unrecorded)} shown as paid with no receipt is added to the loan as a repayment, with no money entry.</div>}

        <span style={lbl}>Expected back (optional)</span>
        <input data-testid="make-loan-due" type="date" min={preview.spendDrop.date} value={dueDate} onChange={e => { setDueDate(e.target.value); setError(""); }} style={input} />
        <span style={lbl}>Interest a year, percent (optional)</span>
        <input data-testid="make-loan-rate" inputMode="decimal" placeholder="0" value={rate} onChange={e => { setRate(e.target.value.replace(/[^0-9.]/g, "")); setError(""); }} style={input} />
        <div style={{ color: T.sub, fontSize: 11, marginTop: 6 }}>Interest is a reminder only. It is not added to what {name} owes.</div>

        {error && <div role="alert" data-testid="make-loan-error" style={{ marginTop: 12, background: T.danger + "18", border: `1px solid ${T.danger}33`, borderRadius: 10, padding: "10px 12px", color: T.danger, fontSize: 12, fontWeight: 700 }}>{error}</div>}
        <button data-testid="make-loan-confirm" onClick={go} style={{ width: "100%", minHeight: TOUCH.min, marginTop: 18, borderRadius: RADIUS.md, border: "none", background: T.accent, color: T.accentInk || "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer", fontFamily: FONT.sans }}>Make it a loan</button>
        <button onClick={onClose} style={{ width: "100%", minHeight: TOUCH.min, marginTop: 8, borderRadius: RADIUS.md, border: `1px solid ${T.border}`, background: "none", color: T.text, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FONT.sans }}>Cancel</button>
      </div>
    </BottomSheet>
  );
}
