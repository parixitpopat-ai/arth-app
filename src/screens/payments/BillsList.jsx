import React from "react";
import { FONT, RADIUS, statusStyle } from "../../constants/theme";
import { getBillPeriodLabel, getSplitProgressText, getCardVerificationText, formatDayMonth } from "../../domain/bills/paymentsView";

// UI-2C M2 PY-18 Bills and PY-27 "All bills paid". Read-only: the caller passes the view model
// from buildPaymentsView() and handlers; this file computes no money.

const BADGE_STATUS = { overdue: "overdue", partial: "partial", due: "due", unpaid: "upcoming", paid: "paid", cancelled: "writtenOff" };

function Badge({ T, row }) {
  return <span data-testid={`badge-${row.bill.id}`} style={statusStyle(BADGE_STATUS[row.badge.kind], T)}>{row.badgeText.text}</span>;
}

function BillRow({ T, row, sym, fmt, onOpen, txns }) {
  const b = row.bill;
  const bal = row.badge.balance;
  const unassigned = row.forText === "Unassigned";
  const extra = b.isCcStatement ? getCardVerificationText(b) : getSplitProgressText(b, txns);
  const showDueInSub = row.badge.kind === "overdue" || row.badge.kind === "partial" || row.badge.kind === "unpaid";
  return (
    <button data-testid={`bill-row-${b.id}`} onClick={() => onOpen(b)} style={{ display: "flex", gap: 12, width: "100%", background: T.card, border: `1px solid ${row.badge.kind === "overdue" ? T.danger + "55" : T.border}`, borderRadius: 14, padding: "12px 14px", marginBottom: 8, cursor: "pointer", textAlign: "left", fontFamily: FONT.sans }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", color: T.text, fontSize: 14, fontWeight: 700 }}>{b.name}{getBillPeriodLabel(b) ? ` · ${getBillPeriodLabel(b)}` : ""}</span>
        <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 4, color: T.sub, fontSize: 12 }}>
          <span style={unassigned ? { border: `1px dashed ${T.borderStrong}`, borderRadius: RADIUS.pill, padding: "0 8px" } : null}>{row.forText}</span>
          {extra ? <span>· {extra}</span> : null}
          {showDueInSub && b.dueDate ? <span>· due {formatDayMonth(b.dueDate)}</span> : null}
        </span>
      </span>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        <span style={{ color: T.text, fontSize: 15, fontWeight: 600, fontFamily: FONT.mono }}>{sym}{fmt(bal.amount)}</span>
        {bal.status === "partial" ? <span style={{ color: T.sub, fontSize: 11, fontFamily: FONT.mono }}>{sym}{fmt(bal.paid)} of {sym}{fmt(bal.amount)}</span> : null}
        <Badge T={T} row={row} />
      </span>
    </button>
  );
}

// ADR-039 / Arth 2.0 IA Redesign.dc.html D1 — "Expected · not bills yet". Dashed, never a badge,
// never a due-date urgency color: Expected is a forecast, not a Bill (never Due/Overdue/payable).
// Tapping one opens its Relationship, where Confirm amount (bill.fromSchedule) lives.
function ExpectedRow({ T, row, sym, fmt, onOpen }) {
  const e = row.expected;
  return (
    <button data-testid={`expected-row-${e.relationshipId}`} onClick={() => onOpen(e)} style={{ display: "flex", gap: 12, width: "100%", background: "transparent", border: `1px dashed ${T.borderStrong}`, borderRadius: 14, padding: "12px 14px", marginBottom: 8, cursor: "pointer", textAlign: "left", fontFamily: FONT.sans }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", color: T.sub, fontSize: 14, fontWeight: 700 }}>{row.forText}</span>
        <span style={{ display: "block", color: T.sub, fontSize: 12, marginTop: 2 }}>Expected {formatDayMonth(e.dueDate)}</span>
      </span>
      <span style={{ color: T.sub, fontSize: 15, fontWeight: 600, fontFamily: FONT.mono, flexShrink: 0 }}>{sym}{fmt(e.amount)}</span>
    </button>
  );
}

// School Fees/Subscription/Membership renewal reminders (domain/bills/renewalReminders.js) —
// deliberately NOT Bills (ADR-039 §9), shown dashed like Expected, per the user's own explicit
// direction: visible here so they're not invisible in the one screen a person checks what's due,
// without becoming a Bill. Tapping opens the underlying Biller Account, not a Bill detail sheet.
function RenewalRow({ T, row, sym, fmt, onOpen }) {
  const overdue = row.kind === "overdue";
  return (
    <button data-testid={`renewal-row-${row.id}`} onClick={() => onOpen(row)} style={{ display: "flex", gap: 12, width: "100%", background: "transparent", border: `1px dashed ${overdue ? T.danger + "88" : T.borderStrong}`, borderRadius: 14, padding: "12px 14px", marginBottom: 8, cursor: "pointer", textAlign: "left", fontFamily: FONT.sans }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", color: T.text, fontSize: 14, fontWeight: 700 }}>{row.name}{row.forText ? ` · ${row.forText}` : ""}</span>
        <span style={{ display: "block", color: overdue ? T.danger : T.sub, fontSize: 12, marginTop: 2 }}>{overdue ? `${row.days} day${row.days === 1 ? "" : "s"} overdue` : `Renewing in ${row.days} day${row.days === 1 ? "" : "s"}`}</span>
      </span>
      <span style={{ color: T.sub, fontSize: 15, fontWeight: 600, fontFamily: FONT.mono, flexShrink: 0 }}>{sym}{fmt(row.amount)}</span>
    </button>
  );
}

function Group({ T, title, rows, ...rest }) {
  if (!rows.length) return null;
  return (
    <div data-testid={`group-${title}`}>
      <div style={{ color: T.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: "16px 0 8px" }}>{title}</div>
      {rows.map(r => <BillRow key={r.bill.id} T={T} row={r} {...rest} />)}
    </div>
  );
}

export default function BillsList({ T, view, forFilter, onForFilter, sym, fmt, onOpen, onOpenExpected, onOpenRenewal, onAddBill, showCancelled, onToggleCancelled, showAllPaid, onToggleAllPaid, txns }) {
  const { groups, forChips, totalUnpaid, openCount, lastPaid } = view;
  const paidRows = showAllPaid ? groups.paid : groups.paid.slice(0, 5);
  return (
    <div style={{ padding: "14px 16px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ color: T.text, fontSize: 20, fontWeight: 800 }}>Bills</div>
        {onAddBill ? <button data-testid="payments-add-bill" onClick={onAddBill} style={{ background: T.accent, border: "none", color: T.accentInk || "#fff", borderRadius: RADIUS.pill, padding: "8px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>+ Add bill</button> : null}
      </div>

      <div data-testid="payments-total" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "14px 16px", marginBottom: 12 }}>
        <div style={{ color: T.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Total unpaid · {openCount} bill{openCount === 1 ? "" : "s"}</div>
        <div style={{ color: totalUnpaid > 0 ? T.text : T.accent, fontSize: 26, fontWeight: 600, fontFamily: FONT.mono, marginTop: 4 }}>{sym}{fmt(totalUnpaid)}</div>
      </div>

      {forChips.length > 2 ? (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {forChips.map(ch => {
            const on = forFilter === ch.id;
            return <button key={ch.id} data-testid={`for-chip-${ch.id}`} aria-pressed={on} onClick={() => onForFilter(ch.id)} style={{ flexShrink: 0, background: on ? T.accentSoft : "transparent", border: `1px ${ch.id === "unassigned" ? "dashed" : "solid"} ${on ? T.accent : T.borderStrong}`, color: on ? T.text : T.mutedText, borderRadius: RADIUS.pill, padding: "0 12px", minHeight: 36, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{ch.label}</button>;
          })}
        </div>
      ) : null}

      {openCount === 0 ? (
        <div data-testid="payments-all-paid" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "22px 16px", textAlign: "center", marginTop: 12 }}>
          <div style={{ color: T.accent, fontSize: 16, fontWeight: 800 }}>All bills paid</div>
          <div style={{ color: T.sub, fontSize: 12, marginTop: 6 }}>Nothing is due or overdue.{lastPaid ? ` Last payment: ${lastPaid.bill.name}, ${formatDayMonth(lastPaid.bill.paidDate)}.` : ""}</div>
        </div>
      ) : null}

      <Group T={T} title="Overdue" rows={groups.overdue} sym={sym} fmt={fmt} onOpen={onOpen} txns={txns} />
      <Group T={T} title="Due today" rows={groups.dueToday} sym={sym} fmt={fmt} onOpen={onOpen} txns={txns} />
      <Group T={T} title="Due tomorrow" rows={groups.dueTomorrow} sym={sym} fmt={fmt} onOpen={onOpen} txns={txns} />
      <Group T={T} title="Upcoming" rows={groups.upcoming} sym={sym} fmt={fmt} onOpen={onOpen} txns={txns} />
      {groups.expected?.length ? (
        <div data-testid="group-Expected">
          <div style={{ color: T.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: "16px 0 8px" }}>Expected · not bills yet</div>
          {groups.expected.map(row => <ExpectedRow key={row.expected.relationshipId} T={T} row={row} sym={sym} fmt={fmt} onOpen={onOpenExpected} />)}
        </div>
      ) : null}
      {groups.renewals?.length ? (
        <div data-testid="group-Renewals">
          <div style={{ color: T.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: "16px 0 8px" }}>Renewals & fees</div>
          {groups.renewals.map(row => <RenewalRow key={row.id} T={T} row={row} sym={sym} fmt={fmt} onOpen={onOpenRenewal} />)}
        </div>
      ) : null}
      <Group T={T} title="Paid" rows={paidRows} sym={sym} fmt={fmt} onOpen={onOpen} txns={txns} />
      {groups.paid.length > 5 ? <button onClick={onToggleAllPaid} style={{ background: "none", border: "none", color: T.accent, fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "4px 0" }}>{showAllPaid ? "Show fewer paid bills" : `See all ${groups.paid.length} paid bills`}</button> : null}

      {groups.cancelled.length ? (
        <>
          <button data-testid="payments-cancelled-toggle" onClick={onToggleCancelled} style={{ display: "flex", justifyContent: "space-between", width: "100%", background: "none", border: `1px dashed ${T.borderStrong}`, borderRadius: 14, padding: "12px 14px", marginTop: 16, color: T.sub, fontSize: 13, cursor: "pointer" }}>
            <span>Cancelled</span><span>{groups.cancelled.length} bill{groups.cancelled.length === 1 ? "" : "s"} · not in totals {showCancelled ? "▴" : "▾"}</span>
          </button>
          {showCancelled ? <div style={{ marginTop: 8 }}>{groups.cancelled.map(r => <BillRow key={r.bill.id} T={T} row={r} sym={sym} fmt={fmt} onOpen={onOpen} txns={txns} />)}</div> : null}
        </>
      ) : null}
    </div>
  );
}
