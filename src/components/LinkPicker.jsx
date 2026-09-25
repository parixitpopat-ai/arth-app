import React, { useState } from "react";
import { RADIUS, TOUCH, FONT } from "../constants/theme";

// T3.1 Part B2 — the shared "Link to…" picker pattern (Arth UI-2B T3.1 B2 Link To Pickers.dc.html,
// section P). One generic component; every type-specific difference (source data, grouping,
// search fields, copy) is computed by the caller into plain row objects — this component only
// knows how to render the pattern, never a type's own domain rules.
//
// Row shape: { id, icon, title, meta, searchText }. `groups` is 0-2 {label, rows} groups, already
// excluding whichever row is currently linked (that one is passed separately as `linkedRow` so it
// can be pinned above the groups, per P-5 "Currently linked").
//
// Selecting a row only moves the selection (P item 4: "tap selects, it does not commit"); only
// the footer CTA calls `onCommit`. `onNewType(query)` is the dashed "New {noun}" row's handoff.
export default function LinkPicker({
  T, title, searchPlaceholder,
  linkedRow = null,
  groups = [],
  itemNoun, itemNounPlural,
  onBack,
  onCommit,
  onNewType,
  emptyTitle, emptySubtitle,
  extraContent,
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(linkedRow?.id ?? null);

  const normalize = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const query = normalize(q.trim());
  const allRows = groups.flatMap(g => g.rows);
  const isEmpty = allRows.length === 0 && !linkedRow;
  const filtered = query ? allRows.filter(r => normalize(r.searchText || r.title).includes(query)) : null;
  const noResults = query && filtered && filtered.length === 0;

  const rowStyle = selectedNow => ({
    minHeight: 56, padding: "8px 14px", margin: "0 -14px", display: "flex", alignItems: "center", gap: 12,
    borderBottom: `1px solid ${T.border}`, cursor: "pointer",
    background: selectedNow ? T.accentSoft : "transparent",
  });

  // Plain render functions, not components — declaring these as `const X = () => <jsx/>` inside
  // this component's body would create a NEW component type on every render, resetting state.
  const renderRow = (r, pinned) => {
    const isSel = selected === r.id;
    return (
      <div key={r.id} onClick={() => setSelected(r.id)} style={{ ...rowStyle(isSel || pinned), borderRadius: pinned ? `${RADIUS.lg}px ${RADIUS.lg}px 0 0` : 0 }}>
        <span style={{ width: 36, height: 36, borderRadius: RADIUS.md, background: T.pill, color: isSel || pinned ? T.accent : T.sub, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{r.icon}</span>
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ color: T.text, fontSize: 15, fontWeight: isSel || pinned ? 600 : 500 }}>{r.title}</span>
          {r.meta && <span style={{ color: isSel || pinned ? T.mutedText || T.sub : T.sub, fontSize: 13 }}>{r.meta}</span>}
        </span>
        {(isSel || pinned) && <span style={{ color: T.accent, fontSize: 20 }}>✓</span>}
      </div>
    );
  };

  const selectedRow = selected === linkedRow?.id ? linkedRow : allRows.find(r => r.id === selected);
  const ctaLabel = !selected ? `Select a ${itemNoun}` : (selected === linkedRow?.id ? "Done" : `Link ${selectedRow?.title || ""}`);
  const ctaEnabled = Boolean(selected);

  const renderNewRow = label => (
    <div onClick={() => onNewType?.(q.trim())} style={{ minHeight: 52, borderRadius: RADIUS.lg, border: `1px dashed ${T.borderStrong}`, padding: "0 14px", display: "flex", alignItems: "center", gap: 12, color: T.accent, fontSize: 15, fontWeight: 500, cursor: "pointer", marginTop: 8 }}>
      <span style={{ fontSize: 20, width: 36, textAlign: "center" }}>+</span>{label}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ minHeight: 48, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${T.border}`, marginBottom: 14 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: T.sub, fontSize: 15, width: 52, textAlign: "left", cursor: "pointer", fontFamily: FONT.sans }}>Back</button>
        <span style={{ color: T.text, fontSize: 15, fontWeight: 600 }}>{title}</span>
        <span style={{ width: 52 }} />
      </div>

      {!isEmpty && (
        <div style={{ minHeight: TOUCH.min, background: T.input, border: `1px solid ${query ? T.accent : T.borderStrong}`, borderRadius: RADIUS.md, padding: "0 12px", display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ color: T.sub }}>🔍</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={searchPlaceholder} style={{ flex: 1, background: "none", border: "none", outline: "none", color: T.text, fontSize: 15, fontFamily: FONT.sans }} />
          {query && <span onClick={() => setQ("")} style={{ color: T.sub, fontSize: 18, width: 24, textAlign: "center", cursor: "pointer" }}>×</span>}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto" }}>
        {isEmpty && (
          <div style={{ padding: "28px 8px 8px", display: "flex", flexDirection: "column", gap: 8, alignItems: "center", textAlign: "center" }}>
            <span style={{ color: T.text, fontSize: 17, fontWeight: 600 }}>{emptyTitle}</span>
            {emptySubtitle && <span style={{ color: T.sub, fontSize: 14, lineHeight: 1.5 }}>{emptySubtitle}</span>}
            <div onClick={() => onNewType?.("")} style={{ minHeight: TOUCH.min, marginTop: 8, borderRadius: RADIUS.md, border: `1px solid ${T.accent}`, color: T.accent, fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px", cursor: "pointer" }}>New {itemNoun}</div>
          </div>
        )}

        {!isEmpty && noResults && (
          <>
            <div style={{ padding: "28px 8px 4px", display: "flex", flexDirection: "column", gap: 6, alignItems: "center", textAlign: "center" }}>
              <span style={{ color: T.text, fontSize: 15, fontWeight: 600 }}>No {itemNounPlural} match "{q.trim()}"</span>
              <span style={{ color: T.sub, fontSize: 13, lineHeight: 1.45 }}>{searchPlaceholder}</span>
            </div>
            {renderNewRow(`New ${itemNoun} "${q.trim()}"`)}
          </>
        )}

        {!isEmpty && !noResults && (
          <>
            {linkedRow && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                <span style={{ color: T.accent, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Linked now</span>
                <div style={{ background: T.accentSoft, border: `1px solid ${T.accent}66`, borderRadius: RADIUS.lg, padding: "0 14px" }}>
                  {renderRow(linkedRow, true)}
                </div>
              </div>
            )}
            {filtered ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ color: T.sub, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{filtered.length} result{filtered.length === 1 ? "" : "s"}</span>
                <div style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: RADIUS.lg, padding: "0 14px" }}>
                  {filtered.map(r => renderRow(r, false))}
                </div>
              </div>
            ) : (
              groups.map((g, i) => g.rows.length > 0 && (
                <div key={g.label || i} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                  {g.label && <span style={{ color: T.sub, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{g.label}</span>}
                  <div style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: RADIUS.lg, padding: "0 14px" }}>
                    {g.rows.map(r => renderRow(r, false))}
                  </div>
                </div>
              ))
            )}
            {renderNewRow(`New ${itemNoun}${query ? ` "${q.trim()}"` : ""}`)}
            {extraContent?.(selected)}
          </>
        )}
      </div>

      {!isEmpty && (
        <div style={{ paddingTop: 12, borderTop: `1px solid ${T.border}`, marginTop: 12 }}>
          <div onClick={() => ctaEnabled && onCommit?.(selected)} style={{ minHeight: TOUCH.min, borderRadius: RADIUS.md, background: ctaEnabled ? T.accent : T.border, color: ctaEnabled ? T.accentInk : T.subDim, fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", cursor: ctaEnabled ? "pointer" : "default" }}>{ctaLabel}</div>
        </div>
      )}
    </div>
  );
}
