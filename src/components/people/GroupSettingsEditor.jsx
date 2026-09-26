import React, { useState } from "react";
import { Switch, SectionLabel } from "./peopleUi";
import { fieldStyles } from "./peopleStyles";
import { addGroupReminder, updateGroupReminder, removeGroupReminder, getSortedGroupReminders } from "../../domain/group/reminders";

// UI-2C G-13 — the parts of Edit group this module adds: switches for the
// six group modules, an optional description, Notes, and Reminders as
// label + date items edited inline. Dates only: nothing is notified.
// Controlled: `value` is { modules, description, notes, reminders }, and
// every change goes through onChange, so nothing is saved until the
// caller's Save.
export default function GroupSettingsEditor({ T, moduleDefs, value, onChange, genId, today }) {
  const s = fieldStyles(T);
  const [editingId, setEditingId] = useState(null); // reminder id, "new", or null
  const [draft, setDraft] = useState({ label: "", date: "" });
  const [error, setError] = useState("");
  const on = new Set(value.modules || []);
  const toggle = id => onChange({ ...value, modules: moduleDefs.map(m => m.id).filter(mid => (mid === id ? !on.has(id) : on.has(mid))) });
  const asGroup = { reminders: value.reminders || [] };
  const list = getSortedGroupReminders(asGroup, today);

  const startEdit = r => { setEditingId(r ? r.id : "new"); setDraft(r ? { label: r.label, date: r.date } : { label: "", date: "" }); setError(""); };
  const saveReminder = () => {
    try {
      const next = editingId === "new" ? addGroupReminder(asGroup, draft, genId) : updateGroupReminder(asGroup, editingId, draft);
      onChange({ ...value, reminders: next.reminders });
      setEditingId(null); setError("");
    } catch (e) { setError(e.message); }
  };
  const deleteReminder = () => {
    if (editingId && editingId !== "new") onChange({ ...value, reminders: removeGroupReminder(asGroup, editingId).reminders });
    setEditingId(null); setError("");
  };

  const ReminderForm = (
    <div data-testid="group-reminder-form" style={{ background: T.input, borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8, margin: "8px 0" }}>
      <label><span style={s.label}>Label</span><input data-testid="group-reminder-label" style={s.input} placeholder="e.g. Gas cylinder" value={draft.label} onChange={e => setDraft({ ...draft, label: e.target.value })} /></label>
      <label><span style={s.label}>Date</span><input data-testid="group-reminder-date" style={s.input} type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></label>
      {error ? <div style={{ color: T.dangerText, fontSize: 12 }}>{error}</div> : null}
      <div style={{ display: "flex", gap: 8 }}>
        {editingId !== "new" ? <button data-testid="group-reminder-delete" onClick={deleteReminder} style={{ ...s.secondary, color: T.dangerText }}>Delete</button> : <button onClick={() => setEditingId(null)} style={s.secondary}>Cancel</button>}
        <button data-testid="group-reminder-save" onClick={saveReminder} style={{ ...s.primary, flex: 1, width: "auto" }}>Save</button>
      </div>
    </div>
  );

  return (
    <div data-testid="group-settings-editor">
      <label><span style={s.label}>Description · optional</span>
        <input data-testid="group-description" style={s.input} placeholder="e.g. Porvorim flat" value={value.description || ""} onChange={e => onChange({ ...value, description: e.target.value })} />
      </label>

      <SectionLabel T={T}>Capabilities</SectionLabel>
      {moduleDefs.map(m => <Switch key={m.id} T={T} testId={`group-module-${m.id}`} on={on.has(m.id)} onChange={() => toggle(m.id)} label={m.label} />)}

      {on.has("notes") ? <>
        <SectionLabel T={T}>Notes</SectionLabel>
        <textarea data-testid="group-notes" style={{ ...s.input, minHeight: 72, padding: "10px 14px", resize: "vertical" }} placeholder="Anything to remember about this group" value={value.notes || ""} onChange={e => onChange({ ...value, notes: e.target.value })} />
      </> : null}

      {on.has("reminders") ? <>
        <SectionLabel T={T}>Reminders</SectionLabel>
        {list.map(r => editingId === r.id ? <div key={r.id}>{ReminderForm}</div> : (
          <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${T.border}`, padding: "10px 0" }}>
            <span style={{ color: r.past ? T.sub : T.text, fontSize: 14 }}>{r.text}</span>
            <button data-testid={`group-reminder-edit-${r.id}`} onClick={() => startEdit(r)} style={{ background: "none", border: "none", color: T.accent, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Edit</button>
          </div>
        ))}
        {editingId === "new" ? ReminderForm : <button data-testid="group-reminder-add" onClick={() => startEdit(null)} style={{ background: "none", border: "none", color: T.accent, fontSize: 13, fontWeight: 700, padding: "10px 0", cursor: "pointer" }}>+ Add reminder</button>}
        <div style={{ ...s.hint, marginTop: 4 }}>A reminder is a label and a date. No notifications are sent.</div>
      </> : null}
    </div>
  );
}
