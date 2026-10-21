// nativeAuthLinks.js
//
// Connects the installed Android app to authCallback: links that open the app while it is running (appUrlOpen) and
// the link that launched it from closed (launch URL). Does nothing in a browser.
import { createAuthCallbackHandler } from "./authCallback.js";
import { isNativeApp } from "./authRedirect.js";

export async function startNativeAuthLinks({ client, handler = createAuthCallbackHandler({ client }), allowDevScheme = false }) {
  handler.setAllowDevScheme?.(allowDevScheme);
  if (!isNativeApp()) return { handler, stop: () => {} };
  const { App } = await import("@capacitor/app");
  const sub = await App.addListener("appUrlOpen", event => { handler.handle(event?.url); });
  try {
    const launch = await App.getLaunchUrl();
    if (launch?.url) handler.handle(launch.url);
  } catch { /* no launch URL */ }
  return { handler, stop: () => { try { sub.remove(); } catch { /* already removed */ } } };
}
