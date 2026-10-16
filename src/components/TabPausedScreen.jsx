import React from "react";

// SYNC-SAFETY-004 — shown instead of the app when another tab owns Arth (or this tab's data went stale).
// Two tabs share storage but not memory; if both stayed active, one could save its old data over the other's. This screen mounts
// nothing, so a paused tab cannot save or sync. Colours are fixed (dark) because this renders before the app's theme exists.
export default function TabPausedScreen({ reason, onTakeOver, onReload }) {
  const btn = (primary) => ({ width: "100%", minHeight: 48, borderRadius: 12, border: primary ? "none" : "1px solid rgba(255,255,255,0.2)", background: primary ? "#22c55e" : "transparent", color: primary ? "#04210f" : "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "Nunito,sans-serif" });
  const stale = reason === "stale";
  return (
    <div data-testid="tab-paused" style={{ minHeight: "100vh", background: "#08080f", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "Nunito,sans-serif" }}>
      <div style={{ maxWidth: 380, textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>{stale ? "🔄" : "🪟"}</div>
        <div data-testid="tab-paused-title" style={{ color: "#fff", fontSize: 18, fontWeight: 900, marginBottom: 8 }}>{stale ? "Arth changed in another tab" : "Arth is open in another tab"}</div>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
          {stale
            ? "This tab's data is out of date. To keep the other tab's changes safe, this tab has stopped. Reload it to continue with the latest data."
            : "To keep your data safe, only one tab can use Arth at a time. This tab is paused and has changed nothing. Close the other tab, or use this one instead; the other tab will pause."}
        </div>
        {stale
          ? <button data-testid="tab-reload" onClick={onReload} style={btn(true)}>Reload this tab</button>
          : <button data-testid="tab-take-over" onClick={onTakeOver} style={btn(true)}>Use this tab</button>}
      </div>
    </div>
  );
}
