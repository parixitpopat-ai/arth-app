import React from "react";

// PAT-008 — Entity Card. The foundation component for every Manage entity (People, Groups,
// Vehicles, Insurance, Billers, Properties, Business Assets) — each of these currently hand-builds
// its own near-identical "icon + name + subtitle + trailing value" row. One shared card, so
// UX-006 (Create Person) and every future Manage entity screen build on the same shape instead
// of inventing another slightly-different layout.
export default function EntityCard({ icon, title, subtitle, trailing, onClick, T, accentColor }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        background: T.input, borderRadius: 14, padding: "12px 14px",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {icon && (
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, background: (accentColor || T.accent) + "22",
        }}>
          {icon}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: T.text, fontSize: 14, fontWeight: 800, wordBreak: "break-word" }}>{title}</div>
        {subtitle && <div style={{ color: T.sub, fontSize: 11, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {trailing && <div style={{ flexShrink: 0, textAlign: "right" }}>{trailing}</div>}
    </div>
  );
}
