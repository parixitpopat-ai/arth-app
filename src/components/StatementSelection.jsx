// The list of items a statement message can carry, each with a tick: "Item - amount". The person chooses what goes in the message. Display + ticking only.
export default function StatementSelection({ T, sym = "₹", fmt = n => Number(n).toFixed(2), lines, isOn, onToggle, onAll, onNone, withNames = false, testPrefix = "sel" }) {
  const money = n => `${sym}${fmt(Math.abs(n))}`;
  const sub = { color: T.sub, fontSize: 11 };
  const link = { background: "none", border: "none", color: T.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0, fontFamily: "Nunito,sans-serif" };
  if (!lines.length) return <div data-testid={`${testPrefix}-empty`} style={{ ...sub, padding: "8px 0" }}>Nothing in this period.</div>;
  return (
    <div data-testid={`${testPrefix}-list`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={sub}>Tick what to send</span>
        <span style={{ display: "flex", gap: 12 }}><button type="button" data-testid={`${testPrefix}-all`} style={link} onClick={onAll}>All</button><button type="button" data-testid={`${testPrefix}-none`} style={link} onClick={onNone}>None</button></span>
      </div>
      {lines.map(l => (
        <label key={l.key} data-testid={`${testPrefix}-line`} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0", borderBottom: `1px solid ${T.border}`, opacity: l.due > 0.004 ? 1 : 0.55 }}>
          <input data-testid={`${testPrefix}-check`} type="checkbox" checked={Boolean(isOn(l)) && l.due > 0.004} disabled={!(l.due > 0.004)} onChange={e => onToggle(l, e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, accentColor: T.accent, flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ color: T.text, fontSize: 13, display: "block", wordBreak: "break-word" }}>{withNames && l.prefix ? `${l.prefix}: ` : ""}{l.title}</span>
            {l.paid > 0.004 && <span style={sub}>{l.due > 0.004 ? `${money(l.paid)} already paid of ${money(l.amount)}` : "paid in full"}</span>}
            {l.paid <= 0.004 && l.due <= 0.004 && <span style={sub}>nothing due</span>}
          </span>
          <span style={{ color: T.text, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>{money(l.due)}</span>
        </label>
      ))}
    </div>
  );
}
