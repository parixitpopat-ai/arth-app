import React, { useState, useEffect } from "react";

// Confirms an action happened — used first for Quick Add's "saved" confirmation, but written
// generically so any screen can use it for the same purpose. Auto-dismisses on its own; never
// blocks input, never requires the user to do anything with it.
//
// `T` (theme) is passed as a prop, same convention as BottomSheet — this component has no
// access to the app's dark/light state on its own.
export default function Toast({ message, icon = "✓", T, duration = 2200, onDone }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showId = requestAnimationFrame(() => setVisible(true));
    const hideId = setTimeout(() => setVisible(false), duration);
    const doneId = setTimeout(() => onDone?.(), duration + 250);
    return () => { cancelAnimationFrame(showId); clearTimeout(hideId); clearTimeout(doneId); };
  }, [duration, onDone]);

  return (
    <div
      style={{
        position: "fixed", left: "50%", bottom: 100, zIndex: 500,
        transform: `translateX(-50%) translateY(${visible ? "0" : "12px"})`,
        opacity: visible ? 1 : 0, transition: "all 0.25s ease",
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 30,
        padding: "10px 18px", display: "flex", alignItems: "center", gap: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.3)", pointerEvents: "none",
        maxWidth: "88vw",
      }}
    >
      <span style={{ fontSize: 15, color: T.success }}>{icon}</span>
      <span style={{ color: T.text, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{message}</span>
    </div>
  );
}
