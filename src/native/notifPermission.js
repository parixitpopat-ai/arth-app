// src/native/notifPermission.js — can Arth show notifications on this phone, and a way to the phone's own switch when it cannot.
// Asks Capacitor's notification permission first; if that does not say "granted", asks Arth's own phone check (ArthSms.status().notify, which also
// knows if notifications were switched off for the app in Android settings). Always answers with WHY, so the screen can say it instead of doing nothing.
// `window.__ARTH_NOTIF_TEST__ = {ok, state}` (or the older due / weekly / daily hooks' `granted`) is a test hook; absent in real use.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { smsStatus } from "./smsBridge.js";

let lib = null;
const LN = async () => (lib || (lib = (await import("@capacitor/local-notifications")).LocalNotifications));
const hook = () => {
  if (typeof window === "undefined") return null;
  const n = window.__ARTH_NOTIF_TEST__; if (n) return { ok: n.ok !== false, state: n.state || (n.ok === false ? "denied" : "granted") };
  const f = window.__ARTH_DUE_TEST__ || window.__ARTH_WEEKLY_TEST__ || window.__ARTH_DAILY_TEST__;
  return f ? { ok: f.granted !== false, state: f.granted === false ? "denied" : "granted" } : null;
};
let nativePlugin = null;
const native = () => (nativePlugin || (nativePlugin = registerPlugin("ArthSms")));

/** @returns {Promise<{ok:boolean, state:string}>} state: "granted" | "denied" | "prompt" | "off-in-settings" | "error: …" */
export async function ensureNotifPermission() {
  const h = hook(); if (h) return h;
  if (!(Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android")) return { ok: false, state: "not-on-phone" };
  let state = "unknown";
  try {
    const ln = await LN();
    let p = await ln.checkPermissions(); state = String(p.display);
    if (p.display !== "granted") { p = await ln.requestPermissions(); state = String(p.display); }
    if (p.display === "granted") {
      const s = await smsStatus();   // the app's own check also sees "notifications switched off for Arth" in Android settings
      return s.notify ? { ok: true, state: "granted" } : { ok: false, state: "off-in-settings" };
    }
  } catch (e) { state = `error: ${String((e && e.message) || e).slice(0, 80)}`; }
  return { ok: false, state };
}

/** Opens Android's notification settings for Arth. @returns {Promise<boolean>} false when the phone could not open it */
export async function openNotificationSettings() {
  if (typeof window !== "undefined" && window.__ARTH_NOTIF_TEST__) { window.__ARTH_NOTIF_TEST__.opened = (window.__ARTH_NOTIF_TEST__.opened || 0) + 1; return true; }
  try { await native().openNotificationSettings(); return true; } catch { return false; }
}

/** One sentence for the person. */
export function notifBlockedMessage(state) {
  if (state === "off-in-settings") return "Notifications are switched off for Arth in your phone's settings.";
  if (state === "denied") return "Arth is not allowed to show notifications. Allow it in your phone's settings.";
  if (String(state).startsWith("error")) return `The phone did not answer the notification question (${state}).`;
  return `Arth could not get permission to show notifications (${state}).`;
}
