// Limit suggestions: limits (person / group / category) are INDICATORS, never caps and never must-spend.
// From what was really spent in recent completed months, suggest (a) lowering a limit that is not being used and
// (b) where the freed money could go: the limits that keep being exceeded.
// PAY-BACK (person / group): overspend in the last completed month comes off next month's limit, but never below the minimum
// commitment. E.g. limit 10,000 with a 5,000 commitment, spent 15,000 (5,000 over) -> next month 5,000. If the floor stops the
// full pay-back, the rest is NOT carried forward (`notRecovered`). People and groups are never "topped up" by a move; only
// categories receive moved money.
// Pure. No rounding of money except the suggested new limits, which are rounded UP to `step` for readability.
//
// item: { id, kind: "person"|"group"|"category", name, limit, floor?, limitByMonth?, spentByMonth: { "YYYY-MM": amount } }
// limitByMonth: the limit each past month really had (falls back to `limit`).
// floor = the minimum commitment inside this limit (e.g. the fixed 10,000 for home). A limit is never suggested below it.
// months: the completed months to look at, newest first, e.g. ["2026-10","2026-09","2026-08"]. The month in progress is never used.
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const ceilTo = (n, step) => (step > 0 ? Math.ceil(n / step) * step : n);

export const DEFAULTS = { minMonths: 2, underUseRatio: 0.6, headroom: 1.1, step: 100, overMonthsNeeded: 2 };

/** Per-item verdict: "unused" (spend well below limit every month), "exceeded" (over the limit in enough months), or "fine". */
export function assessLimit(item, months, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const limit = Number(item?.limit) || 0;
  const floor = Math.max(0, Number(item?.floor) || 0);
  const spends = (months || []).map(m => Number(item?.spentByMonth?.[m]) || 0);
  if (!(limit > 0) || spends.length < o.minMonths) return { verdict: "fine", reason: "not enough history" };
  const peak = Math.max(...spends);
  const overMonths = spends.filter(s => s > limit).length;
  if (overMonths >= o.overMonthsNeeded) {
    const worst = r2(peak);
    return { verdict: "exceeded", overMonths, months: spends.length, peak: worst, suggestedLimit: ceilTo(worst, o.step), needs: Math.max(0, ceilTo(worst, o.step) - limit) };
  }
  if (peak < limit * o.underUseRatio) {
    const suggestedLimit = Math.min(limit, Math.max(floor, ceilTo(peak * o.headroom, o.step)));
    return { verdict: "unused", months: spends.length, peak: r2(peak), suggestedLimit, floor, frees: r2(limit - suggestedLimit) };
  }
  return { verdict: "fine" };
}

/**
 * Suggestions, most useful first. A "move" pairs freed money from an unused limit with a limit that keeps being exceeded
 * (never more than is free, never more than is needed). Leftover freed money is a plain "lower" suggestion.
 * @returns {Array<{type:"move"|"lower"|"raise", ...}>}
 */
/** Pay-back for one person/group: null unless the last completed month went over that month's limit and a reduction is possible. */
export function paybackFor(item, months) {
  if (!item || item.kind === "category" || !(months || []).length) return null;
  const last = months[0];
  const limit = Number(item.limit) || 0;
  const thenLimit = Number(item.limitByMonth?.[last] ?? item.limit) || 0;
  const spent = Number(item.spentByMonth?.[last]) || 0;
  const floor = Math.max(0, Number(item.floor) || 0);
  const over = r2(spent - thenLimit);
  if (!(thenLimit > 0) || !(limit > 0) || !(over > 0)) return null;
  const to = r2(Math.max(floor, limit - over));
  if (!(to < limit)) return null;
  return { over, from: limit, to, notRecovered: r2(Math.max(0, over - (limit - to))), floorHit: to === floor && limit - over < floor };
}

export function suggestLimitChanges(items, months, opts = {}) {
  // People and groups are never topped up (no "raise", never receive moved money); they get a pay-back instead.
  const rows = (items || []).map(item => { const a = assessLimit(item, months, opts); return { item, a: item.kind !== "category" && a.verdict === "exceeded" ? { verdict: "fine" } : a }; });
  const free = rows.filter(r => r.a.verdict === "unused" && r.a.frees > 0).map(r => ({ ...r, left: r.a.frees })).sort((x, y) => y.left - x.left);
  const need = rows.filter(r => r.a.verdict === "exceeded" && r.a.needs > 0).map(r => ({ ...r, left: r.a.needs })).sort((x, y) => y.left - x.left);
  const out = [];
  for (const it of items || []) {
    const pb = paybackFor(it, months);
    if (pb) out.push({ type: "trim", id: it.id, name: it.name, kind: it.kind, ...pb });
  }
  for (const n of need) {
    for (const f of free) {
      if (n.left <= 0) break;
      if (f.left <= 0) continue;
      const amount = r2(Math.min(f.left, n.left));
      out.push({ type: "move", amount, fromId: f.item.id, fromName: f.item.name, fromKind: f.item.kind, toId: n.item.id, toName: n.item.name, toKind: n.item.kind });
      f.left = r2(f.left - amount); n.left = r2(n.left - amount);
    }
  }
  for (const f of free) if (f.left > 0) out.push({ type: "lower", id: f.item.id, name: f.item.name, kind: f.item.kind, from: Number(f.item.limit), to: r2(Number(f.item.limit) - f.left), frees: f.left, peak: f.a.peak, months: f.a.months });
  for (const n of need) if (n.left > 0) out.push({ type: "raise", id: n.item.id, name: n.item.name, kind: n.item.kind, from: Number(n.item.limit), to: r2(Number(n.item.limit) + n.left), needs: n.left, overMonths: n.a.overMonths, months: n.a.months });
  return out;
}
