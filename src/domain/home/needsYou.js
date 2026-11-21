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
export function buildNeedsYou({ commitments = [], today, owedPeople = [], repaymentProblems = [], withinDays = 7, max = 3 } = {}) {
  const items = [];
  const due = (commitments || [])
    .filter(c => c && c.status !== "paid" && (Number(c.amount) || 0) > 0 && c.date && daysUntil(c.date, today) <= withinDays)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (due.length) {
    const c = due[0], d = daysUntil(c.date, today);
    items.push({ kind: "bill", key: `bill:${c.sourceType || ""}:${c.sourceId ?? ""}`, title: c.name || "Bill", amount: r2(c.amount), days: d,
      sub: (d < 0 ? `Overdue by ${-d} day${d === -1 ? "" : "s"}` : d === 0 ? "Due today" : `Due in ${d} day${d === 1 ? "" : "s"}`) + (due.length > 1 ? ` · ${due.length - 1} more this week` : "") });
  }
  const unapplied = (repaymentProblems || []).filter(p => p && p.count > 0);
  const total = unapplied.reduce((s, p) => s + p.count, 0);
  if (total > 0) items.push({ kind: "repayments", key: "repayments", title: `${total} repayment${total === 1 ? "" : "s"} not applied`, sub: "Money received that is not matched to anything", personId: unapplied[0].personId, count: total });
  const top = [...(owedPeople || [])].filter(p => (Number(p.amount) || 0) > 0).sort((a, b) => b.amount - a.amount)[0];
  if (top) items.push({ kind: "owed", key: `owed:${top.personId}`, title: `${top.name} owes you`, amount: r2(top.amount), personId: top.personId, sub: "Tap to see what for" });
  return items.slice(0, max);
}

/** Coming to you (people who owe you, plus loans you gave) against what you owe, and the net. */
export function summariseBetweenPeople({ owesMe = [], iOwe = [], loansGiven = 0 } = {}) {
  const sum = list => r2((list || []).reduce((s, v) => s + (Number(v) || 0), 0));
  const people = sum(owesMe), loans = r2(loansGiven);
  const coming = r2(people + loans), owe = sum(iOwe);
  return { coming, owe, net: r2(coming - owe), loans, hasAny: coming > 0 || owe > 0 };
}
