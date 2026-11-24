// "Not a bill, it is a purchase": turn an unpaid one-off bill into an expense on an account (usually the credit card it was bought on).
// Rules and the refusal reasons live in domain/bills/billToTransaction.js. Nothing changes until "Make it a transaction" is tapped.
import { useState } from "react";
import BottomSheet from "../../components/BottomSheet";
import { RADIUS, FONT } from "../../constants/theme";

export default function ConvertBillSheet({ T, sym, fmt, bill, check, accounts, defaultAccId = "", onConvert, onClose }) {
  const [accId, setAccId] = useState(defaultAccId);
  const [date, setDate] = useState(String(bill.billDate || bill.createdDate || "").slice(0, 10));
  const ordered = [...accounts].sort((a, b) => (a.type === "cc" ? 0 : 1) - (b.type === "cc" ? 0 : 1));
  const canGo = check.ok && accId && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const input = { width: "100%", boxSizing: "border-box", minHeight: 44, borderRadius: RADIUS.md, border: `1px solid ${T.border}`, background: T.input, color: T.text, fontSize: 14, padding: "0 10px", fontFamily: FONT.sans };
  const lbl = { color: T.sub, fontSize: 11, fontWeight: 700, margin: "12px 0 4px", display: "block" };
  return (
    <BottomSheet T={T} onClose={onClose} maxHeight="88vh">
      <div data-testid="convert-bill-sheet" style={{ fontFamily: FONT.sans }}>
        <div style={{ color: T.text, fontSize: 17, fontWeight: 800 }}>Make it a transaction</div>
        <div style={{ color: T.sub, fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>For something you bought, not a bill you owe. It becomes an expense on the account you choose, and this bill is removed.</div>
        <div style={{ background: T.input, borderRadius: RADIUS.lg, padding: "12px 14px", marginTop: 14 }}>
          <div style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>{bill.name}</div>
          <div style={{ color: T.text, fontSize: 20, fontWeight: 800, marginTop: 2 }}>{sym}{fmt(bill.amount)}</div>
        </div>
        {!check.ok && <div data-testid="convert-bill-refused" style={{ color: T.warn, fontSize: 12, marginTop: 12, lineHeight: 1.5 }}>⚠ {check.reason}</div>}
        <span style={lbl}>Bought with (account or card) *</span>
        <select data-testid="convert-bill-account" style={input} value={accId} onChange={e => setAccId(e.target.value)} disabled={!check.ok}>
          <option value="">— Choose —</option>
          {ordered.map(a => <option key={a.id} value={a.id}>{a.name}{a.type === "cc" ? " (credit card)" : ""}</option>)}
        </select>
        <span style={lbl}>Date of purchase</span>
        <input data-testid="convert-bill-date" type="date" style={input} value={date} onChange={e => setDate(e.target.value)} disabled={!check.ok} />
        <div style={{ color: T.sub, fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>On a credit card this stays unpaid until you pay the card's statement. Who it is for is not carried over; set it on the transaction if you need it.</div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button data-testid="convert-bill-go" disabled={!canGo} onClick={() => onConvert(accId, date)} style={{ flex: 2, minHeight: 48, background: T.accent, border: "none", borderRadius: RADIUS.md, color: T.accentInk || "#fff", fontWeight: 800, fontSize: 14, opacity: canGo ? 1 : 0.5, cursor: canGo ? "pointer" : "default" }}>Make it a transaction</button>
          <button onClick={onClose} style={{ flex: 1, minHeight: 48, background: "none", border: `1px solid ${T.border}`, borderRadius: RADIUS.md, color: T.text, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </BottomSheet>
  );
}
