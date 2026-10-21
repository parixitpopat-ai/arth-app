// authCallback.js
//
// Turns a returning sign-in link into a session inside the installed app. Dependency-injected (client, parser) so it
// can be tested without a phone. Hard rules:
//   - only a link that parseAuthCallback accepts is ever acted on; everything else is ignored silently
//   - only the one-time `code` is exchanged (with the app's own PKCE verifier); tokens are never read from a link
//   - the code and any session are NEVER logged or put in messages; messages are fixed friendly texts
//   - a link is ignored while someone is already signed in (no silent account switch)
//   - a code is acted on once; a retryable network failure may be retried by tapping the link again

import { parseAuthCallback, friendlyAuthMessage } from "./authRedirect.js";

const NETWORK_MESSAGE = "Couldn't reach Arth. Check your connection and tap the link again.";
const ALREADY_SIGNED_IN = "You're already signed in on this phone.";

export function createAuthCallbackHandler({ client, allowDevScheme: initialDev = false, parse = parseAuthCallback } = {}) {
  let allowDevScheme = initialDev;
  let state = { status: "idle", message: "" };
  const listeners = new Set();
  const used = new Set();                       // codes already acted on in this run (memory only)
  const set = next => { state = next; listeners.forEach(fn => { try { fn(); } catch { /* a listener must not break sign-in */ } }); };

  async function handle(url) {
    const r = parse(url, { allowDevScheme });
    if (!r.ok) {
      if (r.kind === "untrusted") return { handled: false, reason: "untrusted" };
      set({ status: "error", message: r.message });
      return { handled: true, ok: false };
    }
    if (used.has(r.code)) return { handled: false, reason: "duplicate" };
    used.add(r.code);

    // Someone is already signed in: a link must not swap the account underneath them.
    try {
      const { data } = await client.auth.getSession();
      if (data?.session) { set({ status: "error", message: ALREADY_SIGNED_IN }); return { handled: true, ok: false, reason: "signed-in" }; }
    } catch { /* no readable session: continue */ }

    set({ status: "exchanging", message: "" });
    try {
      const { data, error } = await client.auth.exchangeCodeForSession(r.code);
      if (error || !data?.session) {
        const retryable = error?.name === "AuthRetryableFetchError";
        if (retryable) used.delete(r.code);
        set({ status: "error", message: retryable ? NETWORK_MESSAGE : friendlyAuthMessage(error?.code || (/expired/i.test(error?.message || "") ? "flow_state_expired" : "flow_state_not_found")) });
        return { handled: true, ok: false };
      }
      set({ status: "done", message: "" });      // the app's own auth listener picks the session up from here
      return { handled: true, ok: true };
    } catch (e) {
      const network = e instanceof TypeError || e?.name === "AuthRetryableFetchError";
      if (network) used.delete(r.code);
      set({ status: "error", message: network ? NETWORK_MESSAGE : friendlyAuthMessage(null) });
      return { handled: true, ok: false };
    }
  }

  return {
    handle,
    getState: () => state,
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    setAllowDevScheme: v => { allowDevScheme = Boolean(v); },
    dismiss: () => set({ status: "idle", message: "" }),
  };
}
