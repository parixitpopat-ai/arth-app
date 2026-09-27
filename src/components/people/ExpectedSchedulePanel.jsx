import React, { useState } from "react";
import { fieldStyles } from "./peopleStyles";

// ADR-039 (Approved) / Arth 2.0 IA Redesign.dc.html's D2 "Relationship detail" — the Schedule and
// Expected lines for one Financial Relationship. Three distinct things render here, deliberately
// never merged:
//   Schedule — the recurrence rule, read from relationship.schedule (fields on the Relationship
//              row itself — no schedules[] array). Set/changed only through onSetSchedule
//              (`obligation.set`).
//   Expected — the one computed occurrence (domain/obligations/expected.js), shown dashed,
//              "not a bill yet" — matches ADR-039 §10b ("dashed, never payable").
//   Bill     — created only when the person taps Confirm amount (onConfirm, `bill.fromSchedule`);
//              this panel never creates one itself.
//
// This pass only offers "Yes, it sends regular bills" (billingMode "regular") — the only mode
// that produces an Expected item. Setting no schedule is equivalent to the design's "No, I just
// pay" / "Not sure" paths for Expected's purposes, so this pass doesn't build separate UI for
// those two; a later pass can add them without changing this shape.
const FREQUENCIES = [
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Every 3 months" },
  { id: "halfyearly", label: "Every 6 months" },
  { id: "yearly", label: "Yearly" },
];

const formatDay = ymd => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ""));
  if (!m) return ymd;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]}`;
};

export default function ExpectedSchedulePanel({ T, relationship, targetLabel, expected, sym, fmt, onSetSchedule, onConfirm }) {
  const s = fieldStyles(T);
  const [editing, setEditing] = useState(false);
  const schedule = relationship?.schedule;
  const [amount, setAmount] = useState(schedule ? String(schedule.amount) : "");
  const [frequency, setFrequency] = useState(schedule?.frequency || "monthly");
  const [dueDay, setDueDay] = useState(schedule ? String(schedule.dueDay) : "");

  if (!relationship) return null;

  const save = () => {
    const amt = Number(amount);
    const day = Number(dueDay);
    if (!(amt > 0) || !(day >= 1 && day <= 31)) return;
    onSetSchedule({ amount: amt, frequency, dueDay: day, billingMode: "regular" });
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ background: T.input, borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
        <div style={{ color: T.text, fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Schedule{targetLabel ? ` — ${targetLabel}` : ""}</div>
        <span style={{ color: T.sub, fontSize: 11 }}>Usual amount</span>
        <input data-testid="schedule-amount" style={s.input} type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="e.g. 1500" />
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {FREQUENCIES.map(f => (
            <button key={f.id} data-testid={`schedule-freq-${f.id}`} onClick={() => setFrequency(f.id)}
              style={{ padding: "6px 10px", borderRadius: 10, border: `1px solid ${frequency === f.id ? T.accent : T.border}`, background: frequency === f.id ? T.accentSoft : "transparent", color: frequency === f.id ? T.text : T.sub, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{f.label}</button>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          <span style={{ color: T.sub, fontSize: 11 }}>Due day of month</span>
          <input data-testid="schedule-dueday" style={s.input} type="text" inputMode="numeric" value={dueDay} onChange={e => setDueDay(e.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 5" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
          <button onClick={() => setEditing(false)} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 4px", cursor: "pointer", fontSize: 12, fontWeight: 700, color: T.sub }}>Cancel</button>
          <button data-testid="schedule-save" onClick={save} style={{ background: T.accentSoft, border: `1px solid ${T.accent}44`, borderRadius: 12, padding: "10px 4px", cursor: "pointer", fontSize: 12, fontWeight: 800, color: T.accent }}>Save</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 10 }}>
      {schedule ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.input, borderRadius: 14, padding: "10px 14px", marginBottom: expected ? 8 : 0 }}>
          <span style={{ color: T.text, fontSize: 12 }}>Schedule · {sym}{fmt(schedule.amount)} · {FREQUENCIES.find(f => f.id === schedule.frequency)?.label || schedule.frequency} · day {schedule.dueDay}</span>
          <button data-testid="schedule-edit" onClick={() => setEditing(true)} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 10, padding: "5px 9px", cursor: "pointer", fontSize: 11, fontWeight: 700, color: T.text }}>Edit</button>
        </div>
      ) : (
        <button data-testid="schedule-set" onClick={() => setEditing(true)} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: `1px dashed ${T.borderStrong}`, borderRadius: 14, padding: "10px 14px", marginBottom: 0, cursor: "pointer", color: T.accent, fontSize: 12, fontWeight: 700 }}>+ Set schedule</button>
      )}
      {expected ? (
        <div data-testid="expected-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "transparent", border: `1px dashed ${T.borderStrong}`, borderRadius: 14, padding: "10px 14px", marginTop: 8 }}>
          <span style={{ color: T.sub, fontSize: 12 }}>Expected · {sym}{fmt(expected.amount)} · {formatDay(expected.dueDate)}<span style={{ display: "block", fontSize: 10, marginTop: 2 }}>A bill will be created on {formatDay(expected.dueDate)}</span></span>
          <button data-testid="expected-confirm" onClick={() => onConfirm(expected)} style={{ flexShrink: 0, background: T.accent, border: "none", borderRadius: 10, padding: "7px 12px", cursor: "pointer", fontSize: 11, fontWeight: 800, color: T.accentInk || "#fff" }}>Confirm amount</button>
        </div>
      ) : null}
    </div>
  );
}
