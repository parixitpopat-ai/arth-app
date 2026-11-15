// The weekly phone notification: WHEN it fires and WHAT it says. Pure; the native scheduling lives in src/native/weeklyNotification.js.
// A phone notification is built on the device from the data the app last saw, so the text says when it was last up to date.
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Next time (strictly after `now`) it is `weekday` (0 = Sunday) at hour:minute, local time. */
export function nextFireAt(now, { weekday = 0, hour = 19, minute = 0 } = {}) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 7);
  return d;
}

/** Same time tomorrow (the "Later" snooze), never in the past. */
export function tomorrowAt(now, { hour = 19, minute = 0 } = {}) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hour, minute, 0, 0);
  return d;
}

/**
 * @param {object} summary  result of weeklySummary()
 * @param {{sym:string, fmt:(n:number)=>string, asOf:Date}} o  asOf = when the numbers were last worked out
 * @returns {{title:string, body:string, largeBody:string}|null} null when there is nothing to say
 */
export function buildWeeklyNotification(summary, { sym, fmt, asOf }) {
  if (!summary || !(summary.thisWeek > 0 || summary.lastWeek > 0)) return null;
  const title = summary.headline;
  const body = `${sym}${fmt(summary.thisWeek)} this week · This month ${sym}${fmt(summary.monthTotal)}`;
  const lines = [body];
  if (summary.lastWeek > 0) lines.push(`Same days last week: ${sym}${fmt(summary.lastWeek)}`);
  if (summary.topMover) lines.push(`${summary.topMover.name} is ${sym}${fmt(Math.abs(summary.topMover.diff))} ${summary.topMover.diff < 0 ? "lower" : "higher"} than the same days last week.`);
  lines.push(`As of ${DAY_NAMES[asOf.getDay()]} ${asOf.getDate()} ${MONTH[asOf.getMonth()]}, the last time Arth was open.`);
  return { title, body, largeBody: lines.join("\n") };
}
