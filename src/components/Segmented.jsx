// WP-UI-2B-2 — Segmented control, per the Design Language spec ("Segmented control — 14px,
// 48px track"). Generic options/value/onChange API so every one of the ~78 hand-rolled
// pill-toggle groups across the app (confirmed count, App.jsx) can eventually convert to this
// one real component instead of each hand-typing its own button row.
//
// options: array of strings, or array of {value, label} when the label needs to differ from a
// simple capitalized version of the value (matches the original inline pattern's own
// c.charAt(0).toUpperCase()+c.slice(1) default exactly, for string options).

import { FONT, RADIUS, TOUCH } from "../constants/theme";

export default function Segmented({ options, value, onChange, T }) {
  return (
    <div style={{ display: "flex", gap: 4, background: T.pill, borderRadius: RADIUS.md, padding: 4, minHeight: TOUCH.min, boxSizing: "border-box" }}>
      {options.map(opt => {
        const optValue = typeof opt === "string" ? opt : opt.value;
        const optLabel = typeof opt === "string" ? opt.charAt(0).toUpperCase() + opt.slice(1) : opt.label;
        const active = value === optValue;
        return (
          <button
            key={optValue}
            type="button"
            onClick={() => onChange(optValue)}
            style={{
              flex: 1,
              minHeight: TOUCH.min - 8,
              borderRadius: RADIUS.sm,
              border: "none",
              background: active ? T.accent : "transparent",
              color: active ? T.accentInk : T.sub,
              fontFamily: FONT.sans,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {optLabel}
          </button>
        );
      })}
    </div>
  );
}
