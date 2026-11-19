// "Repayments not reflected": repayments from this person that are recorded but not reducing what they owe (see domain/person/repaymentCheck.js).
// Nothing is changed until the person confirms an item; the repayment's money is never touched; the last fix can be undone. State that must survive a redraw
// (the last applied fix and its undo) is held by the caller.
import { useMemo, useState } from "react";
import { findRepaymentProblems } from "../domain/person/repaymentCheck";
import { shortDate } from "../domain/person/statementMessage";

export default function RepaymentCheckCard({ T, sym = "₹", fmt = n => Number(n).toFixed(2), person, txns = [], bills = [], lastFix = null, onApply, onUndo }) {
  const found = useMemo(() => findRepaymentProblems({ personId: person.id, txns, bills }), [person.id, txns, bills]);
  const [pending, setPending] = useState(null);      // { fix, text } waiting for a confirm
  const [pick, setPick] = useState({});              // unlinked repayment key -> chosen item key
  const money = n => `${sym}${fmt(Math.abs(n))}`;
  const sub = { color: T.sub, fontSize: 11, lineHeight: 1.4 };
  const btn = (primary) => ({ border: primary ? "none" : `1px solid ${T.border}`, background: primary ? T.accent : "none", color: primary ? "#fff" : T.text, borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito,sans-serif" });
  const mine = lastFix && String(lastFix.personId) === String(person.id) ? lastFix : null;
  const total = found.unreduced.length + found.unlinked.length;
  if (!total && !mine) return null;

  const ask = (key, fix, text) => setPending({ key, fix, text });
  const confirm = () => { const p = pending; setPending(null); if (p) onApply(p.fix, p.text); };
  const confirmBox = key => pending && pending.key === key && (
    <div data-testid="rc-confirm" style={{ background: T.card, border: `1px solid ${T.accent}`, borderRadius: 10, padding: 10, marginTop: 8 }}>
      <div style={{ color: T.text, fontSize: 12, lineHeight: 1.45 }}>{pending.text}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}><button type="button" data-testid="rc-confirm-yes" style={btn(true)} onClick={confirm}>Confirm</button><button type="button" data-testid="rc-confirm-no" style={btn(false)} onClick={() => setPending(null)}>Cancel</button></div>
    </div>
  );

  return (
    <div data-testid="repayment-check" style={{ background: T.warn + "14", border: `1px solid ${T.warn}55`, borderRadius: 12, padding: 12, marginTop: 10 }}>
      {mine && <div data-testid="rc-done" style={{ background: T.success + "18", borderRadius: 10, padding: "8px 10px", marginBottom: total ? 10 : 0, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ color: T.text, fontSize: 12 }}>✓ {mine.text}</span>
        <button type="button" data-testid="rc-undo" style={btn(false)} onClick={() => onUndo(mine)}>Undo</button>
      </div>}
      {total > 0 && <>
        <div style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>⚠ Repayments from {person.name} not reflected ({total})</div>
        <div style={{ ...sub, marginBottom: 8 }}>Money you received from {person.name} is recorded, but it is not reducing the items below, so they still show as owed. Nothing changes until you confirm each one. The repayment itself is never changed.</div>
        {found.unreduced.map(u => (
          <div key={u.key} data-testid="rc-unreduced" style={{ borderTop: `1px solid ${T.border}`, padding: "8px 0" }}>
            <div style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{u.title}: {money(u.shareAmount)}</div>
            <div style={sub}>{u.repayments.map(r => `${money(r.amount)} on ${shortDate(r.date)}`).join(", ")} recorded against it, but it still shows {money(u.shareAmount - u.settledNow)} owed.</div>
            <button type="button" data-testid="rc-apply-unreduced" style={{ ...btn(true), marginTop: 6 }} onClick={() => ask(u.key, { type: "unreduced", personId: person.id, recordKind: u.recordKind, recordId: u.recordId, settleTo: u.settleTo }, `Mark ${money(u.diff)} of "${u.title}" as received. What ${person.name} owes you goes down by ${money(u.diff)}.`)}>Mark {money(u.diff)} as paid</button>
            {confirmBox(u.key)}
          </div>
        ))}
        {found.unlinked.map(u => {
          const chosenKey = pick[u.key] || (u.suggested ? `${u.suggested.kind}:${u.suggested.id}` : "");
          const chosen = u.candidates.find(c => `${c.kind}:${c.id}` === chosenKey) || null;
          const applyAmt = chosen ? Math.min(u.amount, chosen.remaining) : 0;
          return (
            <div key={u.key} data-testid="rc-unlinked" style={{ borderTop: `1px solid ${T.border}`, padding: "8px 0" }}>
              <div style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{money(u.amount)} received on {shortDate(u.date, true)}: {u.desc}</div>
              <div style={sub}>Not linked to any item.{u.suggested ? ` Same amount as “${u.suggested.title}” (${shortDate(u.suggested.date)}).` : u.ambiguous ? " Several items have this exact amount, so choose which one." : " No open item has exactly this amount."}</div>
              <select data-testid="rc-pick" value={chosenKey} onChange={e => setPick(p => ({ ...p, [u.key]: e.target.value }))} style={{ width: "100%", marginTop: 6, background: T.input, color: T.text, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 10px", fontSize: 13, fontFamily: "Nunito,sans-serif" }}>
                <option value="">Choose the item it paid…</option>
                {u.candidates.map(c => <option key={`${c.kind}:${c.id}`} value={`${c.kind}:${c.id}`}>{c.title} · {shortDate(c.date)} · owes {money(c.remaining)}</option>)}
              </select>
              <button type="button" data-testid="rc-apply-link" disabled={!chosen} style={{ ...btn(true), marginTop: 6, opacity: chosen ? 1 : 0.5 }}
                onClick={() => ask(u.key, { type: "link", personId: person.id, repaymentId: u.id, link: { kind: chosen.kind, id: chosen.id, amount: applyAmt, title: chosen.title } }, `Apply ${money(applyAmt)} of this repayment to “${chosen.title}” (it shows ${money(chosen.remaining)} owed, ${money(chosen.remaining - applyAmt)} after). What ${person.name} owes you goes down by ${money(applyAmt)}.${u.amount - applyAmt > 0.004 ? ` The other ${money(u.amount - applyAmt)} stays on the repayment as an advance.` : ""}`)}>Apply to this item</button>
              {confirmBox(u.key)}
            </div>
          );
        })}
      </>}
    </div>
  );
}
