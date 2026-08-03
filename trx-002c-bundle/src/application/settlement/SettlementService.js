// TRX-002C — SettlementService.
// Per ADR-033: decides allocation across possibly multiple SettlementTargets.
// Never mutates a target directly — calls its own applySettlement() method.
// Stateless — stores nothing, owns nothing, persists nothing (ADR-033's own
// invariant on this class, enforced here by having no instance fields at all).
//
// Allocation behavior matches the real, observed "Apply to original dues"
// screen from this session's debugging: candidates are settled in the order
// given, up to what each one owes, and any amount left over after all
// selected candidates are satisfied is returned as unapplied ("kept as
// advance" in the real UI's language) rather than silently dropped or forced
// onto a candidate that wasn't selected.

import { Money } from "../../domain/transactions/Money.js";

export class SettlementService {
  // candidates: [{ target, personId (optional, passed through to target.applySettlement) }]
  // Each target must implement the SettlementTarget contract: outstanding(), applySettlement(...).
  // Returns { allocations: [{ target, appliedAmount, fullySettled }], unappliedAmount }
  allocate(paymentAmount, candidates) {
    let remaining = Money.of(paymentAmount);
    const allocations = [];

    for (const candidate of candidates) {
      if (remaining.isZero()) break;

      const { target, personId } = candidate;
      const owed = personId !== undefined ? target.outstanding() : target.outstanding();
      const toApply = Money.of(Math.min(remaining.amount, owed.amount));
      if (toApply.isZero()) continue;

      const result = personId !== undefined
        ? target.applySettlement(personId, toApply)
        : target.applySettlement(toApply);

      allocations.push({
        target,
        personId,
        appliedAmount: toApply,
        fullySettled: result.fullySettled,
      });

      remaining = remaining.subtractClamped(toApply);
    }

    return { allocations, unappliedAmount: remaining };
  }
}
