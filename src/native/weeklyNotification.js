// src/native/weeklyNotification.js — the weekly summary phone notification (Android app only), via @capacitor/local-notifications.
// What it says and when: domain/insights/weeklyNotification.js (pure). The notification is a ONE-SHOT for the next Sunday 7 pm, rebuilt each time Arth
// runs, so it never repeats stale numbers if Arth is not opened for weeks. Nothing is sent anywhere; the phone shows it from its own alarm.
// `window.__ARTH_WEEKLY_TEST__` is a test hook (browser tests); absent in real use.
import { Capacitor } from "@capacitor/core";
import { buildWeeklyNotification, nextFireAt, tomorrowAt } from "../../domain/insights/weeklyNotification.js";

export const WEEKLY_ID = 7101, CHANNEL = "weekly-summary", ACTION_TYPE = "weekly-summary";
const fake = () => (typeof window !== "undefined" ? window.__ARTH_WEEKLY_TEST__ : null);
let lib = null;
const LN = async () => (lib || (lib = (await import("@capacitor/local-notifications")).LocalNotifications));

export const weeklyNotifAvailable = () => Boolean(fake()) || (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android");

/** Ask the phone for notification permission. @returns {Promise<boolean>} true when allowed */
export async function weeklyNotifEnable() {
  if (fake()) return fake().granted !== false;
  try { const p = await (await LN()).requestPermissions(); return p.display === "granted"; } catch { return false; }
}

export async function weeklyNotifCancel() {
  if (fake()) { fake().calls?.push({ op: "cancel" }); return; }
  try { await (await LN()).cancel({ notifications: [{ id: WEEKLY_ID }] }); } catch { /* nothing was scheduled */ }
}

async function put(ln, at, note) {
  const payload = { id: WEEKLY_ID, title: note.title, body: note.body, largeBody: note.largeBody, channelId: CHANNEL, actionTypeId: ACTION_TYPE, extra: { route: "insights" },
    schedule: { at, allowWhileIdle: false }, isExactNotification: false };   // inexact on purpose: a weekly summary does not need to-the-minute timing, and this avoids the "exact alarm" permission
  if (fake()) { fake().calls?.push({ op: "schedule", at: at.toISOString(), ...payload }); return; }
  await ln.createChannel({ id: CHANNEL, name: "Weekly summary", description: "Your spend this week compared with last week", importance: 3 });
  await ln.registerActionTypes({ types: [{ id: ACTION_TYPE, actions: [{ id: "review", title: "Review" }, { id: "later", title: "Later" }] }] });
  await ln.cancel({ notifications: [{ id: WEEKLY_ID }] });
  await ln.schedule({ notifications: [payload] });
}

/** Schedule (replacing any earlier one) the next weekly summary. No-op when there is nothing to say. @returns {Promise<Date|null>} when it will show */
export async function weeklyNotifSchedule({ summary, sym, fmt, now = new Date() }) {
  const note = buildWeeklyNotification(summary, { sym, fmt, asOf: now });
  if (!note) { await weeklyNotifCancel(); return null; }
  const at = nextFireAt(now);
  try { await put(fake() ? null : await LN(), at, note); return at; } catch { return null; }
}

/** "Later": the same summary again tomorrow at the usual time. */
export async function weeklyNotifSnooze({ summary, sym, fmt, now = new Date() }) {
  const note = buildWeeklyNotification(summary, { sym, fmt, asOf: now });
  if (!note) return null;
  const at = tomorrowAt(now);
  try { await put(fake() ? null : await LN(), at, note); return at; } catch { return null; }
}

/** Calls onAction(actionId) when the person taps the notification ("tap") or one of its buttons ("review" / "later"). @returns {Promise<()=>void>} remove */
export async function weeklyNotifOnAction(onAction) {
  if (fake()) { fake().onAction = onAction; return () => { fake().onAction = null; }; }
  try {
    const h = await (await LN()).addListener("localNotificationActionPerformed", ev => { if (ev?.notification?.id === WEEKLY_ID) onAction(ev.actionId); });
    return () => { try { h.remove(); } catch { /* already gone */ } };
  } catch { return () => {}; }
}
