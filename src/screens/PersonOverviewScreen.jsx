// screens/PersonOverviewScreen.jsx
//
// ARTH-003 Phase B, WP-B1 — the Rich Person Profile's first mobile screen.
// Locked hierarchy per RPP-002 §1 / Rich Person doc §4: Identity →
// Financial Position → Active → Spending → Recent Activity → Groups →
// nav-outs → Edit.
//
// ARCHITECTURE, restated because it's the whole point of this WP:
// - This component creates NO new financial authority. Every number it
//   shows is either passed in already-computed (financial position via
//   the existing `settlements[pid]`) or built by the pure adapters in
//   domain/person/personOverview.js, which themselves only compose
//   existing, injected functions (getPersonAttributedAmount,
//   isDateActiveMembershipCoverage, isSchoolRelationshipCurrent) — never
//   reimplementing what those already do.
// - "View all" / "View Budget" are callback props (onViewAllTransactions,
//   onViewBudget) that the caller wires to the EXISTING Transactions/
//   Budget screens, filtered by this person — never a new screen.
// - Edit is a callback (onEditPerson) delegating to the existing
//   EditPersonModal / setEditingPerson(p) flow — this component has no
//   edit logic of its own.
// - Active section is presence-based (RPP-002 §2/§5/§6, locked) — it
//   renders exactly the `connections` array it's given; it has no concept
//   of PERSON_MODULES and never will.
//
// PROPS CONTRACT — matches the existing screens/SchoolFeesScreen.jsx
// pattern of receiving theme/format helpers as props rather than
// importing App.jsx state directly, so this file has zero App.jsx
// coupling and zero React-context assumptions.
//
// person: the full people[] record for this person (id, name, emoji,
//   color, relation, personType, and — once WP-B2 ships — mobile/email/
//   DOB/anniversary/address/notes; all rendered only "where present",
//   never as empty required fields)
// balance: { owesMe, iOwe } — the EXISTING settlements[person.id] shape,
//   passed in as-is, never recomputed here
// activeConnections: the array getPersonActiveConnections() already
//   produced — this component only renders it, never derives it
// spendingSummary: the shape getPersonSpendingSummary() already produced
// recentActivity: an already-filtered, already-sorted, already-limited
//   array of this person's most recent transactions (the existing
//   personFilterOptions-adjacent mechanism, App.jsx L8223/L8493 — this
//   component does not filter transactions itself)
// T, sym, fmt: the app's existing theme object and currency formatters
// onViewAllTransactions, onViewBudget, onEditPerson, onOpenConnection:
//   navigation callbacks into EXISTING screens/modals

const card = { background: "var(--card-bg, #12151c)", borderRadius: 14, padding: 14, marginBottom: 12 };

export function PersonOverviewScreen({
  person,
  balance,
  activeConnections = [],
  spendingSummary = { total: 0, byCategory: [] },
  recentActivity = [],
  T,
  sym,
  fmt,
  onViewAllTransactions,
  onViewBudget,
  onEditPerson,
  onOpenConnection,
}) {
  if (!person) return null;

  const net = (balance?.owesMe || 0) - (balance?.iOwe || 0);

  return (
    <div style={{ padding: "14px 16px 24px" }}>
      {/* Identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 40 }}>{person.emoji || "👤"}</div>
        <div>
          <div style={{ color: T.text, fontSize: 20, fontWeight: 900 }}>{person.name}</div>
          <div style={{ color: T.sub, fontSize: 12, marginTop: 2 }}>
            {person.personType === "dependant" ? "Dependant" : "Contact"}
            {person.relation ? ` · ${person.relation}` : ""}
          </div>
        </div>
      </div>

      {/* Contact info — rendered only where present, never as empty fields (RPP-002 §1) */}
      {(person.mobile || person.email || person.dob || person.anniversary) && (
        <div style={{ ...card }}>
          {person.mobile && <div style={{ color: T.sub, fontSize: 12, marginBottom: 4 }}>📱 {person.mobile}</div>}
          {person.email && <div style={{ color: T.sub, fontSize: 12, marginBottom: 4 }}>✉️ {person.email}</div>}
          {person.dob && <div style={{ color: T.sub, fontSize: 12, marginBottom: 4 }}>🎂 {person.dob}</div>}
          {person.anniversary && <div style={{ color: T.sub, fontSize: 12 }}>💍 {person.anniversary}</div>}
        </div>
      )}

      {/* Financial position — reuses the existing settlements[pid] shape verbatim */}
      {!person.isMe && (balance?.owesMe > 0 || balance?.iOwe > 0) && (
        <div style={{ ...card }}>
          <div style={{ color: T.text, fontSize: 13, fontWeight: 800, marginBottom: 8 }}>FINANCIAL POSITION</div>
          {balance.owesMe > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: T.sub, fontSize: 13 }}>You owe me</span>
              <span style={{ color: T.success, fontSize: 13, fontWeight: 700 }}>{sym}{fmt(balance.owesMe)}</span>
            </div>
          )}
          {balance.iOwe > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: T.sub, fontSize: 13 }}>I owe them</span>
              <span style={{ color: T.danger, fontSize: 13, fontWeight: 700 }}>{sym}{fmt(balance.iOwe)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
            <span style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>Net</span>
            <span style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>{sym}{fmt(Math.abs(net))}</span>
          </div>
        </div>
      )}

      {/* Active — presence-based, RPP-002 §5/§6 locked. Renders exactly
          what it's given; a hospital expense can never produce an entry
          here because nothing upstream of this component ever builds one
          from a transaction. */}
      {activeConnections.length > 0 && (
        <div style={{ ...card }}>
          <div style={{ color: T.text, fontSize: 13, fontWeight: 800, marginBottom: 8 }}>ACTIVE</div>
          {activeConnections.map(conn => (
            <div
              key={`${conn.type}_${conn.id}`}
              onClick={() => onOpenConnection?.(conn)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}
            >
              <span style={{ fontSize: 18 }}>
                {conn.type === "group" ? (conn.icon || "👨‍👩‍👦") : conn.type === "school" ? "🏫" : "🏋️"}
              </span>
              <span style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{conn.label || conn.schoolId || "Membership"}</span>
            </div>
          ))}
        </div>
      )}

      {/* Spending this month — summary only, full detail via View Budget */}
      {spendingSummary.total > 0 && (
        <div style={{ ...card }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>SPENDING THIS MONTH</div>
            <div style={{ color: T.text, fontSize: 15, fontWeight: 900 }}>{sym}{fmt(spendingSummary.total)}</div>
          </div>
          {spendingSummary.byCategory.slice(0, 5).map(row => (
            <div key={row.catId} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span style={{ color: T.sub, fontSize: 12 }}>{row.icon} {row.name}</span>
              <span style={{ color: T.sub, fontSize: 12 }}>{sym}{fmt(row.amount)}</span>
            </div>
          ))}
          {onViewBudget && (
            <button
              onClick={() => onViewBudget(person.id)}
              style={{ marginTop: 8, background: "none", border: "none", color: T.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}
            >
              View Budget →
            </button>
          )}
        </div>
      )}

      {/* Recent activity — summary only; the caller already computed this
          via the EXISTING person-filtered transaction mechanism */}
      {recentActivity.length > 0 && (
        <div style={{ ...card }}>
          <div style={{ color: T.text, fontSize: 13, fontWeight: 800, marginBottom: 8 }}>RECENT ACTIVITY</div>
          {recentActivity.slice(0, 5).map(t => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span style={{ color: T.sub, fontSize: 12 }}>{t.merchant || t.desc || "Expense"}</span>
              <span style={{ color: T.sub, fontSize: 12 }}>{sym}{fmt(t.amount)}</span>
            </div>
          ))}
          {onViewAllTransactions && (
            <button
              onClick={() => onViewAllTransactions(person.id)}
              style={{ marginTop: 8, background: "none", border: "none", color: T.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}
            >
              View all →
            </button>
          )}
        </div>
      )}

      {/* Empty state — a lightweight Contact with none of the above is a
          valid, expected state, not an error (RPP-002 §1) */}
      {activeConnections.length === 0 && spendingSummary.total === 0 && recentActivity.length === 0 && !(balance?.owesMe > 0 || balance?.iOwe > 0) && (
        <div style={{ color: T.sub, fontSize: 12, textAlign: "center", padding: "24px 0" }}>
          Nothing to show yet for {person.name}.
        </div>
      )}

      {/* Edit — delegates entirely to the existing edit flow */}
      {onEditPerson && (
        <button
          onClick={() => onEditPerson(person)}
          style={{ width: "100%", background: T.accentSoft, border: `1px solid ${T.accent}33`, color: T.accent, borderRadius: 12, padding: "12px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 4 }}
        >
          {person.isMe ? "🎯 Edit My Budget" : "✏️ Edit Profile"}
        </button>
      )}
    </div>
  );
}
