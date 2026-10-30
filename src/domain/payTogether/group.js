// domain/payTogether/group.js
//
// Plan Ahead PA10-PA13 - "Pay together": several upcoming instalments planned for ONE payment date.
// A group sits ON TOP of the instalments: their due dates and amounts are untouched, nothing is paid by
// creating one, and removing an instalment (or undoing the group) just puts it back where it was.
// Only instalments that already exist can be grouped (a Bill, a School Fee period, a SIP instalment);
// Expected items are not real instalments yet and are never offered.

export const PAYABLE_SOURCE_TYPES = ["bill", "feePeriod", "recurringSchedule"];

export const itemKey = ({ sourceType, sourceId }) => `${sourceType}:${sourceId}`;

const isOpen = e => e && e.date && e.status !== "paid" && Number(e.amount) > 0 && PAYABLE_SOURCE_TYPES.includes(e.sourceType);

/** Keys already inside some group (optionally ignoring one group, so its own items stay listed). */
export function groupedKeys(groups, exceptGroupId = null) {
  const set = new Set();
  for (const g of groups || []) {
    if (exceptGroupId != null && String(g.id) === String(exceptGroupId)) continue;
    for (const it of g.items || []) set.add(itemKey(it));
  }
  return set;
}

/**
 * The groups as they count: one instalment belongs to ONE group - the earliest created (then lowest id, so every
 * device agrees). A later group that lists the same instalment (a duplicate arriving by sync or an older app
 * version) simply doesn't claim it. Stored groups are never changed; this is how every reader applies the rule.
 */
export function effectiveGroups(groups) {
  const ordered = [...(groups || [])].sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0) || String(a.id).localeCompare(String(b.id)));
  const claimed = new Set();
  return ordered.map(g => {
    const items = (g.items || []).filter(it => !claimed.has(itemKey(it)));
    items.forEach(it => claimed.add(itemKey(it)));
    return items.length === (g.items || []).length ? g : { ...g, items };
  });
}

/** Unpaid, real instalments (overdue ones included, so arrears can be cleared with later fees) that aren't already in a group, soonest first. */
export function listPayableInstalments(events, groups) {
  const taken = groupedKeys(groups);
  return (events || [])
    .filter(e => isOpen(e) && !taken.has(itemKey(e)))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/** @returns {{ok:true, group:Object}|{ok:false, reason:string}} */
export function createGroup({ events, keys, date, genId, today = null, groups = [] }) {
  if (!date) return { ok: false, reason: "Choose a payment date." };
  if (today && date < today) return { ok: false, reason: "Choose today or a later payment date." };
  const byKey = new Map((events || []).map(e => [itemKey(e), e]));
  const items = [...new Set(keys || [])].filter(k => isOpen(byKey.get(k))).map(k => {
    const e = byKey.get(k);
    return { sourceType: e.sourceType, sourceId: e.sourceId };
  });
  const taken = groupedKeys(groups);
  const dup = items.filter(it => taken.has(itemKey(it)));
  if (dup.length) {
    const names = dup.map(it => byKey.get(itemKey(it)).name || it.sourceId).join(", ");
    return { ok: false, duplicates: dup.map(itemKey), reason: `${names} ${dup.length === 1 ? "is" : "are"} already planned in another Pay together group. Remove ${dup.length === 1 ? "it" : "them"} from that group first.` };
  }
  if (items.length < 2) return { ok: false, reason: "Pick at least two instalments." };
  return { ok: true, group: { id: genId(), date, items, createdAt: Date.now() } };
}

/** Group with one item taken out; null when fewer than two remain (a group of one isn't "together"). */
export function removeItem(group, key) {
  const items = (group.items || []).filter(it => itemKey(it) !== key);
  return items.length < 2 ? null : { ...group, items };
}

/** The group's instalments that still exist and are unpaid, as the live events. */
export function liveItems(group, events) {
  const byKey = new Map((events || []).map(e => [itemKey(e), e]));
  return (group.items || []).map(it => byKey.get(itemKey(it))).filter(isOpen);
}

/** The group's total cash (sum of its live instalments). */
export function groupTotal(group, events) {
  return Math.round(liveItems(group, events).reduce((s, e) => s + Number(e.amount), 0) * 100) / 100;
}

/**
 * The Future Money lists as CASH is planned: each live grouped instalment moves to its group's payment date,
 * so the group's total enters a period once, on that date, and not again on the instalments' own due dates.
 * Amounts are untouched (a partly paid instalment carries only what is left; a paid one is not an event at all),
 * and nothing is stored or paid. Same shape in, same shape out - feed it to the one Money Required calculation
 * (Home, Outlook). Budget months are NOT affected: Readiness keeps reading the unmodified events.
 */
export function applyGroupDates(futureMoney, groups) {
  if (!futureMoney || !(groups || []).length) return futureMoney;
  const dateOf = new Map();
  for (const g of effectiveGroups(groups)) for (const it of g.items || []) dateOf.set(itemKey(it), g.date);
  const move = e => {
    const d = e && isOpen(e) ? dateOf.get(itemKey(e)) : null;
    return d ? { ...e, date: d, originalDate: e.date } : e;
  };
  const out = { ...futureMoney };
  for (const k of ["committedSpending", "committedSaving", "debtService"]) if (futureMoney[k]) out[k] = futureMoney[k].map(move);
  return out;
}
