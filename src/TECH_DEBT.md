# Arth — Technical Debt

Tracked defects and inconsistencies found during implementation —
deliberately kept separate from `ARCHITECTURE_DECISIONS.md`, which
records intentional decisions, not things that were simply discovered.
An ADR says "we chose X for reason Y." This file says "we found X and
haven't fixed it yet."

Status: 🔴 Open · 🟡 Investigating · ✅ Resolved

---

## TD-001 — Duplicate UPI sharing implementation
**Status:** 🔴 Open
**Found:** During Bills dependency re-measurement, while auditing
business logic for domain extraction.

Two independent implementations of `sharePaymentRequest` and
`doTxnShare` exist in `App.jsx`:

- Top-level (`sharePaymentRequest` ~line 1128, `doTxnShare` ~line 1077):
  takes a request **object** (`{ recipientName, amount, contextLabel, ...details }`)
  as the first argument to `doTxnShare`.
- A second, local pair defined inside a different component (~line 8465
  / 8483): takes **individual positional arguments**
  (`recipientName, amount, contextLabel, upiHandle`) instead.

Each pair is internally consistent — neither call is "broken" on its
own. The problem is there are two complete, parallel implementations of
the same feature, built without realizing the first one already existed.

**Not yet known:**
- Whether one is dead code (unused) or both are actively called
- Whether they encode subtly different behavior beyond the calling
  convention (worth checking before assuming they're interchangeable)
- Which one, if either, should be deleted

**Do not delete either implementation until investigated.** Consolidating
based on a guess risks silently changing behavior for whichever call
sites use the "wrong" one.

**Next step:** find every call site of both `sharePaymentRequest`
variants, compare actual behavior, then consolidate to one — this is a
refactor with real behavior risk, not a mechanical extraction, so it
gets its own dedicated pass rather than folding into extraction work.
