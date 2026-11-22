// src/native/dailyNotification.js — the daily summary phone notification (Android app only), via @capacitor/local-notifications.
// What it says and when: domain/insights/dailySummary.js (pure). It is a ONE-SHOT for the next 9 pm, rebuilt each time Arth runs, so it never repeats
// stale numbers if Arth is not opened for days. Nothing is sent anywhere; the phone shows it from its own alarm.
// `window.__ARTH_DAILY_TEST__` is a test hook (browser tests); absent in real use.
import { Capacitor } from "@capacitor/core";
import { buildDailyNotification, nextDailyAt } from "../../domain/insights/dailySummary.js";

export const DAILY_ID = 7102, CHANNEL = "daily-summary";
const fake = () => (typeof window !== "undefined" ? window.__ARTH_DAILY_TEST__ : null);
let lib = null;
const LN = async () => (lib || (lib = (await import("@capacitor/local-notifications")).LocalNotifications));

export const dailyNotifAvailable = () => Boolean(fake()) || (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android");

export async function dailyNotifCancel() {
  if (fake()) { fake().calls?.push({ op: "cancel" }); return; }
  try { await (await LN()).cancel({ notifications: [{ id: DAILY_ID }] }); } catch { /* nothing was scheduled */ }
}

/** Schedule (replacing any earlier one) the next daily summary. No-op when there is nothing to say. @returns {Promise<Date|null>} when it will show */
export async function dailyNotifSchedule({ summary, sym, fmt, now = new Date() }) {
  const note = buildDailyNotification(summary, { sym, fmt, asOf: now });
  if (!note) { await dailyNotifCancel(); return null; }
  const at = nextDailyAt(now);
  const payload = { id: DAILY_ID, title: note.title, body: note.body, largeBody: note.largeBody, channelId: CHANNEL, extra: { route: "home" }, schedule: { at, allowWhileIdle: false }, isExactNotification: false };
  if (fake()) { fake().calls?.push({ op: "schedule", at: at.toISOString(), ...payload }); return at; }
  try {
    const ln = await LN();
    await ln.createChannel({ id: CHANNEL, name: "Daily summary", description: "What you spent today", importance: 3 });
    await ln.cancel({ notifications: [{ id: DAILY_ID }] });
    await ln.schedule({ notifications: [payload] });
    return at;
  } catch { return null; }
}

/** Calls onOpen() when the person taps the daily summary. @returns {Promise<()=>void>} remove */
export async function dailyNotifOnOpen(onOpen) {
  if (fake()) { fake().onOpen = onOpen; return () => { fake().onOpen = null; }; }
  try {
    const h = await (await LN()).addListener("localNotificationActionPerformed", ev => { if (ev?.notification?.id === DAILY_ID) onOpen(); });
    return () => { try { h.remove(); } catch { /* already gone */ } };
  } catch { return () => {}; }
}
