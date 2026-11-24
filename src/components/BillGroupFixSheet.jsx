// Past payments linked to a bill whose group claim never reached them: tick, see before and after, fix. Nothing is written until "Fix". Presentational.
import { useState } from "react";
import BottomSheet from "./BottomSheet";

export default function BillGroupFixSheet({ T, sym = "₹", fmt = n => Number(n).toFixed(2), fixes = [], groups = [], onApply, onClose }) {
  const [on, setOn] = useState(() => new Set(fixes.map(f => String(f.txnId))));
  const gname = id => (groups.find(g => String(g.id) === String(id)) || {}).name || "a group";
  const m = n => `${sym}${fmt(n)}`;
  const toggle = id => setOn(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const sub = { color: T.sub, fontSize: 12 };
  const nowText = f => (f.now.groupId ? `in ${gname(f.now.groupId)}, but nothing to collect` : "no group, nothing to collect");
  const afterText = f => `${f.after.groupId ? gname(f.after.groupId) : "no group"}${f.after.collect > 0 ? ` · collect ${m(f.after.collect)}` : ""}${f.after.people ? ` · ${f.after.people} ${f.after.people === 1 ? "person" : "people"}` : ""}`;
  return <BottomSheet onClose={onClose} T={T}>
    <div data-testid="billfix-sheet">
      <div style={{ color: T.text, fontSize: 18, fontWeight: 900 }}>Linked payments missing the bill's group · {fixes.length}</div>
      <div style={{ ...sub, margin: "4px 0 10px" }}>These payments were linked to a bill, but the bill's group and amount to collect never reached them, so the group's balance may be short. Only entries with no group of their own, or a group with nothing to collect, are listed.</div>
      {fixes.length === 0 && <div style={{ ...sub, padding: "10px 0" }}>Nothing left to fix.</div>}
      {fixes.map(f => {
        const id = String(f.txnId);
        return <label key={id} data-testid="billfix-row" style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 0", borderBottom: `1px solid ${T.border}` }}>
          <input type="checkbox" checked={on.has(id)} onChange={() => toggle(id)} style={{ marginTop: 3 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ color: T.text, fontSize: 13, fontWeight: 700, display: "block" }}>{f.title}</span>
            <span style={{ ...sub, display: "block" }}>{f.date} · {m(f.amount)}</span>
            <span style={{ ...sub, display: "block", marginTop: 3 }}>Now: {nowText(f)}</span>
            <span style={{ color: T.success || T.accent, fontSize: 12, fontWeight: 700, display: "block" }}>After: {afterText(f)}</span>
          </span>
        </label>;
      })}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="button" data-testid="billfix-apply" disabled={!on.size} onClick={() => onApply([...on])} style={{ flex: 1, background: T.accent, color: T.accentInk, border: "none", borderRadius: 12, padding: "11px 12px", fontWeight: 800, fontSize: 13, cursor: on.size ? "pointer" : "default", opacity: on.size ? 1 : 0.5 }}>Fix {on.size} selected</button>
        <button type="button" data-testid="billfix-close" onClick={onClose} style={{ background: T.input, color: T.text, border: `1px solid ${T.border}`, borderRadius: 12, padding: "11px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Not now</button>
      </div>
    </div>
  </BottomSheet>;
}
