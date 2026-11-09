import React, { useMemo, useState } from "react";
import BottomSheet from "./BottomSheet";
import { RADIUS, FONT } from "../constants/theme";
import { GAP_LABELS } from "../domain/transactions/completeness";

// Every expense that is missing a category, a sub-category, or a person/group. Tapping one opens it for editing (old entries included).
// Entries leave this list the moment they are complete. Nothing is changed from here.
const PAGE = 60;
export default function NeedsDetailsSheet({ T, sym, fmt, summary, onOpen, onClose }) {
  const [filter, setFilter] = useState("all");      // all | category | subcategory | owner
  const [shown, setShown] = useState(PAGE);
  const rows = useMemo(() => summary.items.filter(i => filter === "all" || i.gaps.includes(filter)), [summary, filter]);
  const chip = on => ({ border: `1px solid ${on ? T.accent : T.border}`, background: on ? T.accent + "22" : T.pill, color: on ? T.accent : T.text, borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: FONT.sans });
  const filters = [["all", `All ${summary.total}`], ["category", `${GAP_LABELS.category} ${summary.byGap.category}`], ["subcategory", `${GAP_LABELS.subcategory} ${summary.byGap.subcategory}`], ["owner", `${GAP_LABELS.owner} ${summary.byGap.owner}`]];
  return (
    <BottomSheet onClose={onClose} T={T} maxHeight="92vh">
      <div data-testid="needs-details-sheet">
        <div style={{ color: T.text, fontSize: 18, fontWeight: 900 }}>❓ Needs details</div>
        <div style={{ color: T.sub, fontSize: 12, margin: "4px 0 12px" }}>
          {summary.total} expense{summary.total === 1 ? "" : "s"} · {sym}{fmt(summary.amount)}. Each needs a category, a sub-category and a person or group (vehicle costs need only the first two). Tap one to fill it in.
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {filters.map(([k, label]) => <button key={k} data-testid={`needs-filter-${k}`} onClick={() => { setFilter(k); setShown(PAGE); }} style={chip(filter === k)}>{label}</button>)}
        </div>
        {rows.length === 0 && <div data-testid="needs-empty" style={{ color: T.sub, fontSize: 13, padding: "18px 0", textAlign: "center" }}>Nothing missing here. 🎉</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.slice(0, shown).map(({ txn, gaps }) => (
            <button key={txn.id} data-testid={`needs-row-${txn.id}`} onClick={() => onOpen(txn)} style={{ textAlign: "left", background: T.input, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: "10px 12px", cursor: "pointer", fontFamily: FONT.sans, color: T.text }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{txn.merchant || txn.desc || txn.note || "Expense"}</span>
                <span style={{ fontSize: 14, fontWeight: 800 }}>{sym}{fmt(txn.amount)}</span>
              </div>
              <div style={{ color: T.sub, fontSize: 11, margin: "2px 0 6px" }}>{txn.date}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {gaps.map(g => <span key={g} style={{ background: T.warn + "22", color: T.warn, borderRadius: 20, padding: "2px 9px", fontSize: 10, fontWeight: 800 }}>❓ {GAP_LABELS[g]}</span>)}
              </div>
            </button>
          ))}
        </div>
        {rows.length > shown && <button data-testid="needs-more" onClick={() => setShown(n => n + PAGE)} style={{ ...chip(false), width: "100%", marginTop: 10, padding: "10px" }}>Show {Math.min(PAGE, rows.length - shown)} more</button>}
      </div>
    </BottomSheet>
  );
}
