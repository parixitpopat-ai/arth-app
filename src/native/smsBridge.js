// src/native/smsBridge.js — the web side of the Android "ArthSms" plugin (android/…/ArthSmsPlugin.java). Reads money-looking messages from the phone's
// SMS inbox on request. Works only inside the installed Android app; in a browser everything here reports "not available".
// Nothing is uploaded or stored by this file. `window.__ARTH_SMS_TEST__` is a test hook (the browser tests inject fake messages); it is absent in real use.
import { Capacitor, registerPlugin } from "@capacitor/core";

let plugin = null;
const native = () => (plugin || (plugin = registerPlugin("ArthSms")));
const fake = () => (typeof window !== "undefined" ? window.__ARTH_SMS_TEST__ : null);

export const smsAvailable = () => Boolean(fake()) || (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android");

/** @returns {Promise<{granted:boolean}>} */
export async function smsStatus() {
  if (fake()) return { granted: fake().granted !== false };
  try { return { granted: Boolean((await native().status()).granted) }; } catch { return { granted: false }; }
}
/** Shows Android's own permission question. @returns {Promise<{granted:boolean}>} */
export async function smsRequest() {
  if (fake()) return { granted: fake().granted !== false };
  try { return { granted: Boolean((await native().requestAccess()).granted) }; } catch { return { granted: false }; }
}
/** Money-looking messages received after `sinceMs` (newest first, at most `limit`). @returns {Promise<{ok:boolean, messages:{id:string,address:string,body:string,date:number}[], error?:string}>} */
export async function smsReadInbox(sinceMs, limit = 500) {
  if (fake()) return { ok: true, messages: (fake().messages || []).filter(m => m.date >= sinceMs).slice(0, limit) };
  try {
    const r = await native().readInbox({ sinceMs, limit });
    return { ok: true, messages: Array.isArray(r.messages) ? r.messages : [] };
  } catch (e) { return { ok: false, messages: [], error: (e && e.message) || "Could not read messages." }; }
}
