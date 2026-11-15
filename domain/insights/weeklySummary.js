// Weekly spend summary: this week (Monday to today) against the SAME stretch of last week (Monday to the same weekday),
// so a Wednesday is compared with last Wednesday, never with a whole finished week. Used by the Home card and (later) the
// weekly phone notification, so both say the same thing.
// Pure. Dates are local "YYYY-MM-DD" strings (never UTC slices). `myAmount(txn)` is the app's one "my spend" rule.
const pad = n => String(n).padStart(2, "0");
const parse = s => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const fmtD = dt => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
const addDays = (dt, n) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n);
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

export const mondayOf = s => { const d = parse(s); return fmtD(addDays(d, -((d.getDay() + 6) % 7))); };

/**
 * @param {{txns:Array, today:string, myAmount:(t:object)=>number, catIdsOf?:(t:object)=>string[], catName?:(id:string)=>string, minMover?:number}} a
 * @returns {{weekKey:string, from:string, to:string, lastFrom:string, lastTo:string, thisWeek:number, lastWeek:number, pct:number|null,
 *   direction:"up"|"down"|"same"|null, monthTotal:number, topMover:{id:string,name:string,diff:number}|null, headline:string}}
 */
export function weeklySummary({ txns, today, myAmount, catIdsOf = () => [], catName = id => id, minMover = 100 }) {
  const from = mondayOf(today);
  const elapsed = Math.round((parse(today) - parse(from)) / 86400000);
  const lastFrom = fmtD(addDays(parse(from), -7));
  const lastTo = fmtD(addDays(parse(lastFrom), elapsed));
  const exp = (txns || []).filter(t => t && t.type === "expense" && t.date);
  const inRange = (t, a, b) => { const d = String(t.date).slice(0, 10); return d >= a && d <= b; };
  const sum = (a, b) => r2(exp.filter(t => inRange(t, a, b)).reduce((s, t) => s + (Number(myAmount(t)) || 0), 0));
  const thisWeek = sum(from, today), lastWeek = sum(lastFrom, lastTo);
  const monthKey = today.slice(0, 7);
  const monthTotal = r2(exp.filter(t => String(t.date).slice(0, 7) === monthKey && String(t.date).slice(0, 10) <= today).reduce((s, t) => s + (Number(myAmount(t)) || 0), 0));
  const pct = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null;
  const direction = pct === null ? null : pct > 0 ? "up" : pct < 0 ? "down" : "same";

  const byCat = (a, b) => { const m = {}; exp.filter(t => inRange(t, a, b)).forEach(t => { const ids = catIdsOf(t); const amt = Number(myAmount(t)) || 0; if (!(amt > 0)) return; (ids.length ? ids : ["__none__"]).forEach(id => { m[id] = (m[id] || 0) + amt / (ids.length || 1); }); }); return m; };
  const a = byCat(from, today), b = byCat(lastFrom, lastTo);
  let topMover = null;
  new Set([...Object.keys(a), ...Object.keys(b)]).forEach(id => {
    if (id === "__none__") return;
    const diff = r2((a[id] || 0) - (b[id] || 0));
    if (Math.abs(diff) < minMover) return;
    if (direction === "down" && diff >= 0) return;
    if (direction === "up" && diff <= 0) return;
    if (!topMover || Math.abs(diff) > Math.abs(topMover.diff)) topMover = { id, name: catName(id), diff };
  });
  const headline = pct === null || direction === "same" ? "Spend this week" : `Spends ${direction} by ${Math.abs(pct)}% this week`;
  return { weekKey: from, from, to: today, lastFrom, lastTo, thisWeek, lastWeek, pct, direction, monthTotal, topMover, headline };
}
