// domain/insights/subscriptions.js
//
// Repeating payments found in the person's OWN entries: the same merchant, paid again and again at a steady gap (weekly, monthly, quarterly, yearly) for a steady amount.
// It reads only saved expenses; nothing is sent anywhere and nothing is changed. It is a best guess, so each one can be dismissed ("not a subscription"). Pure.

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const day = d => Math.round(new Date(`${String(d).slice(0, 10)}T00:00:00Z`).getTime() / 86400000);
const ymd = n => { const d = new Date(n * 86400000); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`; };
// The next one falls on the same day of the month (clamped into a short month), not "31 days later".
const addMonths = (dateStr, n) => { const [y, m, d] = String(dateStr).slice(0, 10).split("-").map(Number); const first = new Date(Date.UTC(y, m - 1 + n, 1)); const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate(); return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`; };
const median = a => { const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const CADENCES = [
  { id: "weekly", label: "Weekly", lo: 6, hi: 8, perMonth: 52 / 12, min: 4 },
  { id: "monthly", label: "Monthly", lo: 26, hi: 35, perMonth: 1, min: 3 },
  { id: "quarterly", label: "Every 3 months", lo: 85, hi: 100, perMonth: 1 / 3, min: 3 },
  { id: "yearly", label: "Yearly", lo: 350, hi: 380, perMonth: 1 / 12, min: 2 },
];

/** A merchant written the same way each time: lower case, letters only, common endings dropped. */
export const merchantKey = name => String(name || "").toLowerCase().replace(/\.(com|in|co|net)\b/g, " ").replace(/\b(pvt|ltd|llp|india|limited|private|payment|payments|pay)\b/g, " ").replace(/[^a-z]+/g, "");

/**
 * @param {{txns:Array, today:string, dismissed?:string[], tracked?:string[]}} args
 *   tracked: merchant keys already set up as a bill, so they are marked and not suggested again.
 * @returns {Array<{key:string, merchant:string, cadence:string, cadenceLabel:string, amount:number, monthly:number, count:number, last:string, next:string, active:boolean, tracked:boolean}>} dearest per month first
 */
export function detectSubscriptions({ txns = [], today, dismissed = [], tracked = [] } = {}) {
  const hidden = new Set(dismissed), have = new Set(tracked);
  const groups = new Map();
  for (const t of txns) {
    if (!t || t.type !== "expense" || t.claimOnly || t.excludeFromSpend || !t.date || !(Number(t.amount) > 0)) continue;
    const name = t.merchant || t.desc || "";
    const key = merchantKey(name);
    if (key.length < 3 || hidden.has(key)) continue;
    if (!groups.has(key)) groups.set(key, { name, list: [] });
    groups.get(key).list.push({ d: day(t.date), a: Number(t.amount), date: String(t.date).slice(0, 10) });
  }
  const now = day(today);
  const out = [];
  for (const [key, g] of groups) {
    const list = g.list.sort((x, y) => x.d - y.d);
    if (list.length < 2) continue;
    const gaps = list.slice(1).map((x, i) => x.d - list[i].d).filter(n => n > 0);
    if (!gaps.length) continue;
    const med = median(gaps);
    const cad = CADENCES.find(c => med >= c.lo && med <= c.hi);
    if (!cad || list.length < cad.min) continue;
    const inBand = gaps.filter(n => n >= cad.lo - 3 && n <= cad.hi + 3).length;
    if (inBand / gaps.length < 0.7) continue;
    const amts = list.map(x => x.a), lo = Math.min(...amts), hi = Math.max(...amts);
    if (hi / lo > 1.25) continue;                         // not a steady amount: a shop you visit, not a subscription
    const last = list[list.length - 1], amount = r2(last.a);
    const next = cad.id === "weekly" ? ymd(last.d + 7) : addMonths(last.date, cad.id === "monthly" ? 1 : cad.id === "quarterly" ? 3 : 12);
    out.push({ key, merchant: g.name, cadence: cad.id, cadenceLabel: cad.label, amount, monthly: r2(amount * cad.perMonth), count: list.length, last: last.date, next, active: now - last.d <= med * 1.5, tracked: have.has(key) });
  }
  return out.sort((a, b) => b.monthly - a.monthly);
}

/** What the active ones cost in a month and a year. */
export const subscriptionTotals = list => {
  const active = (list || []).filter(s => s.active);
  const monthly = r2(active.reduce((s, x) => s + x.monthly, 0));
  return { count: active.length, monthly, yearly: r2(monthly * 12) };
};
