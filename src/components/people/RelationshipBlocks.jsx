import React from "react";
import { RADIUS, FONT } from "../../constants/theme";
import { SectionLabel } from "./peopleUi";
import { relationshipStatusText } from "./relationshipText";

// UI-2C P-4 / G-12 — the two shapes on Person and Group detail:
// relationships are a list (things managed for them, with Bill status),
// capabilities are tiles (features switched on). Different shapes keep
// the two from reading as one list.

const toneColor = (tone, T) => ({ negative: T.dangerText, attention: T.attention, positive: T.accent, muted: T.sub }[tone] || T.sub);

export function FinancialRelationships({ T, rows, sym, fmt, onOpen, onAdd, addLabel = "+ Add relationship" }) {
  return (
    <div data-testid="financial-relationships">
      <SectionLabel T={T}>Financial relationships</SectionLabel>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: RADIUS.lg || 16, padding: "4px 14px" }}>
        {rows.length === 0 ? <div style={{ color: T.sub, fontSize: 13, padding: "12px 0" }}>Nothing managed here yet.</div> : null}
        {rows.map(({ billerAccount: ba, state }) => {
          const st = relationshipStatusText(state, sym, fmt);
          return (
            <button key={ba.id} data-testid={`relationship-${ba.id}`} onClick={() => onOpen && onOpen(ba)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "none", border: "none", borderBottom: `1px solid ${T.border}`, padding: "12px 0", cursor: onOpen ? "pointer" : "default", textAlign: "left", fontFamily: FONT.sans }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", color: T.text, fontSize: 14, fontWeight: 600 }}>{ba.name}</span>
                {ba.type ? <span style={{ display: "block", color: T.sub, fontSize: 12, marginTop: 1 }}>{ba.type}</span> : null}
              </span>
              <span style={{ color: toneColor(st.tone, T), fontSize: 12, fontWeight: 600, textAlign: "right", fontFamily: FONT.mono }}>{st.text}</span>
            </button>
          );
        })}
        {onAdd ? <button data-testid="relationship-add" onClick={onAdd} style={{ background: "none", border: "none", color: T.accent, fontSize: 13, fontWeight: 700, padding: "12px 0", cursor: "pointer", fontFamily: FONT.sans }}>{addLabel}</button> : null}
      </div>
    </div>
  );
}

export function CapabilityTiles({ T, tiles, onManage }) {
  if (!tiles.length && !onManage) return null;
  return (
    <div data-testid="capability-tiles">
      <SectionLabel T={T} right={onManage ? <button onClick={onManage} style={{ background: "none", border: "none", color: T.accent, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Manage</button> : null}>Capabilities</SectionLabel>
      {tiles.length === 0 ? <div style={{ color: T.sub, fontSize: 13 }}>No capabilities switched on.</div> : null}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {tiles.map(t => (
          <button key={t.id} data-testid={`capability-${t.id}`} onClick={t.onClick} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px", textAlign: "left", cursor: t.onClick ? "pointer" : "default", minHeight: 64, fontFamily: FONT.sans }}>
            <span style={{ display: "block", color: T.text, fontSize: 13, fontWeight: 700 }}>{t.label}</span>
            <span style={{ display: "block", color: T.sub, fontSize: 12, marginTop: 4 }}>{t.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** G-12 — the one overdue Bill pinned above relationships. */
export function PinnedBill({ T, bill, forName, days, sym, fmt, onOpen }) {
  if (!bill) return null;
  return (
    <div data-testid="pinned-bill" style={{ background: T.dangerSoft, border: `1px solid ${T.danger}55`, borderRadius: 16, padding: 14, marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>{bill.name || bill.merchant}{forName ? ` · For ${forName}` : ""}</span>
        <span style={{ color: T.dangerText, fontSize: 12, fontWeight: 700 }}>{days} day{days === 1 ? "" : "s"} overdue</span>
      </div>
      <div style={{ color: T.text, fontSize: 22, fontWeight: 600, fontFamily: FONT.mono, marginTop: 6 }}>{sym}{fmt(Number(bill.amount || 0))}</div>
      {onOpen ? <button data-testid="pinned-bill-open" onClick={() => onOpen(bill)} style={{ marginTop: 10, background: "none", border: `1px solid ${T.borderStrong}`, color: T.text, borderRadius: RADIUS.pill, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Open bill</button> : null}
    </div>
  );
}
