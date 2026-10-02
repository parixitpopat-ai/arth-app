import React, { useState } from "react";
import BottomSheet from "./BottomSheet";

// Education transaction UI (ET3/ET5/ET6/ET16/ET17) — overflow-safe Start/End fields and the
// month-range sheet. UI only: the range is handed back to the caller as plain "YYYY-MM" /
// "YYYY-MM-DD" strings, and what that range means (which Fee Periods it touches) stays in
// domain/schoolFees/educationLines.js.
//
// Why not <input type="month"> / a bare <input type="date"> in a grid: a native month/date input
// has an intrinsic minimum width that ignores its grid track, which pushed the End field outside
// its card on narrow screens (and type="month" is unreliable in some Android WebViews). Here every
// field is a button-style box (min-width:0, 48px tall, ellipsising value, icon inside the box); a
// date field overlays an invisible native date input so the platform picker still opens on tap.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const ymLabel = ym => {
  const m = /^(\d{4})-(\d{2})$/.exec(ym || "");
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : "";
};
const dateLabel = d => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || "");
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : "";
};

/** Two tracks of minmax(0,1fr) that stack to one column below 128px per track. */
export function RangeFieldGrid({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(128px, 1fr))", gap: 8, minWidth: 0, width: "100%" }}>
      {children}
    </div>
  );
}

/**
 * One Start/End field. `kind="month"` renders a button (caller opens the month sheet via onPress);
 * `kind="date"` renders the same box with a transparent native date input laid over it.
 */
export function RangeField({ T, label, kind, value, onPress, onChange, min, max, error, testId }) {
  const text = kind === "month" ? ymLabel(value) : dateLabel(value);
  const box = {
    position: "relative", display: "flex", alignItems: "center", gap: 8, boxSizing: "border-box",
    width: "100%", minWidth: 0, minHeight: 48, padding: "0 12px",
    background: T.input, border: `1px solid ${error ? T.danger : T.border}`, borderRadius: 12,
    color: text ? T.text : T.sub, fontSize: 15, fontWeight: 600, textAlign: "left", cursor: "pointer",
  };
  const inner = (
    <>
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text || "Select"}</span>
      <span aria-hidden="true" style={{ flexShrink: 0, fontSize: 14, color: T.sub }}>▦</span>
    </>
  );
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: T.sub, fontSize: 11, fontWeight: 600, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      {kind === "month" ? (
        <button type="button" data-testid={testId} onClick={onPress} style={{ ...box, fontFamily: "inherit" }}>{inner}</button>
      ) : (
        <div style={box} data-testid={testId}>
          {inner}
          <input
            type="date" value={value || ""} min={min || undefined} max={max || undefined}
            onChange={e => onChange && onChange(e.target.value)}
            aria-label={label}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: "none", padding: 0, margin: 0, minWidth: 0 }}
          />
        </div>
      )}
    </div>
  );
}

const fyOf = ym => {
  const m = /^(\d{4})-(\d{2})$/.exec(ym || "");
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]);
  return mo >= 4 ? y : y - 1;
};

/**
 * Month-range sheet (ET5). First tap sets the start, the second sets the end (a second tap before
 * the start restarts), tapping again restarts. Months already fully paid are struck through but
 * never block a range. The caller supplies `summarize(startYM,endYM)` -> {text, amountText} so the
 * footer reflects the school's real Fee Periods rather than anything computed here.
 */
export function MonthRangeSheet({ T, initialStart, initialEnd, isPaid, summarize, onApply, onClose }) {
  const today = new Date();
  const fy0 = fyOf(initialStart) ?? (today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1);
  const [fy, setFy] = useState(fy0);
  const [start, setStart] = useState(initialStart || "");
  const [end, setEnd] = useState(initialEnd || "");

  const cells = Array.from({ length: 12 }, (_, i) => {
    const mo = ((i + 3) % 12) + 1;
    const y = mo >= 4 ? fy : fy + 1;
    return { ym: `${y}-${String(mo).padStart(2, "0")}`, name: MONTHS[mo - 1] };
  });

  const tap = ym => {
    if (!start || (start && end)) { setStart(ym); setEnd(""); return; }
    if (ym < start) { setStart(ym); setEnd(""); return; }
    setEnd(ym);
  };
  const inRange = ym => start && (end ? ym >= start && ym <= end : ym === start);
  const hasRange = Boolean(start && end);
  const info = hasRange && summarize ? summarize(start, end) : null;

  return (
    <BottomSheet onClose={onClose} T={T} maxWidth={430} maxHeight="88vh" padding="20px 16px 32px" zIndex={360}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ color: T.text, fontSize: 16, fontWeight: 900 }}>School Fees · months</div>
        <button type="button" onClick={onClose} style={{ background: T.input, border: "none", color: T.sub, borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 14 }}>Done</button>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <button type="button" aria-label="Previous year" onClick={() => setFy(fy - 1)} style={{ background: "none", border: "none", color: T.sub, fontSize: 20, padding: "6px 12px", cursor: "pointer" }}>‹</button>
        <div style={{ color: T.text, fontSize: 15, fontWeight: 800 }}>{fy}–{String(fy + 1).slice(2)}</div>
        <button type="button" aria-label="Next year" onClick={() => setFy(fy + 1)} style={{ background: "none", border: "none", color: T.sub, fontSize: 20, padding: "6px 12px", cursor: "pointer" }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginBottom: 10 }}>
        {cells.map(c => {
          const on = inRange(c.ym);
          const edge = c.ym === start || c.ym === end;
          const paid = isPaid ? isPaid(c.ym) : false;
          return (
            <button
              key={c.ym} type="button" data-testid={`month-cell-${c.ym}`} onClick={() => tap(c.ym)}
              style={{
                minHeight: 44, minWidth: 0, borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: edge ? 800 : 600,
                border: "none", background: edge ? T.accent : on ? T.accentSoft : T.input,
                color: edge ? T.accentInk || "#fff" : paid ? T.sub : T.text,
                textDecoration: paid ? "line-through" : "none",
              }}
            >{c.name}</button>
          );
        })}
      </div>
      <div style={{ color: T.sub, fontSize: 11, marginBottom: 10 }}>Struck-through months are already paid. Tap a start month, then an end month.</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, color: T.sub, fontSize: 12, marginBottom: 12, minHeight: 18 }}>
        <span style={{ minWidth: 0 }}>{hasRange ? `${ymLabel(start)} → ${ymLabel(end)}` : start ? `${ymLabel(start)} → pick an end month` : "Pick a start month"}</span>
        {info && <span style={{ color: T.text, fontWeight: 700, flexShrink: 0 }}>{info.amountText}</span>}
      </div>
      {info && info.text && <div style={{ color: T.sub, fontSize: 11, marginBottom: 12 }}>{info.text}</div>}
      <button
        type="button" disabled={!hasRange} data-testid="month-sheet-apply"
        onClick={() => { onApply(start, end); onClose(); }}
        style={{ width: "100%", minHeight: 48, borderRadius: 14, border: "none", cursor: hasRange ? "pointer" : "not-allowed", background: hasRange ? T.accent : T.border, color: "#fff", fontSize: 14, fontWeight: 800 }}
      >{hasRange ? `Use ${MONTHS[Number(start.slice(5)) - 1]} – ${MONTHS[Number(end.slice(5)) - 1]}` : "Select a range"}</button>
    </BottomSheet>
  );
}
