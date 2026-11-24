// "N expenses have no category · Sort them" on Transactions, and, once Select is on, one-tap ways to tick many entries at once. Presentational only.
export default function UncategorisedBanner({ T, count, shown, selected, bulkMode, onSort, onSelectUncategorised, onSelectAllShown }) {
  const btn = { background: T.accent, color: T.accentInk, border: "none", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Inter,sans-serif" };
  const soft = { background: T.input, color: T.text, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Inter,sans-serif" };
  if (!bulkMode) {
    if (!(count > 0)) return null;
    return <div data-testid="uncat-banner" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "10px 12px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <span style={{ color: T.text, fontSize: 12, fontWeight: 700 }}>{count} expense{count === 1 ? " has" : "s have"} no category</span>
      <button type="button" data-testid="uncat-sort" onClick={onSort} style={btn}>Sort them</button>
    </div>;
  }
  return <div data-testid="uncat-select-row" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
    <button type="button" data-testid="select-all-shown" onClick={onSelectAllShown} style={soft}>Select all shown ({shown})</button>
    {count > 0 && <button type="button" data-testid="select-uncategorised" onClick={onSelectUncategorised} style={soft}>Select no-category ({count})</button>}
    <span style={{ color: T.sub, fontSize: 11 }}>{selected} selected</span>
  </div>;
}
