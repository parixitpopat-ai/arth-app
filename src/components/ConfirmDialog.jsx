import React from "react";

// PAT-006 — Confirmation Dialog. Extracted from the inline rendering that previously lived
// directly in App.jsx, driven by the `askConfirm(message, onConfirm)` convention. Supports
// Delete, Archive, Skip, Snooze, Pause, and generic confirmations via an explicit `variant`
// prop — the original inferred "danger" styling from whether onConfirm was present at all,
// which meant a message-only "OK" dialog and a genuine two-button confirm were visually
// identical apart from button count. Making variant explicit keeps that distinction honest.
export default function ConfirmDialog({ message, onConfirm, onClose, variant = "default", confirmLabel, T }) {
  const isDestructive = variant === "danger";
  const hasCancel = Boolean(onConfirm);
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div style={{ background: T.card, borderRadius: 18, padding: "20px 18px", width: "100%", maxWidth: 360 }}>
        <div style={{ color: T.text, fontSize: 14, fontWeight: 700, lineHeight: 1.5, marginBottom: 18, whiteSpace: "pre-line" }}>{message}</div>
        <div style={{ display: "grid", gridTemplateColumns: hasCancel ? "1fr 1fr" : "1fr", gap: 10 }}>
          {hasCancel && (
            <button onClick={onClose} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px", cursor: "pointer", fontSize: 13, fontWeight: 700, color: T.sub, fontFamily: "Nunito,sans-serif" }}>Cancel</button>
          )}
          <button
            onClick={() => { onClose(); onConfirm?.(); }}
            style={{
              background: hasCancel ? (isDestructive ? T.danger : T.accent) : T.accent,
              border: "none", borderRadius: 12, padding: "10px", cursor: "pointer",
              fontSize: 13, fontWeight: 800,
              color: hasCancel && isDestructive ? "#fff" : (hasCancel ? "#000" : "#000"),
              fontFamily: "Nunito,sans-serif",
            }}
          >
            {confirmLabel || (hasCancel ? "Confirm" : "OK")}
          </button>
        </div>
      </div>
    </div>
  );
}
