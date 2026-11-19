// A person's statement from one date to another: preview, and a short message to share. Reads only: it never changes any record.
// All figures come from domain/person/personStatement.js (the same shares and repayments the person's page uses); the message from statementMessage.js.
import { useMemo, useState } from "react";
import BottomSheet from "./BottomSheet";
import StatementPreview from "./StatementPreview";
import { buildPersonStatement, reconcileWithPosition } from "../domain/person/personStatement";
import { buildStatementMessage } from "../domain/person/statementMessage";

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function presets(todayIso) {
  const [y, m] = [+todayIso.slice(0, 4), +todayIso.slice(5, 7) - 1];
  const fyY = m >= 3 ? y : y - 1;
  return {
    month: { label: "This month", from: iso(new Date(y, m, 1)), to: todayIso },
    last: { label: "Last month", from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) },
    fy: { label: "This financial year", from: `${fyY}-04-01`, to: todayIso },
    all: { label: "Everything", from: "2000-01-01", to: todayIso },
  };
}

export default function PersonStatementSheet({ T, sym = "₹", fmt = n => Number(n).toFixed(2), person, people = [], txns = [], bills = [], billerAccounts = [], upiHandle = "", meId, onClose }) {
  const today = useMemo(() => iso(new Date()), []);
  const P = useMemo(() => presets(today), [today]);
  const [preset, setPreset] = useState("fy");
  const [from, setFrom] = useState(P.fy.from), [to, setTo] = useState(P.fy.to);
  const [status, setStatus] = useState("");
  const nameOf = id => (people.find(p => String(p.id) === String(id)) || {}).name || "someone";
  const labelOf = c => { const ba = billerAccounts.find(b => String(b.id) === String(c.billerAccountId)); return (ba && ba.type) || (c.billId ? "Bills" : "Own expenses"); };
  const money = n => `${sym}${fmt(Math.abs(n))}`;
  const st = useMemo(() => (from && to && from <= to ? buildPersonStatement({ personId: person.id, txns, bills, from, to, nameOf, labelOf }) : null), [person.id, txns, bills, from, to, people, billerAccounts]);   // eslint-disable-line react-hooks/exhaustive-deps
  const recon = useMemo(() => (st && to >= today ? reconcileWithPosition(st, { txns, bills, meId }) : null), [st, to, today, txns, bills, meId]);
  const message = st ? buildStatementMessage(st, { name: person.name, sym, fmt, upiHandle }) : "";
  const choose = id => { setPreset(id); setFrom(P[id].from); setTo(P[id].to); setStatus(""); };
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: `Statement for ${person.name}`, text: message }); setStatus(""); }
      else { await navigator.clipboard.writeText(message); setStatus("Copied. Paste it into a message."); }
    } catch (e) { if (!e || e.name !== "AbortError") setStatus("Could not share. Use Copy instead."); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(message); setStatus("Copied. Paste it into a message."); } catch (e) { setStatus("Could not copy. Select the message and copy it."); } };

  const sub = { color: T.sub, fontSize: 11 };
  const chip = on => ({ border: `1px solid ${on ? T.accent : T.border}`, background: on ? T.accent + "22" : "none", color: on ? T.accent : T.sub, borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito,sans-serif" });
  const inp = { background: T.input, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, padding: "9px 10px", fontSize: 13, fontFamily: "Nunito,sans-serif", width: "100%" };

  return (
    <BottomSheet onClose={onClose} T={T} maxHeight="92vh">
      <div data-testid="person-statement-sheet">
        <div style={{ color: T.text, fontSize: 18, fontWeight: 900 }}>Statement · {person.name}</div>
        <div style={{ ...sub, marginBottom: 10 }}>Built from this person's shares and the repayments you recorded. Nothing is changed.</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {Object.entries(P).map(([id, p]) => <button key={id} type="button" data-testid={`stmt-preset-${id}`} style={chip(preset === id)} onClick={() => choose(id)}>{p.label}</button>)}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <label style={{ flex: 1 }}><span style={sub}>From</span><input data-testid="stmt-from" type="date" style={inp} value={from} max={to || undefined} onChange={e => { setFrom(e.target.value); setPreset("custom"); setStatus(""); }} /></label>
          <label style={{ flex: 1 }}><span style={sub}>Until</span><input data-testid="stmt-to" type="date" style={inp} value={to} min={from || undefined} onChange={e => { setTo(e.target.value); setPreset("custom"); setStatus(""); }} /></label>
        </div>
        {!st ? <div data-testid="stmt-bad-range" style={{ color: T.warn, fontSize: 13 }}>Choose a start date that is not after the end date.</div> : (
          <StatementPreview T={T} sym={sym} fmt={fmt} st={st} name={person.name} nameOf={nameOf}>
            {recon && !recon.matches && <div data-testid="stmt-mismatch" style={{ color: T.warn, fontSize: 12, marginTop: 8 }}>⚠ This differs from the balance on {person.name}'s page by {money(recon.difference)}. Check recent settlements before sending.</div>}
          </StatementPreview>
        )}
        {st && <>
          <div style={{ ...sub, marginTop: 12 }}>Message that will be shared</div>
          <pre data-testid="stmt-message" style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: 10, padding: 10, color: T.text, fontSize: 12, whiteSpace: "pre-wrap", margin: "4px 0 10px", fontFamily: "inherit" }}>{message}</pre>
          {!upiHandle && <div style={{ ...sub, marginBottom: 8 }}>No UPI handle is saved, so the message has no "Pay to" line.</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" data-testid="stmt-share" onClick={share} style={{ flex: 1, background: T.accent, color: "#fff", border: "none", borderRadius: 12, padding: "12px", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "Nunito,sans-serif" }}>Share</button>
            <button type="button" data-testid="stmt-copy" onClick={copy} style={{ background: "none", color: T.text, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 16px", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "Nunito,sans-serif" }}>Copy</button>
          </div>
          {status && <div data-testid="stmt-status" style={{ ...sub, marginTop: 8 }}>{status}</div>}
        </>}
      </div>
    </BottomSheet>
  );
}
