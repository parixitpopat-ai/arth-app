import React, { useState } from "react";
import BottomSheet from "../BottomSheet";
import { SheetHeader, ChoiceChip } from "./peopleUi";
import { fieldStyles } from "./peopleStyles";
import MemberPicker from "./MemberPicker";

// UI-2C G-11 — Add group on one screen, replacing the three-step wizard.
// Only the name is required. No notes, reminders, budget or colour here:
// creation is identity-only; those live in Edit group.
export default function AddGroupSheet({ T, me, people, groupTypes, onClose, onCreate, onCreatePerson }) {
  const s = fieldStyles(T);
  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState("");
  const [members, setMembers] = useState([]);
  const [includeMe, setIncludeMe] = useState(true);
  const [description, setDescription] = useState("");
  const canCreate = name.trim().length > 0;
  const toggle = id => setMembers(prev => prev.map(String).includes(String(id)) ? prev.filter(x => String(x) !== String(id)) : [...prev, id]);
  const createPerson = personName => { const p = onCreatePerson(personName); if (p) setMembers(prev => [...prev, p.id]); };

  return (
    <BottomSheet T={T} onClose={onClose} maxHeight="92vh">
      <SheetHeader T={T} title="Add group" onCancel={onClose} />
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label><span style={s.label}>Group name</span>
          <input data-testid="add-group-name" autoFocus style={s.input} placeholder="e.g. Goa Household" value={name} onChange={e => setName(e.target.value)} />
        </label>
        <div><span style={s.label}>Type · optional</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {groupTypes.map(t => <ChoiceChip key={t.id} T={T} testId={`add-group-type-${t.id}`} on={typeId === t.id} onClick={() => setTypeId(typeId === t.id ? "" : t.id)}>{t.icon} {t.label}</ChoiceChip>)}
          </div>
        </div>
        <div><span style={s.label}>Members · optional</span>
          <MemberPicker T={T} me={me} people={people} selectedIds={members} includeMe={includeMe} onToggle={toggle} onToggleMe={setIncludeMe} onCreatePerson={createPerson} />
        </div>
        <label><span style={s.label}>Description · optional</span>
          <input style={s.input} placeholder="e.g. Porvorim flat" value={description} onChange={e => setDescription(e.target.value)} />
        </label>
        <button data-testid="add-group-create" disabled={!canCreate} onClick={() => canCreate && onCreate({ name, typeId, members, includeMe, description })} style={{ ...s.primary, opacity: canCreate ? 1 : 0.5, cursor: canCreate ? "pointer" : "not-allowed" }}>Create group</button>
      </div>
    </BottomSheet>
  );
}
