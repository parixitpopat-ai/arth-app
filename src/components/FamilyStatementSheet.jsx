// A family's (a group's) statement: one total to ask for, who owes what, and each member's own statement underneath. Reads only; never changes a record.
// Everything comes from domain/person/personStatement.js (buildFamilyStatement); the message from statementMessage.js (buildFamilyMessage).
import { useMemo, useState } from "react";
import BottomSheet from "./BottomSheet";
import StatementPreview from "./StatementPreview";
import { buildFamilyStatement } from "../domain/person/personStatement";
import StatementSelection from "./StatementSelection";
import { buildFamilyMessage, shortDate, familyLines, buildSimpleMessage } from "../domain/person/statementMessage";

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function presets(todayIso) {
  const [y, m] = [+todayIso.slice(0, 4), +todayIso.slice(5, 7) - 1];
  const fyY = m >= 3 ? y : y - 1;
  return { month: { label: "This month", from: iso(new Date(y, m, 1)), to: todayIso }, last: { label: "Last month", from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) },
    fy: { label: "This financial year", from: `${fyY}-04-01`, to: todayIso }, all: { label: "Everything", from: "2000-01-01", to: todayIso } };
}

export default function FamilyStatementSheet({ T, sym = "₹", fmt = n => Number(n).toFixed(2), group, people = [], txns = [], bills = [], billerAccounts = [], upiHandle = "", meId, onClose }) {
  const today = useMemo(() => iso(new Date()), []);
  const P = useMemo(() => presets(today), [today]);
  const [preset, setPreset] = useState("fy");
  const [from, setFrom] = useState(P.fy.from), [to, setTo] = useState(P.fy.to);
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("simple");            // "simple": Member: Item - amount lines you tick, then a total | "full": the family statement
  const [overrides, setOverrides] = useState({});
  const nameOf = id => (people.find(p => String(p.id) === String(id)) || {}).name || "someone";
  const labelOf = c => { const ba = billerAccounts.find(b => String(b.id) === String(c.billerAccountId)); return (ba && ba.type) || (c.billId ? "Bills" : "Own expenses"); };
  const memberIds = useMemo(() => (group.members || []).filter(id => String(id) !== String(meId) && id !== "__me__"), [group.members, meId]);
  const money = n => `${sym}${fmt(Math.abs(n))}`;
  const fam = useMemo(() => (from && to && from <= to && memberIds.length ? buildFamilyStatement({ memberIds, groupId: group.id, txns, bills, billerAccounts, from, to, nameOf, labelOf }) : null), [memberIds, group.id, txns, bills, from, to, people, billerAccounts]);   // eslint-disable-line react-hooks/exhaustive-deps
  const lines = useMemo(() => (fam ? familyLines(fam, nameOf) : []), [fam]);   // eslint-disable-line react-hooks/exhaustive-deps
  const isOn = l => (l.key in overrides ? overrides[l.key] : l.ticked);
  const simpleMessage = buildSimpleMessage(lines.map(l => ({ ...l, on: isOn(l) })), { upiHandle, withNames: true });
  const message = !fam ? "" : mode === "simple" ? simpleMessage : buildFamilyMessage(fam, { groupName: group.name, nameOf, sym, fmt, upiHandle });
  const owed = fam ? fam.closing : 0;
  const choose = id => { setPreset(id); setFrom(P[id].from); setTo(P[id].to); setStatus(""); setOverrides({}); };
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: `Statement for the ${group.name} family`, text: message }); setStatus(""); }
      else { await navigator.clipboard.writeText(message); setStatus("Copied. Paste it into a message."); }
    } catch (e) { if (!e || e.name !== "AbortError") setStatus("Could not share. Use Copy instead."); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(message); setStatus("Copied. Paste it into a message."); } catch (e) { setStatus("Could not copy. Select the message and copy it."); } };
  const sub = { color: T.sub, fontSize: 11 }, line = { display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0" };
  const chip = on => ({ border: `1px solid ${on ? T.accent : T.border}`, background: on ? T.accent + "22" : "none", color: on ? T.accent : T.sub, borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Inter,sans-serif" });
  const inp = { background: T.input, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, padding: "9px 10px", fontSize: 13, fontFamily: "Inter,sans-serif", width: "100%" };
  const active = fam ? fam.members.filter(m => m.sections.length || m.payments.length || Math.abs(m.opening) > 0.004) : [];

  return (
    <BottomSheet onClose={onClose} T={T} maxHeight="92vh">
      <div data-testid="family-statement-sheet">
        <div style={{ color: T.text, fontSize: 18, fontWeight: 900 }}>Statement · {group.name}</div>
        <div style={{ ...sub, marginBottom: 10 }}>The whole family in one: each member's shares and the repayments you recorded. Nothing is changed.</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {Object.entries(P).map(([id, p]) => <button key={id} type="button" data-testid={`fam-preset-${id}`} style={chip(preset === id)} onClick={() => choose(id)}>{p.label}</button>)}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <label style={{ flex: 1 }}><span style={sub}>From</span><input data-testid="fam-from" type="date" style={inp} value={from} max={to || undefined} onChange={e => { setFrom(e.target.value); setPreset("custom"); setStatus(""); setOverrides({}); }} /></label>
          <label style={{ flex: 1 }}><span style={sub}>Until</span><input data-testid="fam-to" type="date" style={inp} value={to} min={from || undefined} onChange={e => { setTo(e.target.value); setPreset("custom"); setStatus(""); setOverrides({}); }} /></label>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <button type="button" data-testid="fam-mode-simple" style={chip(mode === "simple")} onClick={() => { setMode("simple"); setStatus(""); }}>Simple list</button>
          <button type="button" data-testid="fam-mode-full" style={chip(mode === "full")} onClick={() => { setMode("full"); setStatus(""); }}>Full statement</button>
        </div>
        {fam && mode === "simple" && <StatementSelection T={T} sym={sym} fmt={fmt} lines={lines} isOn={isOn} withNames testPrefix="famsel" onToggle={(l, on) => setOverrides(o => ({ ...o, [l.key]: on }))}
          onAll={() => setOverrides(Object.fromEntries(lines.map(l => [l.key, true])))} onNone={() => setOverrides(Object.fromEntries(lines.map(l => [l.key, false])))} />}
        {!memberIds.length ? <div data-testid="fam-no-members" style={{ color: T.warn, fontSize: 13 }}>This group has no members besides you, so there is no one to ask.</div>
          : !fam ? <div data-testid="fam-bad-range" style={{ color: T.warn, fontSize: 13 }}>Choose a start date that is not after the end date.</div> : <>
          {mode === "full" && <div data-testid="fam-summary" style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12 }}>
            <div style={{ color: T.text, fontSize: 14, fontWeight: 800 }}>{group.name} family</div>
            <div style={sub}>Statement from {shortDate(fam.from, true)} until {shortDate(fam.to, true)}</div>
            {Math.abs(fam.opening) > 0.004 && <div style={line}><span style={{ color: T.text, fontSize: 13 }}>Brought forward</span><span style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{fam.opening < 0 ? "−" : ""}{money(fam.opening)}</span></div>}
            <div style={line}><span style={{ color: T.text, fontSize: 13 }}>Charges</span><span data-testid="fam-charges" style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{money(fam.chargesTotal)}</span></div>
            {fam.movedTotal > 0 && <div style={line}><span style={{ color: T.text, fontSize: 13 }}>Moved to someone outside the family</span><span style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>−{money(fam.movedTotal)}</span></div>}
            <div style={line}><span style={{ color: T.text, fontSize: 13 }}>Paid by the family</span><span data-testid="fam-paid" style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>−{money(fam.paymentsTotal)}</span></div>
            <div data-testid="fam-balance" style={{ ...line, background: T.accent + "18", borderRadius: 10, padding: "10px 10px", marginTop: 6 }}>
              <span style={{ color: T.text, fontSize: 14, fontWeight: 800 }}>{owed < -0.004 ? "Credit in their favour" : Math.abs(owed) < 0.005 ? "Settled" : "Balance due"}</span>
              <span style={{ color: T.text, fontSize: 14, fontWeight: 900 }}>{Math.abs(owed) < 0.005 ? "✓" : money(owed)}</span>
            </div>
            <div style={{ ...sub, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 10, borderBottom: `1px solid ${T.border}`, paddingBottom: 3 }}>By person</div>
            {fam.members.map(m => (
              <div key={String(m.personId)} data-testid="fam-person" style={line}>
                <span style={{ color: T.text, fontSize: 13 }}>{nameOf(m.personId)}</span>
                <span style={{ color: Math.abs(m.closing) < 0.005 ? T.success : T.text, fontSize: 13, fontWeight: 700 }}>{Math.abs(m.closing) < 0.005 ? "Settled" : m.closing < 0 ? `Credit ${money(m.closing)}` : money(m.closing)}</span>
              </div>
            ))}
            {fam.unapplied.length > 0 && <div data-testid="fam-unapplied" style={{ color: T.warn, fontSize: 12, marginTop: 8 }}>⚠ {money(fam.unapplied.reduce((s, u) => s + u.amount, 0))} paid by the family is not applied to any member, so it is not in anyone's balance above.</div>}
          </div>}
          {mode === "full" && active.map(m => (
            <details key={String(m.personId)} data-testid="fam-member" style={{ marginTop: 10 }}>
              <summary style={{ color: T.accent, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{nameOf(m.personId)}'s statement</summary>
              <div style={{ marginTop: 6 }}><StatementPreview T={T} sym={sym} fmt={fmt} st={m} name={nameOf(m.personId)} nameOf={nameOf} /></div>
            </details>
          ))}
          <div style={{ ...sub, marginTop: 12 }}>Message that will be shared</div>
          {!message && <div data-testid="fam-none-ticked" style={{ color: T.warn, fontSize: 13, margin: "4px 0 10px" }}>Tick at least one item to send.</div>}
          {message && <pre data-testid="fam-message" style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: 10, padding: 10, color: T.text, fontSize: 12, whiteSpace: "pre-wrap", margin: "4px 0 10px", fontFamily: "inherit" }}>{message}</pre>}
          {!upiHandle && <div style={{ ...sub, marginBottom: 8 }}>No UPI handle is saved, so the message has no "Pay to" line.</div>}
          {message && <div style={{ display: "flex", gap: 8 }}>
            <button type="button" data-testid="fam-share" onClick={share} style={{ flex: 1, background: T.accent, color: "#fff", border: "none", borderRadius: 12, padding: "12px", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "Inter,sans-serif" }}>{owed > 0.004 ? `Request ${money(owed)} from the family` : "Share"}</button>
            <button type="button" data-testid="fam-copy" onClick={copy} style={{ background: "none", color: T.text, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 16px", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "Inter,sans-serif" }}>Copy</button>
          </div>}
          {status && <div data-testid="fam-status" style={{ ...sub, marginTop: 8 }}>{status}</div>}
        </>}
      </div>
    </BottomSheet>
  );
}
