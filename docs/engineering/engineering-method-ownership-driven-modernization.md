# Engineering Method — Ownership-Driven Modernization

`2026-08-03` · Extracted from TRX-001C's Transactions work, for reuse on future modules (Accounts, Budgets, Investments, Reports)

The output of this sprint wasn't just Transactions' architecture. It was this method, applied six times in a row without deviation. Worth naming explicitly so future modules inherit the discipline, not just the Transactions-specific artifacts.

## Core principle

**Audit reality before designing the target.** Both near-failures this session — "just move files" and "design the API migration" — were the same mistake in different clothes: designing or acting against an assumed state of the world instead of a checked one. Every step of the method depends on this holding; skip it once and the rest of the method just produces confident, well-formatted wrong answers.

## The method

1. **Audit existing behavior.** Read the actual code — every claim verified directly, not pattern-matched. (TRX-000A/B/C, TRX-001A)
2. **Identify ownership.** For every business rule found, ask who owns it today (often: nobody, or two components independently). (CBR, TRX-000C's "owned by nobody" finding)
3. **Register canonical rules.** A living document tracking canonical vs. duplicate, not a one-time report. (Canonical Business Rules Register)
4. **Freeze architecture.** Resolve ownership gaps as explicit ADRs, justified by evidence, scoped conservatively (not applied pre-emptively elsewhere). (ADR-032, ADR-033, ADR-034)
5. **Plan migration.** Concrete steps, current → target, rollback, risk — per rule, not per file. (Change Register, CR-001–005)
6. **Only then implement.** Behavior changes before storage changes; lowest-risk targets before highest-risk ones. (TRX-002A–D sequencing)

## What made this work, specifically

- **Every claim got checked against real code before being formalized** — this caught real errors (the original overstated `setTxns` duplication claim, corrected before it became a bug ticket) and real non-findings (`setInvestments` turned out not to be duplicated at all). The method only works if step 1 is genuinely done, not assumed.
- **"Evidence beats symmetry."** Loan's `outstanding` stayed a plain stored field while Account's became `Payable` — because the evidence differed (a competing derived calculation existed for one, not the other), not because consistency would have looked cleaner.
- **Scope discipline at every freeze.** ADR-033 explicitly states it's a preferred pattern, not mandatory — adopted case-by-case, never because it's merely available. This is what prevents a good pattern from becoming cargo-culted architecture two modules later.
- **Naming is part of ownership.** Two names for one occurrence (event or otherwise) is the same duplication problem as two implementations of one rule — caught and corrected during Team 6, not after.

## How to start the next module (e.g. Accounts)

1. `ACC-000` — module audit (same shape as TRX-000A–D, scaled to what Accounts actually contains)
2. A Canonical Business Rules Register for Accounts (or extend the existing one, if rules genuinely overlap — Payable's introduction this session already touches Accounts)
3. Any ownership gaps found → their own ADR, following ADR-032/033/034's evidentiary bar, not a lower one
4. A Change Register for Accounts-specific migrations
5. Behavior-first implementation sequencing, same reasoning as ADR-034

Do not skip to step 5. The two sessions where this method wasn't followed (the original ENG-001 "just move files" proposal, and treating Team 7's API design as a simple migration before checking whether an API existed) both got caught and corrected before causing damage — but they're evidence the discipline needs to be re-applied deliberately each time, not assumed to persist automatically.
