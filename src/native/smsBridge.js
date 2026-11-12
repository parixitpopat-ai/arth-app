// src/native/smsBridge.js — the web side of the Android "ArthSms" plugin (android/…/ArthSmsPlugin.java). Reads money-looking messages from the phone's
// SMS inbox on request. Works only inside the installed Android app; in a browser everything here reports "not available".
// Nothing is uploaded or stored by this file. `window.__ARTH_SMS_TEST__` is a test hook (the browser tests inject fake messages); it is absent in real use.
import { Capacitor, registerPlugin } from "@capacitor/core";

let plugin = null;
const native = () => (plugin || (plugin = registerPlugin("ArthSms")));
const fake = () => (typeof window !== "undefined" ? window.__ARTH_SMS_TEST__ : null);

export const smsAvailable = () => Boolean(fake()) || (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android");

/** granted = may read the inbox; receive = is told of each message as it arrives; notify = may show a notification. @returns {Promise<{granted:boolean,receive:boolean,notify:boolean}>} */
export async function smsStatus() {
  if (fake()) return { granted: fake().granted !== false, receive: fake().receive !== false, notify: fake().notify !== false };
  try { const r = await native().status(); return { granted: Boolean(r.granted), receive: Boolean(r.receive), notify: Boolean(r.notify) }; } catch { return { granted: false, receive: false, notify: false }; }
}
/** Shows Android's own permission questions (messages, and notifications on newer phones). @returns {Promise<{granted:boolean,receive:boolean,notify:boolean}>} */
export async function smsRequest() {
  if (fake()) return smsStatus();
  try { const r = await native().requestAccess(); return { granted: Boolean(r.granted), receive: Boolean(r.receive), notify: Boolean(r.notify) }; } catch { return { granted: false, receive: false, notify: false }; }
}
/** The messages caught as they arrived (not yet acknowledged). @returns {Promise<{id:string,address:string,body:string,date:number}[]>} */
export async function smsTakePending() {
  if (fake()) return [...(fake().pending || [])];
  try { const r = await native().takePending(); return Array.isArray(r.messages) ? r.messages : []; } catch { return []; }
}
/** Tell the phone these ids are stored in the app, so they are not delivered again. */
export async function smsAckPending(ids) {
  if (!ids || !ids.length) return;
  if (fake()) { fake().pending = (fake().pending || []).filter(m => !ids.includes(m.id)); return; }
  try { await native().ackPending({ ids }); } catch { /* delivered again next time: harmless, the app ignores ids it already has */ }
}
/** Money-looking messages received after `sinceMs` (newest first, at most `limit`). @returns {Promise<{ok:boolean, messages:{id:string,address:string,body:string,date:number}[], error?:string}>} */
export async function smsReadInbox(sinceMs, limit = 3000) {
  if (fake()) return { ok: true, messages: (fake().messages || []).filter(m => m.date >= sinceMs).slice(0, limit) };
  try {
    const r = await native().readInbox({ sinceMs, limit });
    return { ok: true, messages: Array.isArray(r.messages) ? r.messages : [] };
  } catch (e) { return { ok: false, messages: [], error: (e && e.message) || "Could not read messages." }; }
}
