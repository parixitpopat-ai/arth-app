import React, { useState, useEffect, useCallback } from "react";

// The bottom-sheet pattern used by every modal in Arth: dark overlay, tap-outside-to-close,
// sheet slides up from the bottom with rounded top corners, scrolls internally if content
// exceeds maxHeight. Extracted after finding 15+ independent hand-written copies of this exact
// ~6-line wrapper (COMPONENT_INVENTORY.md) — every one of them would need to change in sync if
// the visual language ever moves, which is exactly the drift risk a shared component exists to
// prevent. This pass adds that exact kind of change: open/close animation, added once here
// instead of in every call site - every screen using BottomSheet gets it automatically.
//
// The close animation needs a beat before the component actually unmounts (so the slide-down is
// visible instead of the parent yanking it away instantly), so this wraps the caller's onClose in
// a local `closing` state and calls the real one after the transition finishes - the caller's
// onClose contract is unchanged, it just fires ~200ms later than an instant unmount would.
//
// `T` (theme) is passed as a prop rather than imported, since this component has no access to
// the app's dark/light state on its own - the caller already has T in scope.
export default function BottomSheet({
  onClose,
  children,
  T,
  maxWidth = 430,
  maxHeight = "85vh",
  zIndex = 300,
  padding = "20px 16px 40px",
}) {
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 200);
  }, [onClose]);

  const open = entered && !closing;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        opacity: open ? 1 : 0, transition: "opacity 0.2s ease",
      }}
    >
      <div
        style={{
          background: T.card, borderRadius: "22px 22px 0 0", padding,
          width: "100%", maxWidth, maxHeight, overflowY: "auto",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
