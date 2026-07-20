import React from "react";

export default function EmptyState({ icon, title, subtitle, action, T }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 16px" }}>
      {icon && <div style={{ fontSize: 44, marginBottom: 12 }}>{icon}</div>}
      {title && <div style={{ color: T.text, fontSize: 15, fontWeight: 800, marginBottom: subtitle ? 6 : 0 }}>{title}</div>}
      {subtitle && <div style={{ color: T.sub, fontSize: 12, marginBottom: action ? 18 : 0 }}>{subtitle}</div>}
      {action}
    </div>
  );
}
