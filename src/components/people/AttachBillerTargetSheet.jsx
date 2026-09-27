import React, { useState } from "react";
import BottomSheet from "../BottomSheet";
import { Avatar, SheetHeader } from "./peopleUi";
import { fieldStyles } from "./peopleStyles";

// Payments-side entry point for the Financial Relationship model: the inverse of
// AddRelationshipSheet (which starts from a person/group and picks a biller). Here the biller is
// already known (opened from its own detail sheet, or from a Bill's "Provider" row) and the user
// picks an EXISTING person or group to attach it to. Creating a brand-new person/group from here
// is out of scope — that's People/Groups' own job; this only lists what already exists, matching
// the ask ("attach EXISTING biller account to a person or a group").
export default function AttachBillerTargetSheet({ T, billerAccount, people, groups, onClose, onSelectTarget }) {
  const s = fieldStyles(T);
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const matchesPerson = p => !query || String(p.name || "").toLowerCase().includes(query);
  const matchesGroup = g => !query || String(g.name || "").toLowerCase().includes(query);
  const eligiblePeople = (people || []).filter(p => !p.isMe && !p.archived && matchesPerson(p));
  const eligibleGroups = (groups || []).filter(matchesGroup);
  const me = (people || []).find(p => p.isMe);
  const showMe = me && (!query || "me you".includes(query) || matchesPerson(me));

  return (
    <BottomSheet T={T} onClose={onClose}>
      <SheetHeader T={T} title="Attach to person or group" onCancel={onClose} />
      <div style={{ color: T.sub, fontSize: 12, marginBottom: 10 }}>Attach {billerAccount?.name || "this biller"} to who it belongs to.</div>
      <input style={s.input} placeholder="Search people or groups" value={q} onChange={e => setQ(e.target.value)} />
      <div style={{ marginTop: 10, maxHeight: "50vh", overflowY: "auto" }}>
        {showMe ? (
          <button data-testid="attach-target-me" onClick={() => onSelectTarget({ targetType: "person", targetId: "__me__", targetLabel: "Me" })}
            style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "none", border: "none", borderBottom: `1px solid ${T.border}`, padding: "10px 0", cursor: "pointer", textAlign: "left" }}>
            <Avatar person={me} T={T} size={36} />
            <span style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>Me</span>
          </button>
        ) : null}
        {eligiblePeople.map(p => (
          <button key={p.id} data-testid={`attach-target-person-${p.id}`} onClick={() => onSelectTarget({ targetType: "person", targetId: p.id, targetLabel: p.name })}
            style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "none", border: "none", borderBottom: `1px solid ${T.border}`, padding: "10px 0", cursor: "pointer", textAlign: "left" }}>
            <Avatar person={p} T={T} size={36} />
            <span style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>{p.name}</span>
          </button>
        ))}
        {eligibleGroups.map(g => (
          <button key={g.id} data-testid={`attach-target-group-${g.id}`} onClick={() => onSelectTarget({ targetType: "group", targetId: g.id, targetLabel: g.name })}
            style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "none", border: "none", borderBottom: `1px solid ${T.border}`, padding: "10px 0", cursor: "pointer", textAlign: "left" }}>
            <span style={{ fontSize: 20 }}>{g.icon || "👥"}</span>
            <span style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>{g.name}</span>
          </button>
        ))}
        {!showMe && !eligiblePeople.length && !eligibleGroups.length ? (
          <div style={{ ...s.hint, padding: "10px 0" }}>{query ? "No matching person or group." : "No people or groups yet — add one from People first."}</div>
        ) : null}
      </div>
    </BottomSheet>
  );
}
