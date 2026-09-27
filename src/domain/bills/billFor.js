// domain/bills/billFor.js
//
// UI-2C D-3 / Q-4 — every Bill keeps its own "For": the person or group it
// was created for. Stored on the Bill as
//   forType: "person" | "group" | "unassigned"
//   forId:   the person/group id, or null when unassigned
//
// The value is copied once from the Bill's relationship
// (bill.billerAccountId → billerAccount.attributedTo / attributeType) and
// then belongs to the Bill: later changes to the relationship never rewrite
// it. bill.groupId stays the split context and is not the "For".
//
// Arth 2.0 IA compatibility rule (locked, documented before Financial
// Relationship work began building on top of billerAccounts — see
// UI-2C-financial-relationship-mapping.md): a billerAccount (Provider) can
// now have more than one Financial Relationship (domain/membership/
// relationship.js's canonical, generalized store). billerAccount.
// attributeType/attributedTo is UNCHANGED by that work — it remains this
// legacy bridge, and this file keeps reading it exactly as before. Existing
// Bills' "For" is a historical snapshot and is never retroactively changed
// when a Financial Relationship is created, paused, resumed, ended, or
// reassigned. For a NEW Bill against a billerAccount that has gained a
// second relationship, this file still reads attributeType/attributedTo
// (whichever relationship is "primary" — today, the first/oldest one) —
// this is a temporary bridge, not the target architecture, and stays in
// place only until the Bill model is explicitly upgraded to ask which
// relationship a new Bill belongs to when more than one exists.
//
// A Bill is only attributed when that is certain: its relationship exists,
// the relationship is attributed to a person or a group, and that person or
// group exists. Anything else (no relationship, house/vehicle attribution,
// dangling ids) is stored as "unassigned", never guessed. Writing
// "unassigned" explicitly records that the Bill has been looked at, so a
// later run never re-derives it.
//
// The same function snapshots existing Bills once (the historical backfill)
// and every new Bill as it appears, whichever path created it.

export const BILL_FOR_PERSON = "person";
export const BILL_FOR_GROUP = "group";
export const BILL_FOR_UNASSIGNED = "unassigned";

const SELF_ID = "__me__";
const FOR_TYPES = new Set([BILL_FOR_PERSON, BILL_FOR_GROUP, BILL_FOR_UNASSIGNED]);

export function hasBillForSnapshot(bill) {
  return Boolean(bill && FOR_TYPES.has(bill.forType));
}

/** The snapshot a Bill would get from its relationship right now. */
export function deriveBillFor(bill, { billerAccounts = [], people = [], groups = [] } = {}) {
  const unassigned = { forType: BILL_FOR_UNASSIGNED, forId: null };
  const baId = bill?.billerAccountId;
  if (baId === undefined || baId === null || baId === "") return unassigned;
  const ba = billerAccounts.find(a => String(a.id) === String(baId));
  if (!ba || ba.attributedTo === undefined || ba.attributedTo === null || ba.attributedTo === "") return unassigned;
  const targetId = String(ba.attributedTo);
  if (ba.attributeType === BILL_FOR_PERSON) {
    const exists = targetId === SELF_ID || people.some(p => String(p.id) === targetId);
    return exists ? { forType: BILL_FOR_PERSON, forId: targetId } : unassigned;
  }
  if (ba.attributeType === BILL_FOR_GROUP) {
    const exists = groups.some(g => String(g.id) === targetId);
    return exists ? { forType: BILL_FOR_GROUP, forId: targetId } : unassigned;
  }
  return unassigned;
}

/** Adds the snapshot to one Bill if it has none; otherwise returns it unchanged. */
export function withBillForSnapshot(bill, context) {
  if (!bill || hasBillForSnapshot(bill)) return bill;
  return { ...bill, ...deriveBillFor(bill, context) };
}

/**
 * Snapshots every Bill that has none yet. Returns the same array when
 * nothing changed, so a caller can skip the state update.
 */
export function withBillForSnapshots(bills, context) {
  const list = Array.isArray(bills) ? bills : [];
  let changed = false;
  const next = list.map(b => {
    const out = withBillForSnapshot(b, context);
    if (out !== b) changed = true;
    return out;
  });
  return changed ? next : bills;
}

/** Bills whose own "For" is this person or group. */
export function getBillsFor(bills, forType, forId) {
  const id = String(forId);
  return (bills || []).filter(b => b && b.forType === forType && String(b.forId) === id);
}

/**
 * One-time repair, paired with relationship.js's backfillBillerAccountAttributionFromRelationships:
 * a Bill already snapshotted "unassigned" stays that way forever by design (hasBillForSnapshot
 * makes withBillForSnapshot skip it) — correct for a later, genuine reassignment, but wrong for a
 * Bill that was snapshotted "unassigned" only because its billerAccount hadn't been backfilled
 * yet. Once that backfill runs, re-deriving here catches up every Bill that was actually a victim
 * of that gap, without touching a Bill that's genuinely, correctly unassigned (its fresh
 * derivation is still "unassigned", so it's left alone) or a Bill attributed to something else.
 */
export function repairUnassignedBills(bills, context) {
  let changed = false;
  const next = (bills || []).map(b => {
    if (!b || b.forType !== BILL_FOR_UNASSIGNED) return b;
    const fresh = deriveBillFor(b, context);
    if (fresh.forType === BILL_FOR_UNASSIGNED) return b;
    changed = true;
    return { ...b, ...fresh };
  });
  return changed ? next : bills;
}
