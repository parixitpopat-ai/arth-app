// The statement itself (one person): used by the person's sheet and, per member, by the family sheet. Display only.
import { shortDate, periodLabel } from "../domain/person/statementMessage";

export default function StatementPreview({ T, sym = "₹", fmt = n => Number(n).toFixed(2), st, name, nameOf, children }) {
  const money = n => `${sym}${fmt(Math.abs(n))}`;
  const sub = { color: T.sub, fontSize: 11 }, line = { display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0" };
  const itemSub = it => [it.kind === "bill" ? `Bill ${shortDate(it.billDate)}` : shortDate(it.date), it.dueDate ? `due ${shortDate(it.dueDate)}` : "",
    it.moved > 0 ? `moved to ${nameOf(it.movedTo)}${it.movedOn ? ` on ${shortDate(it.movedOn)}` : ""}` : it.paid > 0 ? `paid ${money(it.paid)} · still due ${money(it.due)}` : it.due > 0 ? "not paid yet" : "paid"].filter(Boolean).join(" · ");
  return (
    <div data-testid="stmt-preview" style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12 }}>
            <div style={{ color: T.text, fontSize: 14, fontWeight: 800 }}>{name}</div>
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
            {st.payments.length > 0 && <div style={{ ...sub, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 10, borderBottom: `1px solid ${T.border}`, paddingBottom: 3 }}>Payments applied to {name}</div>}
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
            {children}
          </div>
  );
}
