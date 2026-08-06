# CBR-TRX-00X — Person Attribution Semantics (mode: spent_on vs. owes)

**Status:** Ready for registration
**Owner domain:** Transaction (per CR-ACC-BUD-001's resolution — Budget consumes this rule, does not define it)
**Numbering note:** left as `CBR-TRX-00X` deliberately — this repo's CBR convention is per-module (`TRX-001-cbr-reconciliation-report.md` is the existing Transactions CBR), and I don't have that file's current entry count in front of me. Whoever merges this should assign the real next number rather than have me guess it.

---

## Rule

**A person's Analytical Attribution for Budget (or any consumer reading `t.people` for attributed spend) counts `mode: "spent_on"` entries only. `mode: "owes"` entries are excluded.**

## Evidence (repository-verified, `src/App.jsx`)

- **Write-site intent, stated in the code's own comments** (L4356–4362):
  ```js
  // tagMode="person" = they owe me back — save as receivable in people map
  ...mode:"owes"...
  // tagMode="attribute" = for them, no collection — save in people as spent_on
  ...mode:"spent_on"...
  ```
- **Confirmed by independent, load-bearing usage elsewhere in the same file** — `myShare` (L2530) explicitly subtracts `mode==="owes"` amounts out of the user's own spend: `amount − sum(mode==="owes" amounts)`. If `"owes"` were attributable spend, this formula would double-count it.
- **Confirmed absence, not just presence:** `mode: "on_me"` — assumed to exist by the sandbox-built `TransactionPersonShare` aggregate — does not appear anywhere in `App.jsx`'s actual mode assignments. Only `"owes"` and `"spent_on"` are ever written.

## Canonical vs. duplicate status

**Canonical, not newly designed.** This CBR entry formalizes behavior that already exists and is already internally consistent across every site checked (`myShare`, the two write sites, and every read site using `mode==="owes"` filters). No implementation changed to produce this rule — only a downstream consumer (see below) that had gotten it wrong.

## Consumer correction this rule caused

**`domain/allocations/adapter.js`, `getPersonAttributedTotal`** — previously summed all `t.people` entries regardless of mode, contradicting this rule. Corrected to filter on `mode === "spent_on"`. 16/16 tests passing post-fix. Not a product decision or a reinterpretation — a defect corrected against evidence that already existed in the codebase before the fix.

## Governance Note

No Change Register entry was created for this work. Change Register entries in this repository consistently represent architectural migrations — duplicate logic moving to a canonical owner, ownership changes, architectural restructuring. This is none of those: architecture didn't change, ownership didn't change, business semantics didn't change. A consumer (`getPersonAttributedTotal`) was corrected to conform to an already-canonical rule that existed in the repository before this investigation began. That belongs in the CBR, the PR, and the tests — recorded here so the absence doesn't read as an oversight to a future reader.

## What this does not decide

- Whether Group-dimension attribution (`t.groupAllocations`) has an equivalent mode distinction — not audited here, `groupAllocations` entries were seen using `mode:"owes"` in the grep evidence but their full semantic treatment wasn't traced as part of this resolution.
- Category-dimension Attribution's design (still open per CR-ACC-BUD-001, unrelated to this rule).
- Whether the recovered sandbox `TransactionPersonShare` aggregate should be corrected to match this vocabulary before adoption — flagged as Recovered Design Drift (see CR-ACC-BUD-001), not decided here.
