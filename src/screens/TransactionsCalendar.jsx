// Transactions > Calendar. Presentational only: every number arrives from domain/transactions/calendarSummary.js
// (via App.jsx), so this file never calculates money. Module-level component on purpose - a component declared
// inside AppContent is re-created on every state change and would lose its selection.
import { formatCellAmount } from "../domain/transactions/calendarSummary";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const money = (sym, n) => `${sym}${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

export default function TransactionsCalendar({
  T, sym, summary, loading = false, canNext, showToday,
  onPrev, onNext, onToday, selectedDate, onSelectDate, entries = [], onAddForDate, onEditEntry, sheetHidden = false,
}) {
  const [y, m] = summary.monthKey.split("-").map(Number);
  const monthTitle = `${MONTHS[m - 1]} ${y}`;
  const selected = selectedDate ? summary.days.find(d => d.date === selectedDate) : null;
  const colW = 5; // max characters in a cell amount (the app column is phone width, so the date sheet is always a bottom sheet)
  const label = { fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: T.sub };
  const figure = { fontSize: 22, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  const navBtn = { width: 48, height: 48, border: "none", background: "none", color: T.text, cursor: "pointer", fontSize: 22, borderRadius: 12, fontFamily: "inherit" };

  const cells = [];
  for (let i = 0; i < summary.startOffset; i++) cells.push(<span key={`b${i}`} aria-hidden="true" />);
  summary.days.forEach(d => {
    const has = d.count > 0;
    const isSel = selected && selected.date === d.date;
    const aria = `${d.day} ${MONTHS[m - 1]}${d.isToday ? ", today" : ""}${has ? `, spent ${money(sym, d.spent)}${d.income ? `, income ${money(sym, d.income)}` : ""}, ${d.count} entr${d.count === 1 ? "y" : "ies"}` : ", no entries"}`;
    const base = { minHeight: 56, borderRadius: 10, border: `1px solid ${isSel ? T.accent : "transparent"}`, background: isSel ? T.accentSoft : "none", padding: "4px 2px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: 2, fontFamily: "inherit", color: T.text };
    const dayNum = <span style={{ fontSize: 13, fontWeight: d.isToday ? 800 : 600, color: d.isFuture ? T.mute || T.sub : T.text, ...(d.isToday ? { background: T.accent, color: "#000", borderRadius: 999, minWidth: 22, textAlign: "center", padding: "1px 4px" } : {}) }}>{d.day}</span>;
    if (d.isFuture) {
      cells.push(
        <span key={d.date} aria-label={aria} style={{ ...base, opacity: 0.55, cursor: "default" }}>
          {dayNum}
          {d.dueCount > 0 && <span aria-label={`${d.dueCount} due`} title={`${d.dueCount} due`} style={{ width: 6, height: 6, borderRadius: 2, background: T.warn }} />}
        </span>
      );
      return;
    }
    cells.push(
      <button key={d.date} type="button" aria-label={aria} aria-pressed={!!isSel} onClick={() => onSelectDate(d.date)} style={{ ...base, cursor: "pointer" }}>
        {dayNum}
        {d.spent > 0 && <span style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: T.text }}>{formatCellAmount(d.spent, "", colW)}</span>}
        {d.income > 0 && <span style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: T.success }}>{formatCellAmount(d.income, "+", colW + 1)}</span>}
        {d.count > 0 && d.spent === 0 && d.income === 0 && <span aria-hidden="true" title="Entries that are not spending or income" style={{ width: 8, height: 8, borderRadius: 999, border: `1.5px solid ${T.sub}` }} />}
        {d.count > 1 && <span aria-hidden="true" style={{ display: "flex", gap: 2 }}>{Array.from({ length: Math.min(3, d.count) }).map((_, i) => <span key={i} style={{ width: 4, height: 4, borderRadius: 999, background: T.sub }} />)}</span>}
        {d.dueCount > 0 && <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 2, background: T.warn }} />}
      </button>
    );
  });

  const sheetBody = selected && (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h3 style={{ flex: 1, margin: 0, fontSize: 18, fontWeight: 800, color: T.text }}>{new Date(y, m - 1, selected.day).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</h3>
        <button type="button" aria-label="Close" onClick={() => onSelectDate(null)} style={{ ...navBtn, width: 44, height: 44, fontSize: 20 }}>✕</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ paddingRight: 12, borderRight: `1px solid ${T.border}` }}><div style={label}>Spent</div><div style={{ ...figure, color: T.text }}>{money(sym, selected.spent)}</div></div>
        <div><div style={label}>Income</div><div style={{ ...figure, color: T.success }}>{money(sym, selected.income)}</div></div>
      </div>
      <div>
        <div style={{ ...label, paddingBottom: 4 }}>{entries.length === 0 ? "No entries" : `${entries.length} entr${entries.length === 1 ? "y" : "ies"}`}</div>
        {entries.map(e => (
          <button key={e.id} type="button" onClick={() => onEditEntry && onEditEntry(e.id)} style={{ width: "100%", minHeight: 52, display: "flex", alignItems: "center", gap: 12, border: "none", borderBottom: `1px solid ${T.border}`, background: "none", textAlign: "left", cursor: "pointer", fontFamily: "inherit", padding: 0, color: T.text }}>
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
              <span style={{ fontSize: 12, color: T.sub }}>{e.kindText}{e.kind === "spend" && e.share !== null && e.share !== e.gross ? ` · your share ${money(sym, e.share)}` : ""}</span>
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: e.kind === "income" ? T.success : e.kind === "other" ? T.sub : T.text }}>{e.kind === "income" ? "+" : ""}{money(sym, e.gross)}</span>
          </button>
        ))}
        {entries.length === 0 && <div style={{ padding: "10px 0", fontSize: 13, color: T.sub }}>Nothing recorded on this date.</div>}
      </div>
      <button type="button" onClick={() => onAddForDate(selected.date)} style={{ minHeight: 48, border: "none", borderRadius: 12, background: T.accent, color: "#000", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>+ Add entry for this date</button>
    </div>
  );

  return (
    <div style={{ padding: "4px 0 0" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button type="button" aria-label="Previous month" onClick={onPrev} style={navBtn}>‹</button>
          <h2 aria-live="polite" style={{ flex: 1, margin: 0, textAlign: "center", fontSize: 17, fontWeight: 800, color: T.text }}>{monthTitle}</h2>
          {showToday && <button type="button" onClick={onToday} style={{ minHeight: 36, padding: "0 12px", border: `1px solid ${T.border}`, borderRadius: 999, background: "none", color: T.text, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Today</button>}
          <button type="button" aria-label="Next month" disabled={!canNext} onClick={onNext} style={{ ...navBtn, opacity: canNext ? 1 : 0.3, cursor: canNext ? "pointer" : "default" }}>›</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "6px 4px 14px" }}>
          <div style={{ paddingRight: 12, borderRight: `1px solid ${T.border}` }}>
            <div style={label}>Spent this month</div>
            {loading ? <div style={{ height: 28, width: "70%", borderRadius: 6, background: T.pill }} /> : <div style={{ ...figure, color: T.text }}>{money(sym, summary.spentTotal)}</div>}
          </div>
          <div>
            <div style={label}>Income this month</div>
            {loading ? <div style={{ height: 28, width: "70%", borderRadius: 6, background: T.pill }} /> : <div style={{ ...figure, color: T.success }}>{money(sym, summary.incomeTotal)}</div>}
          </div>
        </div>

        <div role="grid" aria-label="Spending by date" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 2 }}>
          {WEEKDAYS.map(w => <span key={w} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: T.sub, padding: "4px 0" }}>{w}</span>)}
          {loading
            ? Array.from({ length: 35 }).map((_, i) => <span key={i} style={{ minHeight: 56, borderRadius: 10, background: T.pill, opacity: 0.5 }} />)
            : cells}
        </div>

        {!loading && summary.entryCount === 0 && (
          <div style={{ margin: "12px 0 0", padding: 16, border: `1px dashed ${T.border}`, borderRadius: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Nothing recorded in {monthTitle}</div>
            <div style={{ fontSize: 13, color: T.sub, marginTop: 4 }}>Tap any day to add an expense or income.</div>
          </div>
        )}
        {!loading && summary.entryCount > 0 && (
          <p style={{ margin: "12px 0 0", fontSize: 12, lineHeight: 1.5, color: T.sub }}>Spent is your share, in {sym}. Income in green with +. Dots mean more than one entry; a ring means entries that are not spending or income; an orange square marks something due.</p>
        )}
      </div>

      {selected && !sheetHidden && (
          <>
            <div onClick={() => onSelectDate(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 210 }} />
            <div role="dialog" aria-label="Selected date" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 220, maxHeight: "78vh", overflowY: "auto", background: T.card, borderRadius: "22px 22px 0 0", padding: "10px 16px 28px", maxWidth: 430, margin: "0 auto", boxShadow: "0 -8px 30px rgba(0,0,0,0.5)" }}>
              <div aria-hidden="true" style={{ width: 36, height: 4, borderRadius: 999, background: T.border, margin: "0 auto 10px" }} />
              {sheetBody}
            </div>
          </>
        )}
    </div>
  );
}
