import React, { useState } from "react";
import BottomSheet from "./BottomSheet";
import { RADIUS, TOUCH, FONT } from "../constants/theme";
import { buildLoanGiven } from "../domain/loans/loanGiven";

// "Loan given": money lent to a friend. It asks WHO and HOW MUCH, and which of the person's own accounts it left (or none).
// It never asks for a destination account: the money went to someone else. Saves the loan (a receivable) and, if it left an account, the
// money-out entry. Opened from the Add Transaction screen's "Loan given" chip with the amount and date already typed there.
export default function LoanGivenSheet({ T, sym, fmt, people, accounts, defaults, genId, onSave, onClose }) {
  const [personId, setPersonId] = useState(defaults.personId || "");
  const [otherName, setOtherName] = useState("");
  const [amount, setAmount] = useState(defaults.amount ? String(defaults.amount) : "");
  const [date, setDate] = useState(defaults.date);
  const [fromAccId, setFromAccId] = useState(defaults.fromAccId || "");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const person = people.find(p => p.id === personId);
  const lbl = { color: T.sub, fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", margin: "14px 0 6px", display: "block" };
  const input = { width: "100%", boxSizing: "border-box", minHeight: TOUCH.min, borderRadius: RADIUS.md, border: `1px solid ${T.border}`, background: T.input, color: T.text, padding: "0 14px", fontSize: 16, fontFamily: FONT.sans };
  const chip = on => ({ border: `1px solid ${on ? T.accent : T.border}`, background: on ? T.accent + "22" : T.pill, color: on ? T.accent : T.text, borderRadius: 20, padding: "8px 12px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: FONT.sans });

  const save = () => {
    const r = buildLoanGiven({ personId, personName: person ? person.name : otherName, amount, date, fromAccId, note, genId });
    if (!r.ok) { setError(r.error); return; }
    onSave(r);
  };
  return (
    <BottomSheet onClose={onClose} T={T} maxHeight="92vh">
      <div data-testid="loan-given-sheet">
        <div style={{ color: T.text, fontSize: 18, fontWeight: 900 }}>🤝 Loan given</div>
        <div style={{ color: T.sub, fontSize: 12, marginTop: 4 }}>Money you lent to someone. It is tracked as money they owe you, not as spending and not as a transfer between your accounts.</div>

        <span style={lbl}>Lent to</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {people.map(p => <button key={p.id} data-testid={`loan-given-person-${p.id}`} onClick={() => { setPersonId(personId === p.id ? "" : p.id); setError(""); }} style={chip(personId === p.id)}>👤 {p.name}</button>)}
        </div>
        {!personId && <input data-testid="loan-given-name" value={otherName} onChange={e => { setOtherName(e.target.value); setError(""); }} placeholder="Or type a name" style={{ ...input, marginTop: 8 }} />}

        <span style={lbl}>Amount ({sym})</span>
        <input data-testid="loan-given-amount" inputMode="decimal" value={amount} onChange={e => { setAmount(e.target.value.replace(/[^0-9.]/g, "")); setError(""); }} placeholder="0" style={{ ...input, fontWeight: 800 }} />

        <span style={lbl}>Date</span>
        <input data-testid="loan-given-date" type="date" value={date} onChange={e => setDate(e.target.value)} style={input} />

        <span style={lbl}>Paid from</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button data-testid="loan-given-from-none" onClick={() => setFromAccId("")} style={chip(!fromAccId)}>Not from an account</button>
          {accounts.map(a => <button key={a.id} data-testid={`loan-given-from-${a.id}`} onClick={() => setFromAccId(a.id)} style={chip(fromAccId === a.id)}>{a.name}</button>)}
        </div>
        <div style={{ color: T.sub, fontSize: 11, marginTop: 6 }}>{fromAccId ? "This amount is taken out of that account when you save." : "Nothing is taken out of any balance (cash, or already recorded)."}</div>

        <span style={lbl}>Note (optional)</span>
        <input data-testid="loan-given-note" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. for rent" style={input} />

        {error && <div role="alert" data-testid="loan-given-error" style={{ marginTop: 12, background: T.danger + "18", border: `1px solid ${T.danger}33`, borderRadius: 10, padding: "10px 12px", color: T.danger, fontSize: 12, fontWeight: 700 }}>{error}</div>}
        <button data-testid="loan-given-save" onClick={save} style={{ width: "100%", minHeight: TOUCH.min, marginTop: 18, borderRadius: RADIUS.md, border: "none", background: T.accent, color: T.accentInk || "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer", fontFamily: FONT.sans }}>
          Save loan{Number(amount) > 0 ? ` of ${sym}${fmt(Number(amount))}` : ""}
        </button>
      </div>
    </BottomSheet>
  );
}
