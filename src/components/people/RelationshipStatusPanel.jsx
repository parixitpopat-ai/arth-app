import React, { useState } from "react";
import { fieldStyles } from "./peopleStyles";

// Arth 2.0 IA step 5 — generalizes the pause/resume/end action UI that previously existed only
// inside MembershipDetailModal (gym-style billers, one relationship per person) so any Financial
// Relationship, for any biller type, to a person OR a group, can be paused/resumed/ended from
// Person/Group detail. The lifecycle rules themselves are unchanged: this is a UI wrapper around
// the same domain/membership/lifecycle.js functions the membership screen already used.
//
// Props: `relationship` (a membershipRelationships[] row), `targetLabel` (display name of who
// it's for), `onPause(reason, effectiveDate)`, `onResume(effectiveDate)`, `onEnd(reason,
// effectiveDate)` — the caller applies pauseRelationship/resumeRelationship/endRelationship and
// writes the result; this component only collects the inputs those need.

const STATUS_META = {
  active: { label: "Active", icon: "🟢" },
  paused: { label: "Paused", icon: "⏸️" },
  ended: { label: "Ended", icon: "⏹️" },
};

const ACTION_COPY = {
  pause: { title: "Pause this relationship", body: "It stays on record, but drops out of Active until you resume it. Nothing about past Bills or payments changes.", needsReason: true },
  resume: { title: "Resume this relationship", body: "It becomes Active again.", needsReason: false },
  end: { title: "End this relationship", body: "It stays on record for history, but this is terminal — it can't be resumed. A new relationship would need to be created instead.", needsReason: true },
};

export default function RelationshipStatusPanel({ T, relationship, targetLabel, onPause, onResume, onEnd }) {
  const s = fieldStyles(T);
  const today = new Date().toISOString().slice(0, 10);
  const [pendingAction, setPendingAction] = useState(null); // "pause" | "resume" | "end" | null
  const [reason, setReason] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [error, setError] = useState("");

  if (!relationship) return null;
  const status = relationship.status || "active";
  const meta = STATUS_META[status] || { label: status, icon: "" };

  const openAction = kind => { setPendingAction(kind); setReason(""); setEffectiveDate(today); setError(""); };
  const cancel = () => { setPendingAction(null); setError(""); };
  const commit = () => {
    try {
      if (pendingAction === "pause") onPause(reason, effectiveDate);
      else if (pendingAction === "resume") onResume(effectiveDate);
      else if (pendingAction === "end") onEnd(reason, effectiveDate);
      setPendingAction(null);
    } catch (e) {
      setError(e.message || "Could not complete this action.");
    }
  };

  if (pendingAction) {
    const copy = ACTION_COPY[pendingAction];
    return (
      <div style={{ background: T.input, borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
        <div style={{ color: T.text, fontSize: 13, fontWeight: 800, marginBottom: 4 }}>{copy.title}{targetLabel ? ` — ${targetLabel}` : ""}</div>
        <div style={{ color: T.sub, fontSize: 11, lineHeight: 1.5, marginBottom: 10 }}>{copy.body}</div>
        <span style={{ color: T.sub, fontSize: 11 }}>Effective date</span>
        <input style={s.input} type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
        {copy.needsReason ? (
          <div style={{ marginTop: 8 }}>
            <span style={{ color: T.sub, fontSize: 11 }}>Reason</span>
            <input style={s.input} value={reason} onChange={e => setReason(e.target.value)} placeholder={pendingAction === "pause" ? "e.g. Traveling, on hold…" : "e.g. Moved away, no longer needed…"} />
          </div>
        ) : null}
        {error ? <div style={{ color: T.danger, fontSize: 11, marginTop: 6 }}>{error}</div> : null}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
          <button onClick={cancel} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 4px", cursor: "pointer", fontSize: 12, fontWeight: 700, color: T.sub }}>Cancel</button>
          <button data-testid="relationship-action-confirm" onClick={commit} style={{ background: pendingAction === "end" ? T.danger + "22" : T.accentSoft, border: `1px solid ${pendingAction === "end" ? T.danger : T.accent}44`, borderRadius: 12, padding: "10px 4px", cursor: "pointer", fontSize: 12, fontWeight: 800, color: pendingAction === "end" ? T.danger : T.accent }}>Confirm</button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="relationship-status-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.input, borderRadius: 14, padding: "10px 14px", marginBottom: 10 }}>
      <span style={{ color: T.text, fontSize: 12 }}>
        <span style={{ fontWeight: 800 }}>{meta.icon} {meta.label}</span>
        {targetLabel ? <span style={{ color: T.sub }}> — {targetLabel}</span> : null}
      </span>
      <div style={{ display: "flex", gap: 6 }}>
        {status === "active" && <>
          <button data-testid="relationship-pause" onClick={() => openAction("pause")} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 10, padding: "5px 9px", cursor: "pointer", fontSize: 11, fontWeight: 700, color: T.text }}>Pause</button>
          <button data-testid="relationship-end" onClick={() => openAction("end")} style={{ background: "none", border: `1px solid ${T.danger}44`, borderRadius: 10, padding: "5px 9px", cursor: "pointer", fontSize: 11, fontWeight: 700, color: T.danger }}>End</button>
        </>}
        {status === "paused" && <>
          <button data-testid="relationship-resume" onClick={() => openAction("resume")} style={{ background: "none", border: `1px solid ${T.accent}44`, borderRadius: 10, padding: "5px 9px", cursor: "pointer", fontSize: 11, fontWeight: 700, color: T.accent }}>Resume</button>
          <button data-testid="relationship-end" onClick={() => openAction("end")} style={{ background: "none", border: `1px solid ${T.danger}44`, borderRadius: 10, padding: "5px 9px", cursor: "pointer", fontSize: 11, fontWeight: 700, color: T.danger }}>End</button>
        </>}
        {status === "ended" && <span style={{ color: T.sub, fontSize: 11 }}>No further action</span>}
      </div>
    </div>
  );
}
