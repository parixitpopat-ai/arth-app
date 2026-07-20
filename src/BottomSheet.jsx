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
