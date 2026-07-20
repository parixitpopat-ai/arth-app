import React from "react";

// Replaces the "icon/value/label in a small bordered box" pattern hand-built at least 4 separate
// times (Financial Health breakdown, Bills Home Quick Summary, Connection Dashboard Analytics,
// Home Stats grid) — each with slightly different font sizes and spacing. `valueSize` covers the
// range those originals used (14-18px) rather than forcing one size that doesn't fit every use.
export default function StatCard({ icon, value, label, color, T, valueSize = 16 }) {
  return (
    <div style={{ background: T.input, borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
      {icon && <div style={{ fontSize: 16, marginBottom: 4 }}>{icon}</div>}
      <div style={{ color: color || T.text, fontSize: valueSize, fontWeight: 900 }}>{value}</div>
      <div style={{ color: T.sub, fontSize: 9, marginTop: 2 }}>{label}</div>
    </div>
  );
}
