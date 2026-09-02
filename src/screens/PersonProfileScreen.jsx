// screens/PersonProfileScreen.jsx
//
// Full Person Profile matching the approved mockup (10 screenshots,
// this session). Collapsible + reorderable sections, honest empty/
// unavailable states — NEVER fabricates data the current architecture
// can't provide (School/Insurance shown only when real; Groups' net
// position shown only where the underlying calculation exists; Statement
// shown as unavailable, not invented).
//
// ARCHITECTURE, restated because it's the whole point:
// - No new financial authority. Every number is either passed in
//   already-computed (settlements[p.id]) or built by the pure adapters in
//   domain/person/*.js, which themselves only compose existing, injected
//   functions — never reimplementing what those already do.
// - Groups' per-group net position (owesMe direction confirmed real via
//   getGroupMemberOwed; iOwe direction is PPL-002 WP-3, still genuinely
//   absent) — shown ONLY when both directions are actually available for
//   a given group, otherwise that group's row omits the figure rather
//   than showing a wrong or half-computed number.
// - Organisations: Membership shown with its real resolved name where
//   available. School/Insurance shown ONLY if a real relationship record
//   is passed in — no placeholder cards.
// - Capabilities: Gifts/Debt Transfer/Tagged Accounts are existing,
//   passed-through render props (this component doesn't reimplement
//   them). Statement is shown as unavailable unless the caller explicitly
//   passes a real handler — this session's trace found no existing
//   statement/share mechanism, so by default it renders honestly absent.
// - Reminders are DISPLAY ONLY — this component makes no claim that a
//   notification is scheduled, because no such infrastructure was found
//   to exist.
//
// PROPS CONTRACT — same pattern as the original PersonOverviewScreen.jsx:
// theme/format helpers and all data/callbacks passed in, zero App.jsx
// state coupling, zero assumptions about what exists beyond what's given.

import { getPersonAboutFields, getAboutCompleteness, getPersonNotes } from "../domain/person/about";
import { getFinancialPositionLabel, getFinancialPositionBreakdown } from "../domain/person/financialPosition";
import { getPersonSixMonthActivity } from "../domain/person/activity";
import { getPersonReminders } from "../domain/person/reminders";
import { getSectionOrder, moveSection } from "../domain/person/sectionOrder";
import { getPersonTypeUILabel } from "../domain/person/personType";

const cardBase = { borderRadius: 14, padding: 14, marginBottom: 12 };
const sectionHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" };

function SectionShell({ T, title, badge, isExpanded, onToggle, arranging, onMoveUp, onMoveDown, canMoveUp, canMoveDown, children }) {
  return (
    <div style={{ ...cardBase, background: T.card }}>
      <div onClick={arranging ? undefined : onToggle} style={{ ...sectionHeader, cursor: arranging ? "default" : "pointer" }}>
        <div>
          <div style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>{title}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {badge != null && <span style={{ background: T.input, color: T.sub, fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "2px 8px" }}>{badge}</span>}
          {arranging ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button disabled={!canMoveUp} onClick={onMoveUp} style={{ background: "none", border: "none", color: canMoveUp ? T.accent : T.sub, cursor: canMoveUp ? "pointer" : "default", fontSize: 11, padding: 0 }}>▲</button>
              <button disabled={!canMoveDown} onClick={onMoveDown} style={{ background: "none", border: "none", color: canMoveDown ? T.accent : T.sub, cursor: canMoveDown ? "pointer" : "default", fontSize: 11, padding: 0 }}>▼</button>
            </div>
          ) : (
            <span style={{ color: T.sub, fontSize: 12 }}>{isExpanded ? "▾" : "▸"}</span>
          )}
        </div>
      </div>
      {isExpanded && !arranging && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
}

export function PersonProfileScreen({
  person,
  balance,                 // settlements[person.id] — existing, authoritative, unchanged
  txns = [], bills = [],
  groups = [],              // real groups[] this person belongs to (caller pre-filters)
  groupOwedByMe = {},       // { [groupId]: amount|undefined } — getGroupMemberOwed direction, per group
  groupIOweMap = {},        // { [groupId]: amount|undefined } — PPL-002 WP-3 direction; omit or leave
                            //   undefined for a group where this isn't computed yet — the UI shows
                            //   that group's figure as unavailable rather than guessing
  membershipRelationships = [],
  schoolRelationships = [], // real, only ever non-empty once Phase E wires real state — empty today, by design
  insuranceRelationships = [], // real, only non-empty once Insurance gets a personId field — empty today
  resolveOrganisationInfo,  // (relationship) => {name, icon, statusLabel}|null — real
                            // name/icon/status resolver, injected. Resolves each
                            // relationship's ACTUAL biller type (Gym/Insurance/School
                            // Fees/etc.) rather than assuming what it is — fixes a real
                            // bug where every Membership entry showed a hardcoded gym
                            // icon regardless of what it actually was (an Insurance
                            // policy showed as "Membership 🏋️" until this was caught).
  gifts = [],
  giftsSection,          // full existing Gifts block (list, filters, +Gift button), passed through as-is
  debtTransferSection,      // existing rendered content/handler, passed through as-is
  taggedAccountsSection,    // existing rendered content/handler, passed through as-is
  recentActivityFeed,       // optional array of pre-built {key, node} items — the existing
                            // Activity Feed's real content, folded into this section instead
                            // of duplicated in a separate standalone block
  onShareStatement,         // if absent, Statement renders as honestly unavailable
  getPersonAttributedAmount,
  isDateActiveMembershipCoverage,
  today,                    // "YYYY-MM-DD", injected for determinism
  T, sym, fmt,
  expandedSection, setExpandedSection, // reuses the app's existing generic toggle state
  arranging, setArranging,
  onSaveSectionOrder,       // (newOrder) => void — persists to person.sectionOrder
  onEditPerson, onArchivePerson, onSettle, onRequest,
  onViewAllTransactions, onOpenTxn, // onOpenTxn should call the existing setTxnDetailId(txn.id)
  onOpenConnection,
  onViewUnsettled,          // preserves the pre-existing Unsettled-drill-down trigger — if provided,
                            // tapping "They owe me" (when > 0) calls this instead of just displaying the figure
}) {
  if (!person) return null;

  const sectionOrder = getSectionOrder(person);
  const isExpanded = key => expandedSection === `profile_${key}_${person.id}`;
  const toggle = key => setExpandedSection(prev => prev === `profile_${key}_${person.id}` ? null : `profile_${key}_${person.id}`);

  const positionLabel = getFinancialPositionLabel(balance);
  const breakdown = getFinancialPositionBreakdown(person.id, txns, bills, getPersonAttributedAmount);
  const aboutFields = getPersonAboutFields(person);
  const aboutCompleteness = getAboutCompleteness(person);
  const notes = getPersonNotes(person);
  const activity = getPersonSixMonthActivity(person.id, txns, getPersonAttributedAmount, today);
  const reminders = getPersonReminders(person, today);
  const uiTypeLabel = getPersonTypeUILabel(person.personType);

  // Shows every real relationship, any status — resolveOrganisationInfo
  // returns a real statusLabel (Active/Paused/Ended) per entry, rather
  // than filtering to active-only and hardcoding "Active" for everything.
  const allMemberships = membershipRelationships.filter(r => r.personId === person.id);
  const activeMemberships = allMemberships; // kept name for organisationCount below
  const activeSchool = schoolRelationships.filter(r => r.personId === person.id && isDateActiveMembershipCoverage(today, r.statusHistory));
  const activeInsurance = insuranceRelationships.filter(r => r.personId === person.id);
  const organisationCount = activeMemberships.length + activeSchool.length + activeInsurance.length;

  const sections = {
    about: () => (
      <SectionShell T={T} title="ABOUT" badge={`${aboutCompleteness.filled}/${aboutCompleteness.total}`}
        isExpanded={isExpanded("about")} onToggle={() => toggle("about")}
        arranging={arranging} onMoveUp={() => onSaveSectionOrder(moveSection(sectionOrder, "about", "up"))} onMoveDown={() => onSaveSectionOrder(moveSection(sectionOrder, "about", "down"))}
        canMoveUp={sectionOrder.indexOf("about") > 0} canMoveDown={sectionOrder.indexOf("about") < sectionOrder.length - 1}>
        {aboutFields.map(f => (
          <div key={f.key} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
            <span style={{ color: T.sub, fontSize: 12 }}>{f.label}</span>
            <span style={{ color: f.hasValue ? T.text : T.sub, fontSize: 13, fontStyle: f.hasValue ? "normal" : "italic" }}>{f.hasValue ? f.value : "Not added"}</span>
          </div>
        ))}
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
          <div style={{ color: T.sub, fontSize: 11, fontWeight: 700, marginBottom: 4 }}>NOTES</div>
          <div style={{ color: notes.hasValue ? T.text : T.sub, fontSize: 13, fontStyle: notes.hasValue ? "normal" : "italic" }}>{notes.hasValue ? notes.value : "No notes yet."}</div>
        </div>
        {onEditPerson && <button onClick={() => onEditPerson(person)} style={{ marginTop: 8, background: "none", border: "none", color: T.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}>Edit personal details →</button>}
      </SectionShell>
    ),

    financialPosition: () => (
      <SectionShell T={T} title="FINANCIAL POSITION" badge={positionLabel.amount > 0 ? `${sym}${fmt(positionLabel.amount)}` : null}
        isExpanded={isExpanded("financialPosition")} onToggle={() => toggle("financialPosition")}
        arranging={arranging} onMoveUp={() => onSaveSectionOrder(moveSection(sectionOrder, "financialPosition", "up"))} onMoveDown={() => onSaveSectionOrder(moveSection(sectionOrder, "financialPosition", "down"))}
        canMoveUp={sectionOrder.indexOf("financialPosition") > 0} canMoveDown={sectionOrder.indexOf("financialPosition") < sectionOrder.length - 1}>
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <div style={{ color: positionLabel.state === "balanced" ? T.sub : (positionLabel.state === "owed_to_me" ? T.success : T.danger), fontSize: 24, fontWeight: 900 }}>
            {positionLabel.state === "balanced" ? "Balanced" : `${sym}${fmt(positionLabel.amount)}`}
          </div>
          {positionLabel.state !== "balanced" && <div style={{ color: T.sub, fontSize: 12 }}>{positionLabel.label}</div>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
          <div style={{ background: T.input, borderRadius: 10, padding: "8px 10px", textAlign: "center", cursor: (onViewUnsettled && positionLabel.owesMe > 0) ? "pointer" : "default" }} onClick={() => { if (onViewUnsettled && positionLabel.owesMe > 0) onViewUnsettled(person); }}>
            <div style={{ color: T.sub, fontSize: 11 }}>They owe me{onViewUnsettled && positionLabel.owesMe > 0 ? " ▾" : ""}</div>
            <div style={{ color: T.success, fontSize: 14, fontWeight: 800 }}>{sym}{fmt(positionLabel.owesMe)}</div>
          </div>
          <div style={{ background: T.input, borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
            <div style={{ color: T.sub, fontSize: 11 }}>I owe them</div>
            <div style={{ color: T.danger, fontSize: 14, fontWeight: 800 }}>{sym}{fmt(positionLabel.iOwe)}</div>
          </div>
        </div>
        {breakdown.length > 0 && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
            <div style={{ color: T.sub, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>HOW THIS IS WORKED OUT</div>
            <div style={{ color: T.sub, fontSize: 11, marginBottom: 6 }}>Not a stored balance — recalculated from these each time.</div>
            {breakdown.slice(0, 8).map(item => (
              <div key={`${item.kind}_${item.id}`} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                <span style={{ color: T.sub, fontSize: 12 }}>{item.desc}</span>
                <span style={{ color: item.mode === "owesMe" ? T.success : T.danger, fontSize: 12 }}>{sym}{fmt(item.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </SectionShell>
    ),

    groups: () => (
      <SectionShell T={T} title="GROUPS" badge={groups.length || null}
        isExpanded={isExpanded("groups")} onToggle={() => toggle("groups")}
        arranging={arranging} onMoveUp={() => onSaveSectionOrder(moveSection(sectionOrder, "groups", "up"))} onMoveDown={() => onSaveSectionOrder(moveSection(sectionOrder, "groups", "down"))}
        canMoveUp={sectionOrder.indexOf("groups") > 0} canMoveDown={sectionOrder.indexOf("groups") < sectionOrder.length - 1}>
        {groups.length === 0 && <div style={{ color: T.sub, fontSize: 12 }}>No shared groups.</div>}
        {groups.map(g => {
          const owed = groupOwedByMe[g.id];
          const iOwe = groupIOweMap[g.id];
          // Only show a net figure when BOTH directions are actually available for
          // this group — never a half-computed or guessed number.
          const netAvailable = owed !== undefined && iOwe !== undefined;
          const net = netAvailable ? owed - iOwe : null;
          return (
            <div key={g.id} onClick={() => onOpenConnection?.({ type: "group", id: g.id })} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
              <div>
                <div style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{g.icon || "👨‍👩‍👦"} {g.name}</div>
                <div style={{ color: T.sub, fontSize: 11 }}>{(g.members || []).length} people</div>
              </div>
              {netAvailable ? (
                <span style={{ color: net === 0 ? T.sub : (net > 0 ? T.success : T.danger), fontSize: 12, fontWeight: 700 }}>
                  {net === 0 ? "Settled" : `${net > 0 ? "+" : ""}${sym}${fmt(Math.abs(net))}`}
                </span>
              ) : (
                <span style={{ color: T.sub, fontSize: 11, fontStyle: "italic" }}>Not available yet</span>
              )}
            </div>
          );
        })}
      </SectionShell>
    ),

    organisations: () => (
      <SectionShell T={T} title="ORGANISATIONS / RELATIONSHIPS" badge={organisationCount || null}
        isExpanded={isExpanded("organisations")} onToggle={() => toggle("organisations")}
        arranging={arranging} onMoveUp={() => onSaveSectionOrder(moveSection(sectionOrder, "organisations", "up"))} onMoveDown={() => onSaveSectionOrder(moveSection(sectionOrder, "organisations", "down"))}
        canMoveUp={sectionOrder.indexOf("organisations") > 0} canMoveDown={sectionOrder.indexOf("organisations") < sectionOrder.length - 1}>
        {organisationCount === 0 && <div style={{ color: T.sub, fontSize: 12 }}>None recorded.</div>}
        {activeMemberships.map(rel => {
          const info = resolveOrganisationInfo?.(rel) || { name: "Membership", icon: "🔖", statusLabel: null };
          return (
            <div key={rel.id} onClick={() => onOpenConnection?.({ type: "membership", id: rel.id })} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
              <span style={{ fontSize: 18 }}>{info.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{info.name}</div>
              </div>
              {info.statusLabel && (
                <span style={{
                  fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "2px 8px",
                  background: info.statusLabel === "Active" ? T.success + "22" : info.statusLabel === "Paused" ? (T.warn || T.accent) + "22" : T.border,
                  color: info.statusLabel === "Active" ? T.success : info.statusLabel === "Paused" ? (T.warn || T.accent) : T.sub,
                }}>{info.statusLabel}</span>
              )}
            </div>
          );
        })}
        {/* School/Insurance ONLY render if the caller actually passed real, active
            relationship records — no placeholder card, ever, per explicit instruction. */}
        {activeSchool.map(rel => (
          <div key={rel.id} onClick={() => onOpenConnection?.({ type: "school", id: rel.id })} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
            <span style={{ fontSize: 18 }}>🏫</span>
            <div style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{resolveOrganisationInfo?.(rel)?.name || "School"}</div>
          </div>
        ))}
        {activeInsurance.map(rel => (
          <div key={rel.id} onClick={() => onOpenConnection?.({ type: "insurance", id: rel.id })} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
            <span style={{ fontSize: 18 }}>🛡️</span>
            <div style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{resolveOrganisationInfo?.(rel)?.name || "Insurance"}</div>
          </div>
        ))}
      </SectionShell>
    ),

    activity: () => (
      <SectionShell T={T} title="ACTIVITY" badge={activity.transactionCount || null}
        isExpanded={isExpanded("activity")} onToggle={() => toggle("activity")}
        arranging={arranging} onMoveUp={() => onSaveSectionOrder(moveSection(sectionOrder, "activity", "up"))} onMoveDown={() => onSaveSectionOrder(moveSection(sectionOrder, "activity", "down"))}
        canMoveUp={sectionOrder.indexOf("activity") > 0} canMoveDown={sectionOrder.indexOf("activity") < sectionOrder.length - 1}>
        <div style={{ color: T.sub, fontSize: 11 }}>Last 6 months</div>
        <div style={{ color: T.text, fontSize: 20, fontWeight: 900, marginBottom: 8 }}>{sym}{fmt(activity.totalOverPeriod)}</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60, marginBottom: 8 }}>
          {activity.months.map(m => {
            const max = Math.max(...activity.months.map(x => x.total), 1);
            const h = Math.max(4, (m.total / max) * 56);
            return (
              <div key={m.key} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ background: T.accent, height: h, borderRadius: 4, marginBottom: 2 }} />
                <div style={{ color: T.sub, fontSize: 9 }}>{m.label}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <div style={{ background: T.input, borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
            <div style={{ color: T.sub, fontSize: 11 }}>Monthly average</div>
            <div style={{ color: T.text, fontSize: 14, fontWeight: 800 }}>{sym}{fmt(Math.round(activity.monthlyAverage))}</div>
          </div>
          <div style={{ background: T.input, borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
            <div style={{ color: T.sub, fontSize: 11 }}>Transactions</div>
            <div style={{ color: T.text, fontSize: 14, fontWeight: 800 }}>{activity.transactionCount}</div>
          </div>
        </div>
        {recentActivityFeed && recentActivityFeed.length > 0 && (
          <div style={{ marginBottom: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
            <div style={{ color: T.sub, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>RECENT ACTIVITY</div>
            {recentActivityFeed.map(item => <div key={item.key}>{item.node}</div>)}
          </div>
        )}
        {onViewAllTransactions && (
          <button onClick={() => onViewAllTransactions(person.id)} style={{ background: "none", border: "none", color: T.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}>
            See all {activity.transactionCount} transactions →
          </button>
        )}
      </SectionShell>
    ),

    capabilities: () => (
      <SectionShell T={T} title="EXISTING CAPABILITIES" badge={null}
        isExpanded={isExpanded("capabilities")} onToggle={() => toggle("capabilities")}
        arranging={arranging} onMoveUp={() => onSaveSectionOrder(moveSection(sectionOrder, "capabilities", "up"))} onMoveDown={() => onSaveSectionOrder(moveSection(sectionOrder, "capabilities", "down"))}
        canMoveUp={sectionOrder.indexOf("capabilities") > 0} canMoveDown={sectionOrder.indexOf("capabilities") < sectionOrder.length - 1}>
        {/* Gifts, Debt Transfer, Tagged Accounts — existing functionality, rendered
            via caller-supplied content, never reimplemented here. Each is the
            REAL, full block (not a summary) — moved here from its old standalone
            position so it isn't shown twice on the same screen. */}
        {giftsSection ? (
          <div style={{ padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>{giftsSection}</div>
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
            <span style={{ color: T.text, fontSize: 13 }}>🎁 Gifts</span>
            <span style={{ color: T.sub, fontSize: 12 }}>{gifts.filter(g => String(g.personId) === String(person.id)).length}</span>
          </div>
        )}
        {debtTransferSection && <div style={{ padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>{debtTransferSection}</div>}
        {taggedAccountsSection && <div style={{ padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>{taggedAccountsSection}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
          <span style={{ color: T.text, fontSize: 13 }}>📄 Statement</span>
          {onShareStatement ? (
            <button onClick={() => onShareStatement(person)} style={{ background: "none", border: "none", color: T.accent, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Share</button>
          ) : (
            <span style={{ color: T.sub, fontSize: 11, fontStyle: "italic" }}>Not available yet</span>
          )}
        </div>
      </SectionShell>
    ),

    reminders: () => reminders.length > 0 && (
      <SectionShell T={T} title="REMINDERS" badge={reminders.length}
        isExpanded={isExpanded("reminders")} onToggle={() => toggle("reminders")}
        arranging={arranging} onMoveUp={() => onSaveSectionOrder(moveSection(sectionOrder, "reminders", "up"))} onMoveDown={() => onSaveSectionOrder(moveSection(sectionOrder, "reminders", "down"))}
        canMoveUp={sectionOrder.indexOf("reminders") > 0} canMoveDown={sectionOrder.indexOf("reminders") < sectionOrder.length - 1}>
        {reminders.map(r => (
          <div key={r.type} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
            <span style={{ color: T.text, fontSize: 13 }}>{r.type === "birthday" ? "🎂" : "💍"} {r.label}</span>
            <span style={{ color: T.sub, fontSize: 12 }}>{r.label} in {r.daysAway}d ({r.label && r.nextDate ? r.label : ""})</span>
          </div>
        ))}
        <div style={{ color: T.sub, fontSize: 10, marginTop: 6 }}>Shown based on the dates in About — no notification is scheduled.</div>
      </SectionShell>
    ),
  };

  return (
    <div style={{ padding: "14px 16px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 40 }}>{person.emoji || "👤"}</div>
          <div>
            <div style={{ color: T.text, fontSize: 20, fontWeight: 900 }}>{person.name} {person.favorite && <span style={{ color: "#f0a500" }}>★</span>}</div>
            <div style={{ color: T.sub, fontSize: 12 }}>{uiTypeLabel || person.personType}{person.relation ? ` · ${person.relation}` : ""}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setArranging(prev => !prev)} style={{ background: arranging ? T.accent : "none", border: `1px solid ${T.accent}`, color: arranging ? "#fff" : T.accent, borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{arranging ? "Done" : "Arrange"}</button>
          {onEditPerson && <button onClick={() => onEditPerson(person)} style={{ background: "none", border: `1px solid ${T.border}`, color: T.text, borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Edit</button>}
        </div>
      </div>

      {arranging && (
        <div style={{ background: T.accentSoft || T.input, borderRadius: 10, padding: 10, marginBottom: 12, color: T.sub, fontSize: 12 }}>
          Move sections up or down. The order is remembered for this person.
        </div>
      )}

      {sectionOrder.map(key => <div key={key}>{sections[key]?.()}</div>)}

      {/* Actions — existing Settle/Request/Edit/Archive, unchanged logic, passed through */}
      {!person.isMe && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {onSettle && positionLabel.owesMe > 0 && <button onClick={() => onSettle(person)} style={{ flex: 1, background: T.accentSoft, border: `1px solid ${T.accent}33`, color: T.accent, borderRadius: 12, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Settle</button>}
          {onRequest && positionLabel.owesMe > 0 && <button onClick={() => onRequest(person)} style={{ flex: 1, background: "none", border: `1px solid ${T.border}`, color: T.text, borderRadius: 12, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Request</button>}
          {onArchivePerson && <button onClick={() => onArchivePerson(person)} style={{ flex: 1, background: "transparent", border: `1px solid ${T.danger}`, color: T.danger, borderRadius: 12, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>🗄️ Archive</button>}
        </div>
      )}
    </div>
  );
}
