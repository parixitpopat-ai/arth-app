import React from "react";
import { RADIUS, TOUCH, FONT } from "../../constants/theme";
import { initialsOf } from "./peopleStyles";

// Shared building blocks for the UI-2C People & Groups sheets (M1). Styles
// come from the theme tokens so light and dark mode both work.

export function Avatar({ person, T, size = 40 }) {
  const color = person?.color || T.accent;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `${color}22`, border: `1px solid ${color}66`, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.36), fontWeight: 700, flexShrink: 0, fontFamily: FONT.sans }}>
      {initialsOf(person?.name)}
    </div>
  );
}

export function SheetHeader({ T, title, onCancel, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, minHeight: TOUCH.min }}>
      <button onClick={onCancel} style={{ background: "none", border: "none", color: T.sub, fontSize: 15, cursor: "pointer", padding: "10px 4px", fontFamily: FONT.sans }}>Cancel</button>
      <div style={{ color: T.text, fontSize: 16, fontWeight: 700, fontFamily: FONT.sans }}>{title}</div>
      <div style={{ minWidth: 56, textAlign: "right" }}>{right || null}</div>
    </div>
  );
}

export function ChoiceChip({ T, on, onClick, children, testId }) {
  return (
    <button data-testid={testId} aria-pressed={on} onClick={onClick} style={{ background: on ? T.accentSoft : "transparent", border: `1px solid ${on ? T.accent : T.borderStrong}`, borderRadius: RADIUS.pill, padding: "0 14px", minHeight: 40, cursor: "pointer", fontSize: 13, fontWeight: 600, color: on ? T.text : T.mutedText, fontFamily: FONT.sans }}>
      {children}
    </button>
  );
}

export function Segmented3({ T, options, value, onChange, testIdPrefix }) {
  return (
    <div role="radiogroup" style={{ display: "flex", background: T.pill, borderRadius: RADIUS.md, padding: 4, gap: 4 }}>
      {options.map(o => {
        const on = value === o.id;
        return (
          <button key={o.id} role="radio" aria-checked={on} data-testid={testIdPrefix ? `${testIdPrefix}-${o.id}` : undefined} onClick={() => onChange(o.id)}
            style={{ flex: 1, minHeight: 40, background: on ? T.card : "transparent", border: on ? `1px solid ${T.accent}` : "1px solid transparent", borderRadius: RADIUS.md - 2, cursor: "pointer", fontSize: 13, fontWeight: 700, color: on ? T.accent : T.sub, fontFamily: FONT.sans }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ T, on, onChange, label, sub, testId }) {
  return (
    <button data-testid={testId} role="switch" aria-checked={on} onClick={() => onChange(!on)}
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "none", border: "none", borderBottom: `1px solid ${T.border}`, padding: "12px 0", cursor: "pointer", textAlign: "left", fontFamily: FONT.sans }}>
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", color: T.text, fontSize: 14, fontWeight: 600 }}>{label}</span>
        {sub ? <span style={{ display: "block", color: T.sub, fontSize: 12, marginTop: 2 }}>{sub}</span> : null}
      </span>
      <span style={{ width: 40, height: 24, borderRadius: 12, background: on ? T.accent : T.borderStrong, display: "flex", alignItems: "center", justifyContent: on ? "flex-end" : "flex-start", padding: 3, boxSizing: "border-box", flexShrink: 0 }}>
        <span style={{ width: 18, height: 18, borderRadius: "50%", background: on ? T.bg : T.sub }} />
      </span>
    </button>
  );
}

export function SectionLabel({ T, children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "18px 0 8px" }}>
      <div style={{ color: T.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>{children}</div>
      {right || null}
    </div>
  );
}
