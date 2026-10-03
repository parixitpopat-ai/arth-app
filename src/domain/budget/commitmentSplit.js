// domain/budget/commitmentSplit.js
//
// Plan Ahead (PA1-PA5) — how a Person's or Group's monthly allocation divides into the part that is
// Committed (locked; each active scoped Mandatory Commitment) and Free to spend. Pure arithmetic over
// figures the caller already has (the same allocation, commitments and spend the budget screens use);
// it adds no second spend engine. A skipped commitment is released for that month only, exactly as
// getDiscretionaryPool already treats it.
//
// `spentByCommitment` maps commitment id -> what was spent against its category this month. Spending
// against a commitment's category draws from its Committed part first (up to that amount); every other
// rupee spent comes out of Free to spend. `totalSpent` is the allocation's own spend (null when the
// caller doesn't have it, in which case spent/left are not computed).

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

export function splitAllocation({ allocation, commitments, monthKey, totalSpent = null, spentByCommitment = {} }) {
  const alloc = Number(allocation) || 0;
  const list = Array.isArray(commitments) ? commitments : [];
  const isSkipped = c => (c?.skippedMonths || []).includes(monthKey);
  const active = list.filter(c => !isSkipped(c));
  const skipped = list.filter(isSkipped);

  const committed = r2(active.reduce((s, c) => s + (Number(c.amount) || 0), 0));
  const skippedTotal = r2(skipped.reduce((s, c) => s + (Number(c.amount) || 0), 0));
  const free = r2(alloc - committed);

  let spentFree = null, leftFree = null, over = 0;
  if (totalSpent != null && Number.isFinite(Number(totalSpent))) {
    const usedFromCommitted = active.reduce((s, c) => s + Math.min(Number(spentByCommitment[c.id]) || 0, Number(c.amount) || 0), 0);
    spentFree = r2(Math.max(0, Number(totalSpent) - usedFromCommitted));
    leftFree = r2(free - spentFree);
    over = leftFree < 0 ? r2(-leftFree) : 0;
  }
  return {
    allocation: r2(alloc), committed, skippedTotal, free, spentFree, leftFree, over,
    hasCommitments: list.length > 0,
    allSkipped: list.length > 0 && active.length === 0,
    committedShare: alloc > 0 ? Math.min(1, committed / alloc) : 0,
    overCommitted: committed > alloc && alloc > 0,
  };
}
