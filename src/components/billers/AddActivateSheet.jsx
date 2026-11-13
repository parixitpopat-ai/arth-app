// src/components/billers/AddActivateSheet.jsx — "Add / Activate": pick what you pay for (electricity, mobile, insurance …) to set up a provider.
// Presentation only: what each tile does when tapped is decided by the caller (`onPick(type)`), exactly as before. Redesign: a full-width sheet with a
// search box, a "Yours" row for types already set up, three tiles per row (readable labels), a sticky one-off-bill action, and it is drawn on top of the
// whole app (portal) so no parent layout can squeeze it. Fixes the old sheet, whose one-off-bill button sat BESIDE it and cut it to two thirds width.
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { ADD_ACTIVATE_GROUPS, filterGroups } from "./addActivateGroups.js";

/**
 * @param {{T:object, iconFor:(type:string)=>string, statusFor:(type:string)=>{accounts:number, unpaid:number}, onPick:(type:string)=>void, onOneOff:()=>void, onClose:()=>void, groups?:typeof ADD_ACTIVATE_GROUPS}} props
 */
export default function AddActivateSheet({ T, iconFor, statusFor, onPick, onOneOff, onClose, groups = ADD_ACTIVATE_GROUPS }) {
  const [query, setQuery] = useState("");
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setEntered(true)); return () => cancelAnimationFrame(id); }, []);
  const close = () => { setClosing(true); setTimeout(onClose, 200); };
  useEffect(() => { const onKey = e => { if (e.key === "Escape") close(); }; document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey); }); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = type => { onPick(type); };            // the caller closes the sheet and routes; no animation delay so the next screen opens at once

  const shown = useMemo(() => filterGroups(groups, query), [groups, query]);
  const yours = useMemo(() => {
    if (query.trim()) return [];
    return groups.flatMap(g => g.types).filter(t => (statusFor(t).accounts || 0) > 0);
  }, [groups, query, statusFor]);
  const open = entered && !closing;

  const tile = (type, keyPrefix, testId) => {
    const st = statusFor(type) || { accounts: 0, unpaid: 0 };
    return (
      <button key={`${keyPrefix}-${type}`} type="button" data-testid={testId || `aa-tile-${type}`} onClick={() => pick(type)}
        style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 96, padding: "12px 6px", background: T.input, border: `1px solid ${T.border}`, borderRadius: 16, cursor: "pointer", color: T.text, fontFamily: "inherit" }}>
        <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 14, background: T.card, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, boxShadow: `inset 0 0 0 1px ${T.border}` }}>{iconFor(type)}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.2, textAlign: "center", wordBreak: "break-word" }}>{type}</span>
        {st.unpaid > 0 && <span data-testid={`aa-unpaid-${type}`} style={{ position: "absolute", top: 6, right: 6, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9, background: T.danger, color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{st.unpaid}</span>}
        {st.accounts > 0 && st.unpaid === 0 && <span aria-label="already set up" style={{ position: "absolute", top: 9, right: 9, width: 8, height: 8, borderRadius: 4, background: T.accent }} />}
      </button>
    );
  };
  const label = text => <div style={{ color: T.sub, fontSize: 11, fontWeight: 800, letterSpacing: 0.9, textTransform: "uppercase", margin: "18px 2px 10px" }}>{text}</div>;
  const grid = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 };

  return createPortal(
    <div onClick={e => { if (e.target === e.currentTarget) close(); }} style={{ position: "fixed", inset: 0, zIndex: 320, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "flex-end", justifyContent: "center", opacity: open ? 1 : 0, transition: "opacity 0.2s ease" }}>
      <div role="dialog" aria-modal="true" aria-label="Add or activate a provider" data-testid="aa-sheet"
        style={{ fontFamily: "Nunito, sans-serif", background: T.card, width: "100%", maxWidth: 480, maxHeight: "92vh", borderRadius: "24px 24px 0 0", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 -10px 30px rgba(0,0,0,0.35)", transform: open ? "translateY(0)" : "translateY(100%)", transition: "transform 0.24s cubic-bezier(0.32, 0.72, 0, 1)" }}>
        <div style={{ padding: "8px 16px 12px", flexShrink: 0 }}>
          <div aria-hidden="true" style={{ width: 40, height: 4, borderRadius: 2, background: T.borderStrong || T.border, margin: "0 auto 12px" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ color: T.text, fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em" }}>Add a provider</div>
              <div style={{ color: T.sub, fontSize: 13, marginTop: 2 }}>What do you pay for?</div>
            </div>
            <button type="button" data-testid="aa-close" aria-label="Close" onClick={close} style={{ width: 44, height: 44, borderRadius: 22, border: "none", background: T.input, color: T.sub, fontSize: 18, cursor: "pointer", flexShrink: 0 }}>✕</button>
          </div>
          <div style={{ position: "relative", marginTop: 14 }}>
            <span aria-hidden="true" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 15, opacity: 0.7 }}>🔍</span>
            <input data-testid="aa-search" type="text" inputMode="search" enterKeyHint="search" autoComplete="off" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search: Electricity, Jio, Insurance…"
              style={{ width: "100%", boxSizing: "border-box", minHeight: 48, borderRadius: 14, border: `1px solid ${T.border}`, background: T.input, color: T.text, padding: "0 40px 0 40px", fontSize: 15, fontFamily: "inherit", outline: "none" }} />
            {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, borderRadius: 18, border: "none", background: "none", color: T.sub, fontSize: 15, cursor: "pointer" }}>✕</button>}
          </div>
        </div>

        <div style={{ overflowY: "auto", padding: "0 16px 12px", flex: 1, WebkitOverflowScrolling: "touch" }}>
          {yours.length > 0 && <><div style={{ color: T.accent, fontSize: 11, fontWeight: 800, letterSpacing: 0.9, textTransform: "uppercase", margin: "6px 2px 10px" }}>Already set up</div><div style={grid}>{yours.map(t => tile(t, "y", `aa-yours-${t}`))}</div></>}
          {shown.map(g => <div key={g.label}>{label(g.label)}<div style={grid}>{g.types.map(t => tile(t, g.label))}</div></div>)}
          {shown.length === 0 && (
            <div data-testid="aa-empty" style={{ textAlign: "center", padding: "36px 12px", color: T.sub }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🤷</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Nothing called “{query.trim()}”</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Add it as “Other” and name it yourself.</div>
              <button type="button" data-testid="aa-other" onClick={() => pick("Other")} style={{ marginTop: 14, minHeight: 44, padding: "0 18px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.input, color: T.text, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Add as Other</button>
            </div>
          )}
        </div>

        <div style={{ padding: "10px 16px calc(14px + env(safe-area-inset-bottom, 0px))", borderTop: `1px solid ${T.border}`, background: T.card, flexShrink: 0 }}>
          <button type="button" data-testid="aa-oneoff" onClick={onOneOff} style={{ width: "100%", minHeight: 48, borderRadius: 14, border: `1px solid ${T.border}`, background: T.input, color: T.text, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            Add a one-off bill <span style={{ color: T.sub, fontWeight: 500 }}>· no provider</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
