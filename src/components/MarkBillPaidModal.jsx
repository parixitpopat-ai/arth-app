import React, { useState } from "react";
import BottomSheet from "./BottomSheet";
import { RADIUS, TOUCH, FONT } from "../constants/theme";

// Fixes 3 confirmed gaps in the old one-tap "Mark as Paid" flow: it silently guessed the paying
// account (first non-CC account, never asked), never collected a payment/bank reference at all,
// and dropped the biller's person attribution onto the created transaction. This sheet asks for
// the two things that genuinely need a human decision (account, optional reference) before the
// transaction is created — the attribution carry-over itself needs no UI, it's just a bug fix in
// the caller (App.jsx passes the biller account's attributedTo straight through now).
export default function MarkBillPaidModal({ bill, accounts, defaultAccId, T, sym, fmt, formatShortDate, onClose, onConfirm }) {
  const [accId, setAccId] = useState(defaultAccId || "");
  const [transactionRef, setTransactionRef] = useState("");

  const eligibleAccounts = (accounts || []).filter(a => a.type !== "cc");
  const lbl = { color: T.sub, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" };
  const inp = { width: "100%", boxSizing: "border-box", minHeight: TOUCH.min, background: T.input, border: `1px solid ${T.borderStrong}`, borderRadius: RADIUS.md, padding: "0 12px", color: T.text, fontSize: 15, fontFamily: FONT.sans, marginTop: 6 };

  return (
    <BottomSheet onClose={onClose} T={T} maxHeight="70vh">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ color: T.text, fontSize: 16, fontWeight: 900 }}>Mark as Paid</div>
        <button onClick={onClose} style={{ background: T.pill, border: "none", color: T.sub, borderRadius: 8, padding: "5px 11px", cursor: "pointer", fontSize: 16, fontFamily: FONT.sans }}>✕</button>
      </div>

      <div style={{ background: T.input, borderRadius: RADIUS.lg, padding: 14, marginBottom: 14, textAlign: "center" }}>
        <div style={{ color: T.sub, fontSize: 11 }}>{bill.name}</div>
        <div style={{ color: T.text, fontSize: 22, fontWeight: 900, marginTop: 2 }}>{sym}{fmt(bill.amount)}</div>
        {bill.dueDate && <div style={{ color: T.sub, fontSize: 11, marginTop: 4 }}>Due {formatShortDate(bill.dueDate) || bill.dueDate}</div>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <span style={lbl}>Paid from</span>
          <select value={accId} onChange={e => setAccId(e.target.value)} style={inp}>
            <option value="">Select an account…</option>
            {eligibleAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <span style={lbl}>Payment reference · optional</span>
          <input value={transactionRef} onChange={e => setTransactionRef(e.target.value.toUpperCase())} placeholder="e.g. UPI / bank reference" style={inp} />
        </div>
      </div>

      <button
        onClick={() => onConfirm(accId, transactionRef.trim())}
        disabled={!accId}
        style={{ marginTop: 16, width: "100%", minHeight: TOUCH.min, background: accId ? T.accent : T.border, border: "none", borderRadius: RADIUS.md, color: "#fff", fontWeight: 700, fontSize: 15, cursor: accId ? "pointer" : "not-allowed", fontFamily: FONT.sans }}
      >
        Confirm payment
      </button>
    </BottomSheet>
  );
}
