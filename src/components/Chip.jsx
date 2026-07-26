import React from "react";

// PAT-005 — Chip. The single most duplicated visual pattern in the app before this extraction:
// category chips, account chips, payment-method options, and filter pills were all near-identical
// inline styles repeated independently across Quick Add, Full Add, and multiple other screens —
// each with slightly different padding/border-radius/font-weight. One component, used everywhere
// a "select one of several small pill-shaped options" pattern appears.
export default function Chip({ icon, label, active, onClick, color, T, size = "md" }) {
  const activeColor = color || T.accent;
  const pad = size === "sm" ? "5px 10px" : "7px 12px";
  const fontSize = size === "sm" ? 11 : 12;
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        background: active ? activeColor + "22" : T.input,
        border: `1px solid ${active ? activeColor : T.border}`,
        borderRadius: 20, padding: pad, cursor: "pointer",
        fontSize, fontWeight: 700, color: active ? activeColor : T.sub,
        fontFamily: "Nunito,sans-serif", whiteSpace: "nowrap",
      }}
    >
      {icon && <span style={{ fontSize: fontSize + 2 }}>{icon}</span>}
      {label}
    </button>
  );
}
