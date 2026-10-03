// domain/payTogether/payPlan.js
//
// Pay together -> Pay. Decides, for a group's live instalments, WHICH existing payment flow settles each
// part. It creates no payment itself and invents no flow:
//   School fee periods  -> "Pay fees" (one run per school, since a payment is to one school)
//   Bills               -> "Record payment" (one bill at a time)
//   SIP instalments     -> not payable from here (listed so nothing silently disappears)

/** @returns {{parts:Array, unpayable:Array, total:number}} */
export function planGroupPayment({ live, feePeriods, feeSchedules, bills }) {
  const periodById = new Map((feePeriods || []).map(p => [String(p.id), p]));
  const scheduleById = new Map((feeSchedules || []).map(s => [String(s.id), s]));
  const billById = new Map((bills || []).map(b => [String(b.id), b]));

  const bySchedule = new Map();
  const parts = [];
  const unpayable = [];
  for (const e of live || []) {
    if (e.sourceType === "feePeriod") {
      const period = periodById.get(String(e.sourceId));
      const schedule = period && scheduleById.get(String(period.scheduleId));
      if (!period || !schedule) { unpayable.push(e); continue; }
      if (!bySchedule.has(schedule.id)) bySchedule.set(schedule.id, { kind: "fees", schedule, periodIds: [], events: [] });
      const part = bySchedule.get(schedule.id);
      part.periodIds.push(period.id); part.events.push(e);
    } else if (e.sourceType === "bill") {
      const bill = billById.get(String(e.sourceId));
      if (bill && !bill.isCcStatement) parts.push({ kind: "bill", bill, events: [e] }); else unpayable.push(e);
    } else unpayable.push(e);
  }
  const ordered = [...bySchedule.values(), ...parts].map(p => ({
    ...p, total: Math.round(p.events.reduce((s, e) => s + Number(e.amount), 0) * 100) / 100,
  }));
  return { parts: ordered, unpayable, total: Math.round((live || []).reduce((s, e) => s + Number(e.amount), 0) * 100) / 100 };
}
