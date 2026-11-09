import React, { useState } from "react";
import BottomSheet from "./BottomSheet";
import { RADIUS, TOUCH, FONT } from "../constants/theme";
import { buildPettyCashTxn } from "../domain/person/pettyCash";

// "Petty cash": cash handed to a person to spend for you (the house, a trip, a project). No destination account (the money went to a person), not spending, not a loan.
// Opened from the Add Transaction screen's "Petty cash" choice (amount and date carried over) or from a person's page (person chosen).
// With `existing` it edits that entry (same id), so a petty-cash entry can be corrected without turning into a transfer form.
export default function PettyCashSheet({ T, sym, fmt, people, accounts, defaults = {}, existing = null, genId, onSave, onClose }) {
  const [personId, setPersonId] = useState(existing?.pettyCashPersonId || defaults.personId || "");
  const [amount, setAmount] = useState(existing ? String(existing.amount) : defaults.amount ? String(defaults.amount) : "");
  const [date, setDate] = useState(existing?.date || defaults.date);
  const [fromAccId, setFromAccId] = useState(existing ? (existing.fromAccId || "") : (defaults.fromAccId || ""));
  const [note, setNote] = useState(existing ? String(existing.note || "").replace(/^Money given to spend on my behalf(?: · )?/, "") : "");
  const [error, setError] = useState("");
  const lbl = { color: T.sub, fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", margin: "14px 0 6px", display: "block" };
  const input = { width: "100%", boxSizing: "border-box", minHeight: TOUCH.min, borderRadius: RADIUS.md, border: `1px solid ${T.border}`, background: T.input, color: T.text, padding: "0 14px", fontSize: 16, fontFamily: FONT.sans };
  const chip = on => ({ border: `1px solid ${on ? T.accent : T.border}`, background: on ? T.accent + "22" : T.pill, color: on ? T.accent : T.text, borderRadius: 20, padding: "8px 12px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: FONT.sans });

  const save = () => {
    const person = people.find(p => p.id === personId);
    if (!person) { setError("Choose who you gave the money to."); return; }
    const n = Math.round((parseFloat(amount) || 0) * 100) / 100;
    if (!(n > 0)) { setError("Enter the amount you gave."); return; }
    if (!date) { setError("Choose the date."); return; }
    const txn = buildPettyCashTxn({ personId, personName: person.name, fromAccId, amount: n, date, note, id: existing ? existing.id : genId(), now: existing?.createdAt || Date.now() });
    onSave({ txn, existing: Boolean(existing) });
  };
  return (
    <BottomSheet onClose={onClose} T={T} maxHeight="92vh">
      <div data-testid="petty-sheet">
        <div style={{ color: T.text, fontSize: 18, fontWeight: 900 }}>💼 {existing ? "Edit petty cash" : "Petty cash"}</div>
        <div style={{ color: T.sub, fontSize: 12, marginTop: 4 }}>
          Cash you give someone to spend for you (the house, a trip, a project) before any of it is spent. It is not spending and not a loan. Record what they buy as expenses "Paid by" them: those are paid from this petty cash first, and what is left stays with them as their petty cash.
        </div>

        <span style={lbl}>Given to</span>
        {people.length === 0
          ? <div style={{ color: T.warn, fontSize: 12, fontWeight: 700 }}>Add the person under People first.</div>
          : <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {people.map(p => <button key={p.id} data-testid={`petty-person-${p.id}`} onClick={() => { setPersonId(p.id); setError(""); }} style={chip(personId === p.id)}>👤 {p.name}</button>)}
            </div>}

        <span style={lbl}>Amount ({sym})</span>
        <input data-testid="petty-amount" inputMode="decimal" value={amount} onChange={e => { setAmount(e.target.value.replace(/[^0-9.]/g, "")); setError(""); }} placeholder="0" style={{ ...input, fontWeight: 800 }} />

        <span style={lbl}>Date</span>
        <input data-testid="petty-date" type="date" value={date} onChange={e => setDate(e.target.value)} style={input} />

        <span style={lbl}>Paid from</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button data-testid="petty-from-none" onClick={() => setFromAccId("")} style={chip(!fromAccId)}>Cash / not from an account</button>
          {accounts.map(a => <button key={a.id} data-testid={`petty-from-${a.id}`} onClick={() => setFromAccId(a.id)} style={chip(fromAccId === a.id)}>{a.name}</button>)}
        </div>
        <div style={{ color: T.sub, fontSize: 11, marginTop: 6 }}>{fromAccId ? "This amount is taken out of that account when you save." : "Nothing is taken out of any balance (cash you already hold, or already recorded)."}</div>

        <span style={lbl}>Note (optional)</span>
        <input data-testid="petty-note" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. household, Goa trip, site work" style={input} />

        {error && <div role="alert" data-testid="petty-error" style={{ marginTop: 12, background: T.danger + "18", border: `1px solid ${T.danger}33`, borderRadius: 10, padding: "10px 12px", color: T.danger, fontSize: 12, fontWeight: 700 }}>{error}</div>}
        <button data-testid="petty-save" onClick={save} style={{ width: "100%", minHeight: TOUCH.min, marginTop: 18, borderRadius: RADIUS.md, border: "none", background: T.accent, color: T.accentInk || "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer", fontFamily: FONT.sans }}>
          {existing ? "Save changes" : "Save petty cash"}{Number(amount) > 0 ? ` of ${sym}${fmt(Number(amount))}` : ""}
        </button>
      </div>
    </BottomSheet>
  );
}
