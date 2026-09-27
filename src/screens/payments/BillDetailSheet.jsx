import React from "react";
import BottomSheet from "../../components/BottomSheet";
import { FONT, RADIUS, statusStyle } from "../../constants/theme";
import { getBadgeText, getBillPeriodLabel, getBillPeriodRange, getSplitProgressText, formatDayMonth } from "../../domain/bills/paymentsView";

// UI-2C M2 Bill detail: PY-19 (due), PY-19b (partially paid), PY-26 / PY-26b (paid and
// partially paid ledgers), PY-28 (overdue). One primary action, "Record payment ₹X", for the
// balance left. No Bill ID. The Bill's own For comes first. Share and Edit sit in the top bar.
// `ledger` comes from billBalance.getBillLedger (ADR-038): each payment shows what it paid and
// what it applied, so the ledger always adds up; any excess is an amber Unallocated amount.
// `extras` renders today's Bill details and actions (split people with Share / Settle, images,
// plan and validity, Pause / Resume, Delete), kept exactly as they were.

const BADGE_STATUS = { overdue: "overdue", partial: "partial", due: "due", unpaid: "upcoming", paid: "paid", cancelled: "writtenOff" };
const YEAR = ymd => String(ymd || "").slice(0, 4);

function Row({ T, k, v }) {
  if (!v) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ color: T.sub, fontSize: 13 }}>{k}</span>
      <span style={{ color: T.text, fontSize: 13, fontWeight: 600, textAlign: "right" }}>{v}</span>
    </div>
  );
}

export default function BillDetailSheet({ T, bill, badge, ledger, forLabel, provider, relationship, accountName, sym, fmt, onClose, onRecordPayment, onEdit, onShare, onOpenProvider, extras }) {
  const bt = getBadgeText(badge, bill);
  const open = badge.kind !== "paid" && badge.kind !== "cancelled";
  const dueLine = (() => {
    if (!bill.dueDate) return "";
    const d = `${formatDayMonth(bill.dueDate)} ${YEAR(bill.dueDate)}`;
    if (badge.kind === "overdue") return `Was due ${d}${ledger.remaining > 0 ? ` · ${sym}${fmt(ledger.remaining)} left` : ""}`;
    if (badge.kind === "paid") return `Due ${d}`;
    if (badge.days === 0) return `Due ${d} · today`;
    if (badge.days > 0) return `Due ${d} · in ${badge.days} day${badge.days === 1 ? "" : "s"}`;
    return `Due ${d}`;
  })();
  const showBreakdown = ledger.status === "partial";
  const hasLedger = ledger.rows.length > 0 || ledger.historical;

  return (
    <BottomSheet T={T} onClose={onClose} maxHeight="92vh">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.sub, fontSize: 15, cursor: "pointer", padding: "8px 4px" }}>Close</button>
        <div style={{ display: "flex", gap: 8 }}>
          {onShare ? <button data-testid="bill-share" onClick={onShare} style={{ background: "none", border: `1px solid ${T.borderStrong}`, color: T.text, borderRadius: RADIUS.pill, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Share</button> : null}
          {onEdit ? <button data-testid="bill-edit" onClick={onEdit} style={{ background: "none", border: `1px solid ${T.borderStrong}`, color: T.text, borderRadius: RADIUS.pill, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Edit</button> : null}
        </div>
      </div>

      <div data-testid="bill-detail" style={{ fontFamily: FONT.sans }}>
        <div style={{ color: T.text, fontSize: 18, fontWeight: 800 }}>{bill.name}{getBillPeriodLabel(bill) ? ` · ${getBillPeriodLabel(bill)}` : ""}</div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginTop: 10 }}>
          <span data-testid="bill-detail-badge" style={statusStyle(BADGE_STATUS[badge.kind], T)}>{bt.text}</span>
          <span style={{ textAlign: "right" }}>
            <span style={{ display: "block", color: T.text, fontSize: 26, fontWeight: 600, fontFamily: FONT.mono }}>{sym}{fmt(ledger.amount)}</span>
            {ledger.status === "partial" ? <span data-testid="bill-detail-partial-line" style={{ color: T.sub, fontSize: 12, fontFamily: FONT.mono }}>{sym}{fmt(ledger.paid)} of {sym}{fmt(ledger.amount)}</span> : null}
          </span>
        </div>
        {dueLine ? <div style={{ color: badge.kind === "overdue" ? T.dangerText : T.sub, fontSize: 12, marginTop: 4 }}>{dueLine}</div> : null}

        {showBreakdown && badge.kind !== "overdue" ? (
          <div style={{ marginTop: 10 }}>
            <Row T={T} k="Amount" v={`${sym}${fmt(ledger.amount)}`} />
            <Row T={T} k="Paid so far" v={`${sym}${fmt(ledger.paid)}`} />
            <Row T={T} k="Remaining" v={`${sym}${fmt(ledger.remaining)}`} />
          </div>
        ) : null}

        <div style={{ marginTop: 10 }}>
          <Row T={T} k="For" v={<span data-testid="bill-detail-for" style={forLabel === "Unassigned" ? { border: `1px dashed ${T.borderStrong}`, borderRadius: RADIUS.pill, padding: "0 8px" } : null}>{forLabel}</span>} />
          {onOpenProvider && provider ? (
            <div data-testid="bill-detail-provider-open" onClick={onOpenProvider} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
              <span style={{ color: T.sub, fontSize: 13 }}>Provider</span>
              <span style={{ color: T.accent, fontSize: 13, fontWeight: 600, textAlign: "right" }}>{provider} ›</span>
            </div>
          ) : <Row T={T} k="Provider" v={provider} />}
          <Row T={T} k="Period" v={getBillPeriodRange(bill)} />
          <Row T={T} k="Relationship" v={relationship} />
          <Row T={T} k="Split" v={getSplitProgressText(bill)} />
        </div>

        <div data-testid="bill-ledger" style={{ marginTop: 16 }}>
          <div style={{ color: T.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Payments against this bill</div>
          {!hasLedger ? <div style={{ color: T.sub, fontSize: 13 }}>None yet. Balance {sym}{fmt(ledger.remaining)}.</div> : (
            <div style={{ background: T.input, borderRadius: 12, padding: "4px 12px" }}>
              <Row T={T} k="Bill amount" v={`${sym}${fmt(ledger.amount)}`} />
              {ledger.historical ? <Row T={T} k={`Marked paid${bill.paidDate ? ` ${formatDayMonth(bill.paidDate)}` : ""}`} v="no payment recorded" /> : null}
              {ledger.rows.map(r => (
                <div key={r.contributionId} data-testid="ledger-row" style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ color: T.text, fontSize: 13 }}>
                    You{accountName(r.txn) ? ` · ${accountName(r.txn)}` : ""}
                    <span style={{ display: "block", color: T.sub, fontSize: 11 }}>{[r.date ? formatDayMonth(r.date) : null, r.txn?.transactionRef ? `UTR ${r.txn.transactionRef}` : null, r.paidAmount !== r.applied ? `paid ${sym}${fmt(r.paidAmount)}` : null].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span style={{ color: T.text, fontSize: 13, fontFamily: FONT.mono, whiteSpace: "nowrap" }}>− {sym}{fmt(r.applied)}{r.paidAmount !== r.applied ? " applied" : ""}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0" }}>
                <span style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>Balance</span>
                <span data-testid="ledger-balance" style={{ color: T.text, fontSize: 13, fontWeight: 700, fontFamily: FONT.mono }}>{sym}{fmt(ledger.remaining)}</span>
              </div>
            </div>
          )}
          {ledger.unallocated > 0 ? <div data-testid="ledger-unallocated" style={{ color: T.attention, fontSize: 12, fontWeight: 600, marginTop: 6 }}>Overpaid · {sym}{fmt(ledger.unallocated)} unallocated</div> : null}
        </div>

        {open && onRecordPayment ? (
          <button data-testid="bill-record-payment" onClick={onRecordPayment} style={{ marginTop: 16, width: "100%", minHeight: 48, background: T.accent, border: "none", borderRadius: RADIUS.md, color: T.accentInk || "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
            Record payment {sym}{fmt(ledger.remaining)}
          </button>
        ) : null}

        {extras ? <div style={{ marginTop: 18, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>{extras}</div> : null}
      </div>
    </BottomSheet>
  );
}
