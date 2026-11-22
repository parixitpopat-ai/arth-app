// src/native/dueNotifications.js — phone reminders for bills that are coming due (Android app only), via @capacitor/local-notifications.
// Which reminders, and when: domain/notifications/dueReminders.js (pure). They are one-shots rebuilt each time Arth runs, so a bill that has
// been paid or skipped since stops reminding as soon as Arth next opens. Nothing is sent anywhere; the phone shows them from its own alarm.
// `window.__ARTH_DUE_TEST__` is a test hook (browser tests); absent in real use.
import { Capacitor } from "@capacitor/core";

export const CHANNEL = "bill-reminders", ACTION_TYPE = "bill-reminder", ID_MIN = 10000, ID_MAX = 100000;
const fake = () => (typeof window !== "undefined" ? window.__ARTH_DUE_TEST__ : null);
let lib = null;
const LN = async () => (lib || (lib = (await import("@capacitor/local-notifications")).LocalNotifications));

export const dueNotifAvailable = () => Boolean(fake()) || (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android");

/** Ask the phone for notification permission. @returns {Promise<boolean>} */
export async function dueNotifEnable() {
  if (fake()) return fake().granted !== false;
  try { const p = await (await LN()).requestPermissions(); return p.display === "granted"; } catch { return false; }
}

export async function dueNotifCancelAll() {
  if (fake()) { fake().calls?.push({ op: "cancel" }); return; }
  try {
    const ln = await LN();
    const pending = await ln.getPending();
    const mine = (pending?.notifications || []).filter(n => n.id >= ID_MIN && n.id < ID_MAX).map(n => ({ id: n.id }));
    if (mine.length) await ln.cancel({ notifications: mine });
  } catch { /* nothing was scheduled */ }
}

/** Replace every earlier bill reminder with these. @param {Array<{id:number,billId:string,at:Date,title:string,body:string}>} reminders */
export async function dueNotifSchedule(reminders) {
  if (fake()) { fake().calls?.push({ op: "schedule", reminders: reminders.map(r => ({ id: r.id, billId: r.billId, at: r.at.toISOString(), title: r.title, body: r.body })) }); return reminders.length; }
  try {
    const ln = await LN();
    await ln.createChannel({ id: CHANNEL, name: "Bill reminders", description: "Bills that are coming due", importance: 4 });
    await dueNotifCancelAll();
    if (!reminders.length) return 0;
    await ln.schedule({ notifications: reminders.map(r => ({ id: r.id, title: r.title, body: r.body, channelId: CHANNEL, extra: { billId: r.billId }, schedule: { at: r.at, allowWhileIdle: false }, isExactNotification: false })) });
    return reminders.length;
  } catch { return 0; }
}

/** Calls onOpen(billId) when the person taps a bill reminder. @returns {Promise<()=>void>} remove */
export async function dueNotifOnOpen(onOpen) {
  if (fake()) { fake().onOpen = onOpen; return () => { fake().onOpen = null; }; }
  try {
    const h = await (await LN()).addListener("localNotificationActionPerformed", ev => {
      const id = ev?.notification?.id;
      if (id >= ID_MIN && id < ID_MAX && ev.notification?.extra?.billId) onOpen(String(ev.notification.extra.billId));
    });
    return () => { try { h.remove(); } catch { /* already gone */ } };
  } catch { return () => {}; }
}
