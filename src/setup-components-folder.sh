#!/bin/bash
set -e
cd D:/arth-app/src
mkdir -p components

cat > components/BottomSheet.jsx << 'ARTHEOF'
import React from "react";

// The bottom-sheet pattern used by every modal in Arth: dark overlay, tap-outside-to-close,
// sheet slides up from the bottom with rounded top corners, scrolls internally if content
// exceeds maxHeight. Extracted after finding 15+ independent hand-written copies of this exact
// ~6-line wrapper (COMPONENT_INVENTORY.md) — every one of them would need to change in sync if
// the visual language ever moves (e.g. animation, safe-area handling), which is exactly the
// drift risk a shared component exists to prevent.
//
// `T` (theme) is passed as a prop rather than imported, since this component has no access to
// the app's dark/light state on its own — the caller already has T in scope.
export default function BottomSheet({
  onClose,
  children,
  T,
  maxWidth = 430,
  maxHeight = "85vh",
  zIndex = 300,
  padding = "20px 16px 40px",
}) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        style={{
          background: T.card, borderRadius: "22px 22px 0 0", padding,
          width: "100%", maxWidth, maxHeight, overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}
ARTHEOF

cat > components/EmptyState.jsx << 'ARTHEOF'
import React from "react";

// Replaces 6 independent hand-written empty states found in the audit (Timeline, Goals,
// Events list, Recent Activity, People, Bills) — each with slightly different padding, icon
// sizing, and wording conventions. `action` accepts any element (usually a button), so callers
// keep full control over what the CTA does without EmptyState needing to know about app state.
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
ARTHEOF

cat > components/StatCard.jsx << 'ARTHEOF'
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
ARTHEOF

echo "components/ folder created with 3 files."
ls -la components/
