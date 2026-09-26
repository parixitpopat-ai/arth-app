import React, { useState } from "react";
import BottomSheet from "../BottomSheet";
import { Avatar, ChoiceChip, Segmented3, SectionLabel } from "./peopleUi";
import { fieldStyles } from "./peopleStyles";
import { SPLIT_DEFAULT_OPTIONS, getSplitDefaultChoice } from "../../domain/person/splitDefault";

// UI-2C P-3 — the optional screen shown once a person is created. Chips use
// the stored module names; Default expense split is asked here because Add
// person no longer asks Family or Contact. Skip keeps everything as created
// (Ask each time, P-3 Option A).
export default function PersonSetupSheet({ T, person, modules, onSkip, onOpen, onAddRelationship }) {
  const s = fieldStyles(T);
  const first = String(person.name || "").trim().split(/\s+/)[0] || person.name;
  const [on, setOn] = useState(() => new Set(person.modules || []));
  const [split, setSplit] = useState(() => getSplitDefaultChoice(person) || "ask");
  const toggle = id => setOn(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const setup = () => ({ modules: modules.map(m => m.id).filter(id => on.has(id)), split });

  return (
    <BottomSheet T={T} onClose={onSkip}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 8, marginBottom: 6 }}>
        <Avatar person={person} T={T} size={56} />
        <div style={{ color: T.text, fontSize: 18, fontWeight: 700 }}>{person.name} added</div>
        <div style={{ color: T.sub, fontSize: 13 }}>{person.relation ? `${person.relation} · ` : ""}you can set things up now or later</div>
      </div>

      <SectionLabel T={T}>Turn on for {first} · optional</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {modules.map(m => <ChoiceChip key={m.id} T={T} testId={`setup-module-${m.id}`} on={on.has(m.id)} onClick={() => toggle(m.id)}>{m.label}</ChoiceChip>)}
      </div>

      <SectionLabel T={T}>Default expense split</SectionLabel>
      <Segmented3 T={T} options={SPLIT_DEFAULT_OPTIONS} value={split} onChange={setSplit} testIdPrefix="setup-split" />
      <div style={{ ...s.hint, marginTop: 8 }}>Used when you add an expense with {first}. Change it any time in Edit.</div>

      {onAddRelationship ? <>
        <SectionLabel T={T}>Something you manage for {first}?</SectionLabel>
        <button data-testid="setup-add-relationship" onClick={() => onAddRelationship(setup())} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", width: "100%", background: T.input, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer", textAlign: "left" }}>
          <span style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>Add a financial relationship</span>
          <span style={{ color: T.sub, fontSize: 12, marginTop: 2 }}>Mobile, healthcare, insurance, education…</span>
        </button>
      </> : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10, marginTop: 20 }}>
        <button data-testid="setup-skip" onClick={onSkip} style={s.secondary}>Skip</button>
        <button data-testid="setup-open" onClick={() => onOpen(setup())} style={s.primary}>Open {first}</button>
      </div>
    </BottomSheet>
  );
}
