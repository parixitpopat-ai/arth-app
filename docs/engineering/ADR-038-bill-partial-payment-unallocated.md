## ADR-038 — Bill partial payment and Unallocated money

**Status: Approved 2026-09-26 by the product owner.** Proposed and approved the same day. Implementation: M2 (WP-4).

> Context below was written before the UI-2C quick wins. Since then QW-1 stopped transaction edits rewriting the Bill, and QW-2 stopped duplicate and orphaned Contributions (`domain/obligations/billContributionSync.js`). Line numbers refer to `App.jsx` at that time.

### Context

- `bills[].status` is binary (`unpaid` / `paid`). Overdue is computed from `dueDate`.
- `contributions[]` (`domain/obligations/contribution.js`) is persisted and cloud-synced.
  - Three paths write it: `confirmMarkBillPaid` L1380, the AddModal save L5073, and bill-match accept L18047.
  - Every write records the **full bill amount**.
  - Nothing reads it.
- Editing a bill-linked transaction rewrites the Bill's amount, due date and category (L5039–5066).
- OBL-001 Q1 (overpayment policy) was left open deliberately. Two conflicting policies exist: School Fees rejects overpayment, and Person/Group settlement keeps the excess as an advance.

### Decision

1. **Canonical owner:** a new pure module, `src/domain/obligations/billBalance.js`. It is the only place that computes a Bill's paid amount, remaining amount and payment status, and the only place that decides how much of a payment may be applied to a Bill. `contribution.js` stays the unchanged primitive. Its header already expects the cap to be enforced by a caller-side policy, not inside `createContribution`.
2. **Paid amount** = the sum of that Bill's contributions (`obligationType:"bill"`).
3. **Invariant:** paid amount ≤ Bill amount. The applied contribution is `min(requested, remaining)`. **The excess is never written as a contribution.**
4. **Unallocated** exists only for a **bill link**. A link is a transaction, or (after WP-5) a line item, that the user linked to a Bill.
   - Unallocated = linked amount − contribution applied through that link.
   - It is **computed, not stored**, and is shown next to the link and the Bill.
   - There is **no resolution flow** under this ADR.
   - Amounts or items with no bill link are never "unallocated".
5. **Status** (the labels come from Claude Design's D-16):

   | Status | Condition |
   |---|---|
   | unpaid | 0 contributed |
   | partially paid | 0 < contributed < amount |
   | paid | contributed = amount |
   | overdue | a date-based overlay on unpaid or partially paid |
   | cancelled | **stored**, set only by explicit user action (ADR-039 §8, Q-1) |

6. **Stored `status` becomes a projection.** Existing readers (`commitments.js`, Bills filters, group balances) read `bill.status` today. During transition, only `billBalance.js` writes `status`, derived as above. Direct `status:"paid"` writes elsewhere are removed.
7. **Historical paid Bills.** A Bill marked `paid` before WP-OBL-04a, with no contributions, keeps `paid` as an asserted historical state (OBL-002's Historical/Asserted concept). It is not re-derived to `unpaid`.
8. **Editing a transaction never rewrites the Bill.** Amount, due date, category and period stay unchanged. A mismatch is shown (T-33); the link is kept.
9. **Scope: Bills only.** School Fees (`settlementLinks`), Membership, Loans and CC EMIs are untouched. WP-9 decides whether they follow later.

### Consequences

- WP-4 implements this. QW-1 and QW-2 (duplicate and orphaned contributions) must land first, or the sums are wrong.
- Committed spending (`commitments.js`) for a partially paid Bill should use the remaining amount. This needs characterization tests before any change.

### Open implementation checks (not product questions)

- **Refunds.** `getNetBillAmount` (`domain/bills/refunds.js`) nets refunds. Confirm whether the cap uses `bill.amount` or the net amount.
- **Split bills.** `splitPeople` / `myShare` settlement progress on partially paid Bills. Decide whether it stays independent of the core payment. L1759–1765 records this as an unresolved question.

### Sign-off

- [x] Product owner, 2026-09-26: "Keep them exactly as written."
