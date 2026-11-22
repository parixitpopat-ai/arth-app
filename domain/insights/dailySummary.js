// Daily spend summary: what was spent today, set beside yesterday and the month so far. Used by the daily phone notification.
// Same "my spend" rule as the weekly summary (myAmount). Pure. Dates are local "YYYY-MM-DD" strings.
const pad = n => String(n).padStart(2, "0");
const parse = s => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const fmtD = dt => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** @returns {{today:number, yesterday:number, monthTotal:number, count:number}} */
export function dailySummary({ txns, today, myAmount }) {
  const y = (() => { const d = parse(today); return fmtD(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)); })();
  const exp = (txns || []).filter(t => t && t.type === "expense" && t.date);
  const day = d => exp.filter(t => String(t.date).slice(0, 10) === d);
  const sum = list => r2(list.reduce((s, t) => s + (Number(myAmount(t)) || 0), 0));
  const monthKey = today.slice(0, 7);
  const monthTotal = sum(exp.filter(t => String(t.date).slice(0, 7) === monthKey && String(t.date).slice(0, 10) <= today));
  return { today: sum(day(today)), yesterday: sum(day(y)), monthTotal, count: day(today).length };
}

/** Next time (strictly after `now`) it is hour:minute, local time. Default 9 pm. */
export function nextDailyAt(now, { hour = 21, minute = 0 } = {}) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

/** @returns {{title:string, body:string, largeBody:string}|null} null when there is nothing at all to say (no spend today, yesterday or this month) */
export function buildDailyNotification(s, { sym, fmt, asOf }) {
  if (!s || !(s.today > 0 || s.yesterday > 0 || s.monthTotal > 0)) return null;
  const title = s.today > 0 ? `Today: ${sym}${fmt(s.today)} spent` : "Nothing spent today";
  const body = `This month ${sym}${fmt(s.monthTotal)}${s.yesterday > 0 ? ` · Yesterday ${sym}${fmt(s.yesterday)}` : ""}`;
  const lines = [body, `As of ${DAY_NAMES[asOf.getDay()]} ${asOf.getDate()} ${MONTH[asOf.getMonth()]}, the last time Arth was open.`];
  return { title, body, largeBody: lines.join("\n") };
}
