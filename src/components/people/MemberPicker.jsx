import React, { useState } from "react";
import { Avatar } from "./peopleUi";
import { fieldStyles } from "./peopleStyles";

// UI-2C G-11 / G-14 — choose a group's members. Members are always People.
// Search matches existing People first; "Add … as a new person" creates a
// name-only Person (P-2 rules) and ticks it. `me` is the signed-in user,
// shown first and controlled by includeMe, exactly as groups store it.
function MemberRow({ T, person, on, onClick, sub, testId }) {
  return (
    <button data-testid={testId} aria-pressed={on} onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "none", border: "none", borderBottom: `1px solid ${T.border}`, padding: "10px 0", cursor: "pointer", textAlign: "left" }}>
      <Avatar person={person} T={T} size={36} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", color: T.text, fontSize: 14, fontWeight: 600 }}>{person.name}</span>
        {sub ? <span style={{ display: "block", color: T.sub, fontSize: 12 }}>{sub}</span> : null}
      </span>
      <span style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${on ? T.accent : T.borderStrong}`, background: on ? T.accent : "transparent", color: T.bg, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{on ? "✓" : ""}</span>
    </button>
  );
}

export default function MemberPicker({ T, me, people, selectedIds, includeMe, onToggle, onToggleMe, onCreatePerson }) {
  const s = fieldStyles(T);
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const selected = new Set((selectedIds || []).map(String));
  const matches = people.filter(p => !query || String(p.name || "").toLowerCase().includes(query) || String(p.relation || "").toLowerCase().includes(query));
  const exact = people.some(p => String(p.name || "").trim().toLowerCase() === query);
  const showMe = me && (!query || "me you".includes(query) || String(me.name || "").toLowerCase().includes(query));


  return (
    <div>
      <input data-testid="member-search" style={s.input} placeholder="Search people" value={q} onChange={e => setQ(e.target.value)} />
      <div style={{ marginTop: 6 }}>
        {showMe ? <MemberRow T={T} person={me} on={includeMe} onClick={() => onToggleMe(!includeMe)} sub="You" testId="member-me" /> : null}
        {matches.map(p => <MemberRow key={p.id} T={T} person={p} on={selected.has(String(p.id))} onClick={() => onToggle(p.id)} sub={p.relation || ""} testId={`member-${p.id}`} />)}
        {query && !exact ? (
          <button data-testid="member-create" onClick={() => { onCreatePerson(q.trim()); setQ(""); }} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", width: "100%", background: "none", border: "none", padding: "12px 0", cursor: "pointer", textAlign: "left" }}>
            <span style={{ color: T.accent, fontSize: 14, fontWeight: 700 }}>+ Add “{q.trim()}” as a new person</span>
            <span style={{ color: T.sub, fontSize: 12, marginTop: 2 }}>Name only. Details can be added later.</span>
          </button>
        ) : null}
        {!query && !matches.length ? <div style={{ ...s.hint, padding: "10px 0" }}>Type a name to add a new person.</div> : null}
      </div>
    </div>
  );
}
