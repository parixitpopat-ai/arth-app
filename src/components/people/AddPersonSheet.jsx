import React, { useState } from "react";
import BottomSheet from "../BottomSheet";
import { SheetHeader } from "./peopleUi";
import { fieldStyles, RELATION_OPTIONS } from "./peopleStyles";

// UI-2C P-2 — Add person on one screen. Name is the only required field.
// No person type, capability step or colour step: those are set up after
// the person exists (P-3, Edit person).
export default function AddPersonSheet({ T, onClose, onCreate, initialName = "" }) {
  const s = fieldStyles(T);
  const [name, setName] = useState(initialName);
  const [relation, setRelation] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const canCreate = name.trim().length > 0;
  const create = () => { if (canCreate) onCreate({ name, relation, phone, email }); };

  return (
    <BottomSheet T={T} onClose={onClose}>
      <SheetHeader T={T} title="Add person" onCancel={onClose} />
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label><span style={s.label}>Name</span>
          <input data-testid="add-person-name" autoFocus style={s.input} placeholder="Full name" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") create(); }} />
        </label>
        <label><span style={s.label}>Relationship · optional</span>
          <select data-testid="add-person-relation" style={s.input} value={relation} onChange={e => setRelation(e.target.value)}>
            <option value="">Not set</option>
            {RELATION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label><span style={s.label}>Phone · optional</span>
          <input style={s.input} type="tel" inputMode="tel" placeholder="+91" value={phone} onChange={e => setPhone(e.target.value)} />
        </label>
        <label><span style={s.label}>Email · optional</span>
          <input style={s.input} type="email" inputMode="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <div style={s.hint}>Budget, shared expenses, lending, gifts, reminders, notes and colour are set up after the person exists.</div>
        <button data-testid="add-person-create" disabled={!canCreate} onClick={create} style={{ ...s.primary, opacity: canCreate ? 1 : 0.5, cursor: canCreate ? "pointer" : "not-allowed" }}>Create person</button>
      </div>
    </BottomSheet>
  );
}
