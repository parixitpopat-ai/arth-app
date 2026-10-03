import React, { useState } from "react";
import BottomSheet from "../components/BottomSheet";
import { FONT, RADIUS } from "../constants/theme";
import { spreadShares, shiftMonth } from "../domain/budget/spread";
import { CashBudgetStrip } from "../components/CashBudgetStrip";

// Plan Ahead PA14 - Spread in budget. Count one payment across N months of BUDGET; cash still leaves once.
// Presentation only: the shares come from domain/budget/spread.js.

const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const label = mk => `${MONTHS_LONG[Number(mk.slice(5, 7)) - 1]} ${mk.slice(0, 4)}`;
const PRESETS = [1, 3, 6, 12];

export default function SpreadSheet({ T, sym, fmt, title, amount, cashMonth, initial, onSave, onRemove, onClose }) {
  const [months, setMonths] = useState(initial?.months || 3);
  const [custom, setCustom] = useState(initial && !PRESETS.includes(initial.months));
  const [start, setStart] = useState(initial?.startMonth || cashMonth);
  const n = Math.max(1, Math.floor(Number(months) || 0));
  const valid = Number.isFinite(n) && n >= 1 && n <= 60 && amount > 0;
  const shares = valid ? spreadShares(amount, n) : [];
  const shown = Math.min(n, 4);
  const strip = Array.from({ length: shown }, (_, i) => {
    const key = shiftMonth(start, i);
    return { key, cash: key === cashMonth ? amount : null, budget: shares[i] };
  });
  const options = Array.from({ length: 13 }, (_, i) => shiftMonth(cashMonth, i - 1));
  const seg = on => ({ flex: 1, minWidth: 0, minHeight: 44, border: `1px solid ${on ? T.accent : T.border}`, background: on ? T.accentSoft : "transparent", color: T.text, borderRadius: 10, fontWeight: on ? 800 : 600, cursor: "pointer", fontFamily: "inherit" });
  return (
    <BottomSheet onClose={onClose} T={T} maxWidth={430} maxHeight="90vh" padding="20px 16px 32px" zIndex={380}>
      <div data-testid="spread-sheet">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ color: T.text, fontSize: 16, fontWeight: 800, minWidth: 0, overflowWrap: "anywhere" }}>{title} · {sym}{fmt(amount)}</div>
          <button type="button" onClick={onClose} style={{ background: T.input, border: "none", color: T.sub, borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}>Done</button>
        </div>
        <div style={{ color: T.sub, fontSize: 13, marginBottom: 14 }}>Count this payment across several months of budget. Cash still leaves once.</div>

        <div role="group" aria-label="Months" style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {PRESETS.map(p => <button key={p} type="button" data-testid={`spread-m-${p}`} aria-pressed={!custom && n === p} onClick={() => { setCustom(false); setMonths(p); }} style={seg(!custom && n === p)}>{p}</button>)}
          <button type="button" data-testid="spread-m-custom" aria-pressed={custom} onClick={() => setCustom(true)} style={seg(custom)}>Custom</button>
        </div>
        {custom && <input data-testid="spread-custom" type="number" inputMode="numeric" min="1" max="60" value={months} onChange={e => setMonths(e.target.value)} aria-label="Number of months"
          style={{ width: "100%", boxSizing: "border-box", minHeight: 48, background: T.input, border: `1px solid ${valid ? (T.borderStrong || T.border) : T.attention}`, borderRadius: RADIUS.md || 12, padding: "0 12px", color: T.text, fontSize: 15, marginBottom: 8, fontFamily: "inherit" }} />}
        {!valid && <div style={{ color: T.attention, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Enter a number of months from 1 to 60.</div>}

        <label style={{ display: "block", color: T.sub, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "10px 0 6px" }}>Starting</label>
        <select data-testid="spread-start" value={start} onChange={e => setStart(e.target.value)} style={{ width: "100%", boxSizing: "border-box", minHeight: 48, background: T.input, border: `1px solid ${T.borderStrong || T.border}`, borderRadius: RADIUS.md || 12, padding: "0 12px", color: T.text, fontSize: 15, fontFamily: "inherit" }}>
          {options.map(o => <option key={o} value={o}>{label(o)}</option>)}
        </select>

        <div style={{ margin: "16px 0 6px" }}>{valid && <CashBudgetStrip T={T} sym={sym} fmt={fmt} months={strip} />}</div>
        {valid && n > shown && <div style={{ color: T.sub, fontSize: 12 }}>…and {n - shown} more month{n - shown === 1 ? "" : "s"}, to {label(shiftMonth(start, n - 1))}.</div>}

        <button type="button" data-testid="spread-save" disabled={!valid} onClick={() => onSave({ months: n, startMonth: start })}
          style={{ marginTop: 14, width: "100%", minHeight: 52, background: valid ? T.accent : T.border, border: "none", borderRadius: 14, color: valid ? (T.accentInk || "#fff") : T.sub, fontWeight: 800, fontSize: 15, cursor: valid ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
          {valid ? `Spread ${sym}${fmt(shares[0])} × ${n}` : "Spread"}
        </button>
        {onRemove && <button type="button" data-testid="spread-remove" onClick={onRemove} style={{ marginTop: 8, width: "100%", minHeight: 48, background: "none", border: `1px solid ${T.border}`, borderRadius: 14, color: T.text, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Remove spread</button>}
        <div style={{ color: T.sub, fontSize: 12, marginTop: 10 }}>Cash is not changed. Removing the spread puts the whole amount back in one month of budget.</div>
      </div>
    </BottomSheet>
  );
}
