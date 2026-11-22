// domain/home/needsYou.js
//
// Today (Home): the few things that need the person now, and the one-line picture of money between them and other people. Pure; nothing here stores anything.
//   needs you  : the soonest bill / card statement due within 7 days (or overdue), repayments received that are not applied to anything, and the person who owes the most.
//   between    : what people owe the person (including loans given) against what the person owes people.

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const daysUntil = (date, today) => Math.ceil((new Date(date) - new Date(today)) / 86400000);

/**
 * @param {{commitments:Array<{name?:string,amount:number,date?:string|null,status?:string,sourceType?:string,sourceId?:any}>, today:string, owedPeople:Array<{personId:string,name:string,amount:number}>,
 *          repaymentProblems:Array<{personId:string,name:string,count:number}>, withinDays?:number, max?:number}} input
 */
/**
 * What an item is "about", for archiving. An archived item stays out of the list until it CHANGES (a different amount, or a bill that
 * has become overdue), so something new about the same bill or person comes back by itself.
 */
export const needsSignature = {
  bill: (c, today) => `bill:${c.sourceType || ""}:${c.sourceId ?? ""}|${r2(c.amount)}|${daysUntil(c.date, today) < 0 ? "overdue" : "due"}`,
  repayments: total => `repayments|${total}`,
  owed: p => `owed:${p.personId}|${r2(p.amount)}`,
};

export function buildNeedsYou({ commitments = [], today, owedPeople = [], repaymentProblems = [], withinDays = 7, max = 3, archived = [] } = {}) {
  const items = [];
  const hidden = new Set(archived || []);
  const due = (commitments || [])
    .filter(c => c && c.status !== "paid" && (Number(c.amount) || 0) > 0 && c.date && daysUntil(c.date, today) <= withinDays)
    .filter(c => !hidden.has(needsSignature.bill(c, today)))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (due.length) {
    const c = due[0], d = daysUntil(c.date, today);
    items.push({ kind: "bill", key: `bill:${c.sourceType || ""}:${c.sourceId ?? ""}`, signature: needsSignature.bill(c, today), sourceType: c.sourceType, sourceId: c.sourceId, title: c.name || "Bill", amount: r2(c.amount), days: d,
      sub: (d < 0 ? `Overdue by ${-d} day${d === -1 ? "" : "s"}` : d === 0 ? "Due today" : `Due in ${d} day${d === 1 ? "" : "s"}`) + (due.length > 1 ? ` · ${due.length - 1} more this week` : "") });
  }
  const unapplied = (repaymentProblems || []).filter(p => p && p.count > 0);
  const total = unapplied.reduce((s, p) => s + p.count, 0);
  if (total > 0 && !hidden.has(needsSignature.repayments(total))) items.push({ kind: "repayments", key: "repayments", signature: needsSignature.repayments(total), title: `${total} repayment${total === 1 ? "" : "s"} not applied`, sub: "Money received that is not matched to anything", personId: unapplied[0].personId, count: total });
  const top = [...(owedPeople || [])].filter(p => (Number(p.amount) || 0) > 0 && !hidden.has(needsSignature.owed(p))).sort((a, b) => b.amount - a.amount)[0];
  if (top) items.push({ kind: "owed", key: `owed:${top.personId}`, signature: needsSignature.owed(top), title: `${top.name} owes you`, amount: r2(top.amount), personId: top.personId, sub: "Tap to see what for" });
  return items.slice(0, max);
}

/** Coming to you (people who owe you, loans you gave, and work expenses waiting to be reimbursed) against what you owe, and the net. */
export function summariseBetweenPeople({ owesMe = [], iOwe = [], loansGiven = 0, claims = 0 } = {}) {
  const sum = list => r2((list || []).reduce((s, v) => s + (Number(v) || 0), 0));
  const people = sum(owesMe), loans = r2(loansGiven), work = r2(claims);
  const coming = r2(people + loans + work), owe = sum(iOwe);
  return { coming, owe, net: r2(coming - owe), loans, claims: work, hasAny: coming > 0 || owe > 0 };
}
