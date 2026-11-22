// domain/notifications/dueReminders.js
//
// Which phone reminders to schedule for bills that are coming due: one 3 days before and one on the due day, both at 9 am, only for bills that
// are still owed (not paid, cancelled or skipped) and only for times still ahead. Pure: the phone side (native/dueNotifications.js) schedules what this returns.

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const at9 = (dateStr, minusDays) => { const [y, m, d] = String(dateStr).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d - minusDays, 9, 0, 0, 0); };
// A stable positive integer for a notification id from the bill id and kind (the phone wants numbers).
const stableId = key => { let h = 7; for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) % 90000; return 10000 + h; };

/**
 * @param {{bills:Array, now?:Date, withinDays?:number, max?:number, sym?:string, fmt?:(n:number)=>string, balanceOf?:(bill:object)=>number}} args
 * @returns {Array<{id:number, billId:string, kind:"soon"|"due", at:Date, title:string, body:string}>} soonest first
 */
export function buildDueReminders({ bills = [], now = new Date(), withinDays = 21, max = 30, sym = "₹", fmt = n => String(n), balanceOf } = {}) {
  const out = [];
  const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + withinDays, 23, 59, 59);
  for (const b of bills || []) {
    if (!b || !b.dueDate || b.status === "paid" || b.status === "cancelled" || b.skipped) continue;
    const amount = r2(balanceOf ? balanceOf(b) : b.amount);
    if (!(amount > 0)) continue;
    const name = b.name || "Bill";
    for (const [kind, minus] of [["soon", 3], ["due", 0]]) {
      const when = at9(b.dueDate, minus);
      if (when <= now || when > horizon) continue;
      out.push({
        id: stableId(`${b.id}:${kind}`), billId: String(b.id), kind, at: when,
        title: kind === "soon" ? `${name} is due in 3 days` : `${name} is due today`,
        body: `${sym}${fmt(amount)}${kind === "soon" ? ` · due ${ymd(at9(b.dueDate, 0))}` : ""} · tap to open`,
      });
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, max);
}
