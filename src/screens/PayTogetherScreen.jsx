import React, { useState } from "react";
import BottomSheet from "../components/BottomSheet";
import { FONT, RADIUS } from "../constants/theme";
import { itemKey } from "../domain/payTogether/group";

// Plan Ahead PA10/PA11 - Pay together. Pick upcoming instalments, choose ONE payment date, confirm.
// Confirming only creates the plan: due dates do not move and nothing is paid (stated on the sheet).
// Presentation only; the rules (what can be grouped, what a group is) live in domain/payTogether/group.js.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dm = d => `${Number(String(d).slice(8, 10))} ${MONTHS[Number(String(d).slice(5, 7)) - 1] || ""}`;
const TYPE_TITLE = { feePeriod: "School fees", bill: "Bills", recurringSchedule: "SIPs" };

export default function PayTogetherScreen({ T, sym, fmt, instalments, today, onBack, onConfirm }) {
  const [picked, setPicked] = useState([]);
  const [dateOpen, setDateOpen] = useState(false);
  const [date, setDate] = useState("");
  const [error, setError] = useState("");

  const chosen = instalments.filter(e => picked.includes(itemKey(e)));
  const total = Math.round(chosen.reduce((s, e) => s + Number(e.amount), 0) * 100) / 100;
  const toggle = k => setPicked(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);
  const sections = ["feePeriod", "bill", "recurringSchedule"].map(t => ({ t, rows: instalments.filter(e => e.sourceType === t) })).filter(s => s.rows.length);
  const nav = { background: T.input, border: "none", color: T.text, borderRadius: 10, minWidth: 44, minHeight: 44, cursor: "pointer", fontSize: 18, fontFamily: "inherit" };
  const dueDates = [...new Set(chosen.map(e => e.date))].sort();

  const openDate = () => { setError(""); setDate(prev => prev || chosen.map(e => e.date).sort()[0] || today); setDateOpen(true); };
  const confirm = () => {
    const res = onConfirm({ keys: picked, date });
    if (res && res.ok === false) setError(res.reason || "Couldn’t plan this."); else setDateOpen(false);
  };

  return (
    <div data-testid="pay-together-screen" style={{ padding: "14px 16px 150px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <button type="button" aria-label="Back" onClick={onBack} style={nav}>‹</button>
        <div style={{ color: T.text, fontSize: 17, fontWeight: 800 }}>Pay together</div>
      </div>
      <div style={{ color: T.sub, fontSize: 13, marginBottom: 12 }}>Pick upcoming instalments to pay on one date. Their due dates don’t change.</div>

      {sections.length === 0 && (
        <div data-testid="pay-together-empty" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "24px 16px", textAlign: "center", color: T.sub, fontSize: 13 }}>
          No upcoming instalments to group yet. Bills, school fee periods and SIP instalments appear here once they exist.
        </div>
      )}
      {sections.map(({ t, rows }) => (
        <div key={t} style={{ marginBottom: 14 }}>
          <div style={{ color: T.sub, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", margin: "10px 0 4px" }}>{TYPE_TITLE[t]}</div>
          {rows.map(e => {
            const k = itemKey(e); const on = picked.includes(k);
            return (
              <button key={k} type="button" role="checkbox" aria-checked={on} data-testid={`pt-item-${e.sourceId}`} onClick={() => toggle(k)}
                style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 56, padding: "8px 10px", marginBottom: 6, background: on ? T.accentSoft : T.card, border: `1px solid ${on ? T.accent : T.border}`, borderRadius: 14, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${on ? T.accent : T.borderStrong || T.border}`, background: on ? T.accent : "transparent", color: T.accentInk || "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, flexShrink: 0 }}>{on ? "✓" : ""}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", color: T.text, fontSize: 14, fontWeight: 700, overflowWrap: "anywhere" }}>{e.name}</span>
                  <span style={{ display: "block", color: T.sub, fontSize: 12 }}>Due {dm(e.date)}</span>
                </span>
                <span style={{ fontFamily: FONT.mono, fontSize: 14, fontWeight: 700, color: T.text }}>{sym}{fmt(e.amount)}</span>
              </button>
            );
          })}
        </div>
      ))}

      {sections.length > 0 && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 74, zIndex: 50, display: "flex", justifyContent: "center", padding: "0 16px" }}>
          <div style={{ width: "100%", maxWidth: 398, background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span data-testid="pt-selected" style={{ display: "block", color: T.sub, fontSize: 12 }}>{picked.length} selected</span>
              <span style={{ display: "block", color: T.text, fontFamily: FONT.mono, fontSize: 17, fontWeight: 800 }}>{sym}{fmt(total)}</span>
            </span>
            <button type="button" data-testid="pt-choose-date" disabled={picked.length < 2} onClick={openDate}
              style={{ minHeight: 48, padding: "0 16px", background: picked.length < 2 ? T.border : T.accent, border: "none", borderRadius: 14, color: picked.length < 2 ? T.sub : (T.accentInk || "#fff"), fontWeight: 800, cursor: picked.length < 2 ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              {picked.length < 2 ? "Pick 2 or more" : "Choose a date"}
            </button>
          </div>
        </div>
      )}

      {dateOpen && (
        <BottomSheet onClose={() => setDateOpen(false)} T={T} maxWidth={430} maxHeight="88vh" padding="20px 16px 32px" zIndex={360}>
          <div data-testid="pt-date-sheet">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ color: T.text, fontSize: 16, fontWeight: 800 }}>Pay {picked.length} instalments together</div>
              <button type="button" onClick={() => setDateOpen(false)} style={{ background: T.input, border: "none", color: T.sub, borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}>Done</button>
            </div>
            <label style={{ display: "block", color: T.sub, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Payment date</label>
            <input data-testid="pt-date" type="date" value={date} onChange={e => { setError(""); setDate(e.target.value); }}
              style={{ width: "100%", boxSizing: "border-box", minHeight: 48, background: T.input, border: `1px solid ${T.borderStrong || T.border}`, borderRadius: RADIUS.md || 12, padding: "0 12px", color: T.text, fontSize: 15, fontFamily: "inherit" }} />
            <div style={{ color: T.sub, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", margin: "16px 0 8px" }}>Due dates stay as they are</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {dueDates.map(d => <span key={d} style={{ border: `1px solid ${T.border}`, borderRadius: 999, padding: "4px 10px", color: T.text, fontSize: 12 }}>{dm(d)}</span>)}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", margin: "16px 0 4px", color: T.text, fontSize: 14, fontWeight: 700 }}>
              <span>Cash on {date ? dm(date) : "—"}</span><span style={{ fontFamily: FONT.mono }}>{sym}{fmt(total)}</span>
            </div>
            {error && <div role="alert" style={{ color: T.attention, fontSize: 13, fontWeight: 700, margin: "6px 0" }}>{error}</div>}
            <button type="button" data-testid="pt-confirm" disabled={!date} onClick={confirm}
              style={{ marginTop: 12, width: "100%", minHeight: 52, background: date ? T.accent : T.border, border: "none", borderRadius: 14, color: date ? (T.accentInk || "#fff") : T.sub, fontWeight: 800, fontSize: 15, cursor: date ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
              Plan {sym}{fmt(total)} on {date ? dm(date) : "…"}
            </button>
            <div style={{ color: T.sub, fontSize: 12, marginTop: 8 }}>Nothing is paid yet. Each instalment keeps its own due date.</div>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
