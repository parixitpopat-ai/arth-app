// src/sync/testing/tabs.js — deterministic stand-ins for the browser features tab coordination relies on. TEST-ONLY.
// A lock manager with Web Locks semantics (exclusive, FIFO queue, `steal`, released when a tab goes away) and a storage-event bus.

export function createFakeLocks() {
  const queues = new Map();
  const q = name => { if (!queues.has(name)) queues.set(name, { holder: null, waiters: [] }); return queues.get(name); };
  function grant(name, req) {
    const queue = q(name);
    queue.holder = req;
    Promise.resolve().then(() => req.cb({ name })).then(
      result => { if (queue.holder === req) { queue.holder = null; next(name); } req.resolve(result); },
      err => { if (queue.holder === req) { queue.holder = null; next(name); } req.reject(err); });
  }
  function next(name) { const queue = q(name); const w = queue.waiters.shift(); if (w) grant(name, w); }
  return {
    forTab(tabId) {
      return {
        request(name, opts, cb) {
          return new Promise((resolve, reject) => {
            const req = { tabId, cb, resolve, reject }, queue = q(name);
            if (opts && opts.steal) {
              if (queue.holder) { const old = queue.holder; queue.holder = null; old.reject(Object.assign(new Error("lock stolen"), { name: "AbortError" })); }
              grant(name, req);
            } else if (!queue.holder) grant(name, req);
            else queue.waiters.push(req);
          });
        },
      };
    },
    /** The tab was closed or crashed: the browser releases its lock and drops its queued requests. */
    closeTab(tabId) {
      for (const [name, queue] of queues) {
        queue.waiters = queue.waiters.filter(w => w.tabId !== tabId);
        if (queue.holder && queue.holder.tabId === tabId) { const h = queue.holder; queue.holder = null; h.resolve(undefined); next(name); }
      }
    },
    holderOf: name => q(name).holder && q(name).holder.tabId,
  };
}

/** A tiny `storage` event bus: a write by one tab is announced to the OTHER tabs only, as browsers do. */
export function createStorageBus() {
  const tabs = new Map();
  return {
    join(tabId) {
      const listeners = new Set();
      const target = { addEventListener: (t, h) => { if (t === "storage") listeners.add(h); }, removeEventListener: (t, h) => { if (t === "storage") listeners.delete(h); } };
      tabs.set(tabId, listeners);
      return target;
    },
    /** `from` wrote `key` (null = storage cleared): notify every other tab. */
    write(from, key, storageArea = "local") { for (const [id, ls] of tabs) if (id !== from) for (const h of [...ls]) h({ key, storageArea }); },
  };
}
