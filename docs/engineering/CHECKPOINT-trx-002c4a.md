# Checkpoint — TRX-002C4a Complete

`2026-08-03` · Paused here deliberately, ahead of exhibition commitments — not a stopping point due to risk.

---

## State at this checkpoint

- ✅ Architecture phase complete (ADR-032/033/034, AQ-001, AQ-002)
- ✅ Application Layer complete (TRX-002A)
- ✅ Transaction Aggregate complete (TRX-002B)
- ✅ SettlementService complete (TRX-002C1)
- ✅ Legacy characterization complete — both `applyRepaymentAllocations` and `SettleModal.settle()` (TRX-002C2)
- ✅ **TRX-002C4a** — plain-transaction settlement path repointed to canonical `Transaction.applySettlement()` in BOTH functions, via one shared, proven-equivalent adapter (`settlePersonShareOnTransaction`)
- ✅ Test suite: 69/69, confirmed green in the real repo, not just sandbox
- ✅ Both commits (`5be3b9d` and the one before it) pushed to `origin/main`

## What TRX-002C4a explicitly did NOT do

Corrected from an earlier overstatement this same session — worth restating precisely so nobody picks this up later assuming more is done than actually is:

- Bill-kind branches of both legacy functions — still untouched, still legacy (**TRX-002C4b**)
- `AddModal` L4480/L4641 — not yet audited this session at all (**TRX-002C4c**)
- No dead legacy code removed yet — old inline logic still present, just unreachable for the plain-transaction case (**TRX-002C4d**)
- **CR-001 is still In Progress, not Complete**
- **CBR is still 8 canonical / 4 duplicate — unchanged**

## Resume point

Start with **TRX-002C4b — Bill-kind settlement audit and characterization**. Note already surfaced: AQ-002 established `Bill.splitPeople` and `Transaction.people` share the identical `PersonShare` shape, so this likely doesn't require the full `Payable`/Bill aggregate (TRX-002D) to exist first — a parallel adapter (`settlePersonShareOnBill`) may be enough, same pattern as `settlePersonShareOnTransaction`. Worth confirming, not assuming, when this resumes.

## Agreed milestone sequence (unchanged from this session's plan)

1. **Milestone 1** — TRX-002C4b/c/d, close CR-001, update CBR *(resume here)*
2. **Milestone 2** — Payable Aggregate (TRX-002D), CR-003, CR-005
3. **Milestone 3** — Loan settlement migration, CR-004
4. **Milestone 4** — Group-collective domain audit, CR-006
5. **Milestone 5** — Persistence modernization (ADR-034)

## Unrelated open item, noted but explicitly not connected to this work

A user-reported "SIPs showing twice" issue on the Home due-today reminders — investigated briefly, traced to `dueRecurring` (a direct filter over `recurringSchedules`), not a rendering-combination bug as far as checked. User snoozed the duplicate before a clear screenshot could be captured; follow-up pending whenever it resurfaces. **Nothing in TRX-002A–C4a touches `recurringSchedules` or SIP logic** — nothing here suggests this is related, but flagging it exists as a separate, still-open thread.
