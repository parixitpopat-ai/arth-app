// A person's statement from one date to another: preview, and a short message to share. Reads only: it never changes any record.
// All figures come from domain/person/personStatement.js (the same shares and repayments the person's page uses); the message from statementMessage.js.
import { useMemo, useState } from "react";
import BottomSheet from "./BottomSheet";
import { buildPersonStatement, reconcileWithPosition } from "../domain/person/personStatement";
import { buildStatementMessage, shortDate, periodLabel } from "../domain/person/statementMessage";

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

  const sub = { color: T.sub, fontSize: 11 }, line = { display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0" };
  const chip = on => ({ border: `1px solid ${on ? T.accent : T.border}`, background: on ? T.accent + "22" : "none", color: on ? T.accent : T.sub, borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito,sans-serif" });
  const inp = { background: T.input, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, padding: "9px 10px", fontSize: 13, fontFamily: "Nunito,sans-serif", width: "100%" };
  const itemSub = it => [it.kind === "bill" ? `Bill ${shortDate(it.billDate)}` : shortDate(it.date), it.dueDate ? `due ${shortDate(it.dueDate)}` : "",
    it.moved > 0 ? `moved to ${nameOf(it.movedTo)}${it.movedOn ? ` on ${shortDate(it.movedOn)}` : ""}` : it.paid > 0 ? `paid ${money(it.paid)} · still due ${money(it.due)}` : it.due > 0 ? "not paid yet" : "paid"].filter(Boolean).join(" · ");

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
          <div data-testid="stmt-preview" style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12 }}>
            <div style={{ color: T.text, fontSize: 14, fontWeight: 800 }}>{person.name}</div>
            <div style={sub}>Statement from {shortDate(st.from, true)} until {shortDate(st.to, true)}</div>
            {Math.abs(st.opening) > 0.004 && <div style={{ ...line, borderBottom: `1px solid ${T.border}` }}><span style={{ color: T.text, fontSize: 13 }}>Brought forward</span><span style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{st.opening < 0 ? "−" : ""}{money(st.opening)}</span></div>}
            {st.sections.length === 0 && st.payments.length === 0 && <div data-testid="stmt-nothing" style={{ ...sub, padding: "10px 0" }}>Nothing to bill in this period.</div>}
            {st.sections.map(s => (
              <div key={s.label} data-testid="stmt-section">
                <div style={{ ...sub, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 10, borderBottom: `1px solid ${T.border}`, paddingBottom: 3 }}>{s.label}</div>
                {s.items.map((it, i) => (
                  <div key={`${it.kind}-${it.id}-${i}`} data-testid="stmt-item" style={line}>
                    <span style={{ minWidth: 0 }}><span style={{ color: T.text, fontSize: 13, display: "block" }}>{it.transferredFrom ? `Transferred from ${it.transferredFrom}` : it.title}{periodLabel(it.periodFrom, it.periodTo) ? `, ${periodLabel(it.periodFrom, it.periodTo)}` : ""}</span><span style={sub}>{itemSub(it)}</span></span>
                    <span style={{ color: T.text, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>{money(it.amount)}</span>
                  </div>
                ))}
              </div>
            ))}
            {st.sections.length > 0 && <div style={{ ...line, borderTop: `1px solid ${T.border}`, marginTop: 4 }}><span style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>Charges</span><span data-testid="stmt-charges" style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>{money(st.chargesTotal)}</span></div>}
            {st.movedTotal > 0 && <div data-testid="stmt-moved" style={line}><span style={{ color: T.text, fontSize: 13 }}>Moved to someone else</span><span style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>−{money(st.movedTotal)}</span></div>}
            {st.payments.length > 0 && <div style={{ ...sub, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 10, borderBottom: `1px solid ${T.border}`, paddingBottom: 3 }}>Payments applied to {person.name}</div>}
            {st.payments.map(p => (
              <div key={p.id} data-testid="stmt-payment" style={line}>
                <span style={{ minWidth: 0 }}><span style={{ color: T.text, fontSize: 13, display: "block" }}>{shortDate(p.date)}</span>
                  {p.applied.map((a, i) => <span key={i} style={{ ...sub, display: "block" }}>{a.noBill || a.advance ? a.title : `→ ${a.title}${a.billDate ? ` (bill ${shortDate(a.billDate)}${periodLabel(a.periodFrom, a.periodTo) ? `, ${periodLabel(a.periodFrom, a.periodTo)}` : ""})` : ""}`} {money(a.amount)}</span>)}</span>
                <span style={{ color: T.text, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>−{money(p.amount)}</span>
              </div>
            ))}
            <div data-testid="stmt-balance" style={{ ...line, background: T.accent + "18", borderRadius: 10, padding: "10px 10px", marginTop: 10 }}>
              <span style={{ color: T.text, fontSize: 14, fontWeight: 800 }}>{st.credit > 0 ? "Credit in their favour" : st.settled ? "Settled" : "Balance due"}</span>
              <span style={{ color: T.text, fontSize: 14, fontWeight: 900 }}>{st.settled ? "✓" : money(st.closing)}</span>
            </div>
            {recon && !recon.matches && <div data-testid="stmt-mismatch" style={{ color: T.warn, fontSize: 12, marginTop: 8 }}>⚠ This differs from the balance on {person.name}'s page by {money(recon.difference)}. Check recent settlements before sending.</div>}
          </div>
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
