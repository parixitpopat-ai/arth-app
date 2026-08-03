# Engineering Decision Log (EDL)

Distinct from ADRs and ARCH reports:

- **ADRs** capture *why the architecture should be* — long-lived, frozen unless revisited via RFC.
- **ARCH reports** capture *what the repository currently is* — factual, re-generated as the repo changes.
- **EDL** captures *why a particular implementation choice was made during execution* — the sequencing and tactical reasoning that doesn't belong in either of the above, but is worth keeping so the reasoning survives past whoever made the call.

Newest entries at the top. Each entry: date, decision, reasoning, what it doesn't decide, and traceability (Affected Tickets / Modules / ADRs).

---

## EDL-025 — TRX-002A implemented and proven: Application Layer plumbing, first tests this repo has ever had

`2026-08-03`

**Decision:** Built and ran (not just designed) TRX-002A's full scope: `CommandDispatcher`, `CommandResult`, `AggregateRoot`/`Repository`/`DomainEventPublisher` contracts, `InMemoryRepository`/`InMemoryEventPublisher` for proof purposes, `SnapshotAdapter` wrapping the real `cloudSync.js` functions (dependency-injected for testability), and a trivial example (`Tag` aggregate + `CreateTagHandler`) — deliberately not `Transaction`. Wrote 4 tests using Node's built-in `node:test` (zero new dependencies), ran them for real, all passing, proving the exact pipeline stated in the success criterion end to end. Added `npm test` to `package.json`. Updated RSK-002 in the Risk Register from "Active" to "Partially addressed" — not closed, since 4 plumbing tests don't cover `App.jsx`'s actual business logic.

**Reasoning:** Per the method's core principle applied to implementation, not just audits: a claim that the pipeline "works" needed to be run, not asserted — the same discipline as verifying code directly instead of pattern-matching throughout this whole session, now applied to proving implementation instead of just auditing existing code. Marking RSK-002 "partially addressed" rather than silently leaving it "Active" (stale) or falsely marking it "Resolved" (overclaiming) matches the register's own stated purpose: monitored until genuinely eliminated.

**What it doesn't decide:** `TRX-002B`'s actual Transaction Aggregate implementation — this ticket's job was proving the plumbing works on a trivial case, not building the real domain.

**Affected Tickets:** TRX-002A (done), TRX-002B (next), RSK-002 (updated)
**Affected Modules:** Transactions (Application Layer), Repository Risk Register
**Affected ADRs:** ADR-034 (implemented, not just designed)

---



`2026-08-03`

**Decision:** Froze ADR-034. Elevated "audit reality before designing the target" from an observation in the method doc's retrospective section to its stated core principle, since both near-failures this session shared that root cause. Closed TRX-001C at a milestone documenting all nine deliverables produced beyond the original single-aggregate-design scope. Established the implementation-phase Definition of Done: no new ADRs unless implementation reveals a genuine gap against ADR-032/025/026, conformance to frozen architecture becomes the review standard, replacing architecture-discovery as the default mode.

**Reasoning:** Naming the core principle explicitly (not just implying it via two examples) makes the method actually teachable to whoever picks up the next module, per the stated goal. Closing formally, with a stated Definition of Done change, prevents the implementation phase from drifting back into "discover architecture as you go" by default — the same discipline ADR-032's freeze notice already modeled at the repo level, applied here at the workstream level.

**What it doesn't decide:** TRX-002A's actual implementation content — that's the next workstream's first deliverable, not this one's.

**Affected Tickets:** ADR-034 (frozen), TRX-001C (closed), TRX-002A (next)
**Affected Modules:** Transactions, all future modules (via the method)
**Affected ADRs:** ADR-034 (frozen)

---



`2026-08-03`

**Decision:** Retitled and redrafted ADR-034 as "Transition from State-Centric to Command-Centric Architecture" rather than a snapshot-persistence migration ADR — `saveCloudSnapshot()` is the visible symptom, not the actual gap being decided. Resequenced the migration: `TRX-002A` (Application Layer plumbing only, no Transaction implementation), `TRX-002B` (Transaction Aggregate), `TRX-002C` (Settlement extraction), `TRX-002D` (Payable introduction) — all before any persistence-layer migration, since a snapshot serializer downstream of a correct aggregate is itself ADR-033-compliant. Extracted the 6-step method (audit → identify ownership → register → freeze → plan migration → implement) as its own reusable artifact for future modules, rather than letting it stay implicit in how this session happened to work.

**Reasoning:** Framing ADR-034 around persistence would have made it stale the moment the storage technology changes; framing it around the behavior/state distinction makes it durable independent of that. Sequencing behavior before storage means TRX-002A–D can each be verified against a working app without also debugging a storage migration simultaneously — same "don't change two things at once" reasoning already used for ADR-032 §3B. The method extraction matters because two moments this session (the original ENG-001 "just move files" proposal, and almost treating Team 7 as endpoint migration before checking one existed) show the discipline doesn't persist automatically — it has to be reapplied deliberately, including by future modules.

**What it doesn't decide:** The actual persistence-layer replacement technology or timeline — explicitly not scheduled. ADR-034 itself remains Proposed, not yet signed off.

**Affected Tickets:** ADR-034 (new, Proposed), TRX-002A–D (sequencing established)
**Affected Modules:** Transactions, all future modules (via the extracted method)
**Affected ADRs:** ADR-034 (new), ADR-032/025 (reasoning extended to persistence sequencing)

---



`2026-08-03`

**Decision:** Before designing Team 7's API, checked the actual sync layer (`src/cloudSync.js`) rather than assume an endpoint inventory existed to audit. Found none exists — the entire persistence model is a single whole-app-state JSON blob synced via `saveCloudSnapshot`/`loadCloudSnapshot`, no per-entity tables, no commands, no server-side validation of anything frozen in Teams 1–6. Reframed Team 7 as green-field command design (everything genuinely "New," not migrated), and flagged the blob-to-relational migration itself as a significant undertaking deserving its own ADR/ticket, not something to assume away. Completed Team 8 (Frontend), organized strictly around aggregate-owned commands per Team 7, with the Settlement Screen explicitly designed to contain zero business logic (no `Math.max`, no `remainingShare()` calculation) — all of that stays server/aggregate-side.

**Reasoning:** Designing an "API vNext" migration table without checking whether an API v-current exists would have produced a plausible-looking but false artifact — the same discipline as verifying the settlement mutation-map claims directly rather than pattern-matching. The finding itself (zero server-side enforcement of anything frozen so far) is more important than the API design table it produced, and needed to be stated plainly rather than buried in a footnote.

**What it doesn't decide:** The blob-to-relational migration strategy (flagged for its own ADR/ticket), whether Loan/Payable get direct-payment endpoints separate from `SettlementService`, and Draft Transactions' eventual domain status.

**Affected Tickets:** Team 7, Team 8 (both draft — completes the original 8-team TRX-001C sprint)
**Affected Modules:** Transactions, Accounts, Loans, Payables, all future API/frontend work
**Affected ADRs:** none new; ADR-017/018/024/025 all reflected in the design

---



`2026-08-03`

**Decision:** Produced the event catalog (Aggregate/Process/Integration tiers). Resolved two naming conflicts rather than introducing duplicates: kept Team 4's already-frozen `TransactionSettlementApplied`/`LoanPaymentApplied`/`SettlementCompleted` over this message's illustrative `PersonShareSettled`/`AllocationCompleted`, since both pairs described the same events. Added `PayableSettled` following the same `{Aggregate}{WhatHappened}` naming pattern. Applied ADR-017's "flag, not new type" reasoning to events too: no separate `RefundCompleted`, refunds are `SettlementCompleted` with `isRefund:true` in the payload. Checked all 3 proposed integration events against "who actually publishes this" — only `AccountBalanceChanged` survived as genuinely cross-domain (published by `Account`, not Transaction); `DashboardMetricsUpdated` and `BudgetImpactCalculated` were rejected from this catalog as belonging to Home/Budget domains' own event catalogs, not this one.

**Reasoning:** Introducing two names for the same event would violate the "one publisher per event" rule in spirit even with technically-one-publisher-each, since it's really one occurrence described twice. Accepting all 3 proposed integration events without checking publisher ownership would have repeated exactly the mistake AQ-001 corrected for Account/Payable — claiming ownership of a concern this domain doesn't actually own.

**What it doesn't decide:** The exact payload shapes beyond what's stated; whether Home/Budget domains actually need their own `DashboardMetricsUpdated`/`BudgetImpactCalculated` events at all (not this domain's call to make).

**Affected Tickets:** Team 6 (draft), Teams 7/8 (next)
**Affected Modules:** Transactions, Accounts, Loans, Payables
**Affected ADRs:** ADR-017 (refund-as-flag reasoning extended to events), ADR-033 (SettlementService statelessness reaffirmed via what it's allowed to publish)

---



`2026-08-03`

**Decision:** Reclassified CR-005 in the Change Register as a "Canonicalization Migration" (distinct type from CR-001–004's "Duplicate Migration") — the owner is already decided (`Payable`, per AQ-001), only the internal implementation is open, so it doesn't block architecture-dependent work. Produced Team 5's schema design: `transaction`, `transaction_line_item`, `transaction_person_share`, `settlement_link`, `payable` (new), `account` (with `outstanding` removed per AQ-001), `loan` (kept its own stored `outstanding` — no evidence of a competing derived calculation the way CC accounts had), `settlement_event` (process-level), `transaction_events` (aggregate-level, previewed for Team 6).

**Reasoning:** The schema doesn't just describe the model — several choices structurally enforce decisions already made, so a future developer can't accidentally violate them: `remaining_amt`/`settled` modeled as computed rather than independently-writable columns (schema-level enforcement of the invariant that caused the original bug), no `outstanding` column on `account` at all (removes the ability to reintroduce AQ-001's two-sources-of-truth problem), no soft-delete column (ADR-018 respected structurally, not just by convention).

**What it doesn't decide:** Whether `payable.outstanding_cache` is actually needed for performance — explicitly left as an implementation decision, not architecture. Team 6's full event list, previewed but not finalized.

**Affected Tickets:** CR-005 (reclassified), Team 5 (complete), Team 6 (next, partially previewed)
**Affected Modules:** Transactions, Accounts, Loans, Payables
**Affected ADRs:** ADR-018, ADR-032, ADR-033 (all reflected structurally in schema)

---



`2026-08-03`

**Decision:** Resolved AQ-001. `Account` does not implement `SettlementTarget`. A CC account's outstanding balance is modeled as a `Payable` — a distinct entity associated with the account, not the account itself. Deciding evidence: `outstanding` is CC-specific (never touched on non-CC accounts, confirmed via full-file grep), and a second, independent derived calculation (`cardOutstanding()`, statement-cycle-based) already exists alongside the stored field with no evidence of reconciliation — meaning `Account` already has an internal consistency problem that would have been inherited by any `SettlementTarget` implementation on it directly. Registered this stored-vs-derived discrepancy as CR-005, since it's a real duplicate-of-a-different-kind not previously in scope. Updated CR-003's migration plan to target `Payable.applySettlement()` instead of the previously-blocked `Account` question.

**Reasoning:** The investigation surfaced evidence (the second outstanding-calculation) that wasn't visible when the question was first raised — treating it as decisive rather than incidental avoided building `SettlementTarget` on top of an aggregate with an unresolved internal inconsistency.

**What it doesn't decide:** Whether `account.outstanding` gets cached from `Payable.outstanding()` or retired entirely (CR-005's own resolution) — flagged, not decided, matching AQ-001's own discipline of not deciding more than the evidence supports.

**Affected Tickets:** AQ-001, CR-003 (updated), CR-005 (new)
**Affected Modules:** Accounts, Transactions
**Affected ADRs:** ADR-033 (Payable usage now has a concrete first case)

---



`2026-08-03`

**Decision:** Froze ADR-033 with the added scoping clause ("preferred pattern, not mandatory framework, adopt case-by-case, never merely because it's available") to prevent future over-application. ADR-032 + ADR-033 now form the complete architectural foundation for Transactions Modernization — Team 3's Change Register migration plans (CR-001–004) can proceed against frozen targets instead of a Proposed one.

**Reasoning:** Signing off before Team 3 begins means migration plans are written toward stable destinations, not toward architecture that could still change under them — same discipline as not writing BUG-TRX-001 before verifying the mutation-map evidence directly.

**What it doesn't decide:** The actual migration steps/rollback/risk content for CR-001–004 — that's Team 3's deliverable, next.

**Affected Tickets:** ADR-033, Team 3 (unblocked)
**Affected Modules:** Transactions, Loans, Accounts, general architecture
**Affected ADRs:** ADR-033 (frozen)

---



`2026-08-03`

**Decision:** Froze Team 4's settlement architecture with refinements: the contract renamed to `SettlementTarget` (`outstanding()`/`applySettlement(allocation)`), events split into `TransactionSettlementApplied`/`LoanPaymentApplied` (aggregate-level) vs. `SettlementCompleted` (process-level), and an explicit statelessness invariant added for `SettlementService`. Drafted ADR-033, elevating "cross-aggregate decisions belong to domain services, aggregate state changes belong only to the aggregate that owns the invariant" from a Transactions-scoped answer to CR-004 into a general architectural rule, since the reasoning isn't specific to Settlement.

**Reasoning:** The two rejected failure modes (duplicated per-aggregate logic vs. a service that bypasses aggregate boundaries) are both concretely evidenced by this session's bugs, not hypothetical — worth stating as a named rule precisely because it'll recur wherever a future process spans multiple aggregates. ADR-033 doesn't independently invoke ADR-018's reopening clause — it resolves a question ADR-032 itself left open, within already-authorized work.

**What it doesn't decide:** Whether other Arth business processes beyond Settlement should adopt this pattern (case by case, not pre-emptive) — and ADR-033 itself remains Proposed, not yet signed off.

**Affected Tickets:** TRX-001C (Team 4 ✅), Team 3 (unblocked)
**Affected Modules:** Transactions, Loans, Accounts, general architecture
**Affected ADRs:** ADR-033 (new, Proposed), ADR-032 (question resolved)

---



`2026-08-03`

**Decision:** Froze the Transaction Aggregate domain model with the added Invariant Table (11 rows, 10 confirmed `✓`, 1 `Open` — LineItem/amount reconciliation, deliberately left for Team 2's audit rather than assumed). Produced Team 2's Code Audit, mapping every known transaction-related piece of code (AddModal's 15 responsibility domains, `applyRepaymentAllocations`, `SettleModal.settle()`, `ItemSheetModal`, `TxnRow`, the `remainingShare` duplicate, Loan/Investment/Account mutation sites) onto Keep/Merge/Delete/Move/Hold verdicts against the frozen boundary. Found that `src/domain/bills/refunds.js` and `src/domain/financialEngine/engine.js` already exist as real prior art for this exact extraction discipline — each file documents its own "audited clean, no hidden dependencies" reasoning, matching this session's methodology independently. Team 2's recommendations deliberately follow that existing pattern rather than introducing a second style.

**Reasoning:** The Invariant Table gives Teams 2–8 a rejectable contract rather than a vague model description. Discovering the existing `src/domain/` precedent mid-audit is worth surfacing explicitly — it validates the approach and means Team 2 isn't inventing conventions from scratch.

**What it doesn't decide:** CR-004 (settlement capability shape) — several Team 2 rows are explicitly held pending that decision. Price breakdown/EMI origination/CC-EMI conversion responsibility domains remain unaudited at the depth needed for a real Keep/Merge/Delete verdict.

**Affected Tickets:** TRX-001C (Team 1 ✅, Team 2 draft)
**Affected Modules:** Transactions, Accounts, Loans, Investments, Bills
**Affected ADRs:** ADR-017 (respected, not redesigned), ADR-018 (invariant inherited, not reopened), ADR-032

---



`2026-08-03`

**Decision:** Corrected CBR/TRX-001A phrasing from "6 new rules" to "6 pre-existing rules identified, audited, and formally admitted" — the underlying business logic existed in the code before TRX-001A; only the governance record changed. Reframed CR-004 with the specific design question for TRX-001C: whether settlement should be built as a domain capability with pluggable targets (Transaction allocations, Loan principal, Receivables, future liabilities) rather than one implementation per object type, so the Loan/Transaction pattern overlap gets resolved by design rather than by a later reactive refactor. Closed the reconciliation phase at the finalized baseline: 8 canonical, 4 duplicate, 0 unaudited, Change Register operational.

**Reasoning:** The terminology distinction matters for every future audit — conflating "canonical count went up" with "new capability was built" would misrepresent what governance work actually does. The CR-004 reframe turns an audit footnote into an explicit TRX-001C design question, which is more useful than leaving it as a passive monitoring note.

**What it doesn't decide:** Whether the pluggable-settlement-capability design actually holds up under real aggregate-boundary design — that's TRX-001C's job, this only states the question precisely.

**Affected Tickets:** TRX-001A, TRX-001B, TRX-001C (next)
**Affected Modules:** Transactions, Loans, Accounts
**Affected ADRs:** ADR-032

---



`2026-08-03`

**Decision:** Directly read all 4 `setLoans` and 2 `setInvestments` call sites. Found no new duplication — `setInvestments`' 2 sites are create/update vs. delete (different operations); `setLoans`' 4 sites split into 2 creation paths (generic vs. CC-EMI-linked, not confirmed as the same rule) and 2 reduction paths (manual settlement vs. automatic installment-tracking, genuinely different triggers). One conceptual relationship flagged, not classified as a strict duplicate: the manual loan-settlement reduction (L4512) uses the same underlying pattern as the already-registered 4-way Settlement Allocation duplicate, applied to Loans instead of Transaction-shares — logged as CR-004 in the new Change Register, marked lower priority, for TRX-001C to consider when drawing Aggregate boundaries. Registered all 6 newly-audited rules as Canonical in the CBR (baseline moved 2→8 canonical, duplicates held at 4). Created the Change Register (`CHANGE-REGISTER-transactions.md`) as TRX-001B, seeded with CR-001 through CR-004, the operational artifact ADR-032 §3B required but that didn't exist until now. Added a DoD line requiring any duplicate migration to have a corresponding Change Register entry reaching `Complete`.

**Reasoning:** Closing the audit gap before Aggregate design (per the agreed TRX-001 sequence) avoids designing boundaries around an incomplete rule set. Creating the Change Register now, rather than deferring it, means TRX-001C can immediately reference CR-001/002/003/004 instead of inventing migration tracking ad hoc.

**What it doesn't decide:** Whether CR-004 (the Loan/Transaction settlement overlap) actually gets unified — that's TRX-001C's design call, not this ticket's.

**Affected Tickets:** TRX-001A, TRX-001B, TRX-001C (next)
**Affected Modules:** Transactions, Loans, Investments, Accounts
**Affected ADRs:** ADR-032 (§3B now operational)

---



`2026-08-01`

**Decision:** Formalized the Definition of Done for all `TRX-001+` tickets directly in the CBR (not a new standalone document): acceptance criteria + ADR-032 compliance + CBR updated + duplicate-count reduced/canonical-count increased or explicitly justified + no new duplicate introduced. Added the standing "What happened to the CBR?" PR review convention with a logging table in the same document. Closed Repository Engineering Phase 1 at the milestone marker. Next thread starts under a new title ("Arth OS — Transactions Modernization (TRX-001+)") rather than continuing this one.

**Reasoning:** The DoD and PR convention belong in the CBR because they're specifically about how implementation work interacts with the register — a new "Definition of Done" document would duplicate the same anti-pattern this whole process has been converging away from. Starting a new thread for TRX-001+ keeps this thread as a clean Phase 1 record, matching the milestone's purpose.

**What it doesn't decide:** TRX-001's actual scope or sequencing — that's the next thread's first real decision.

**Affected Tickets:** all future TRX-001+
**Affected Modules:** Transactions (CBR), process
**Affected ADRs:** ADR-032

---



`2026-08-01`

**Decision:** Froze ADR-032 with two amendments: split Question 3 into 3A (Architectural Invariant, frozen, timeless — UI components are never the canonical owner of ledger mutation rules) and 3B (Implementation Policy, transitional — hard rule for new code, not retroactively enforced, migrated via Change Register items). Strengthened the reopening-clause justification into an explicit precedent statement so future ADR-018-clause invocations are held to the same evidentiary bar (an audit + a register entry + confirmed defects, not "this looks messy"). Adopted new procedural rule: **no TRX-001+ ticket may introduce, duplicate, or relocate a financial business rule unless its canonical owner is already defined by a frozen ADR or existing CBR entry.**

**Reasoning:** The 3A/3B split separates a timeless truth from a transitional migration policy — this matters because it means 3A never needs revisiting even as 3B's transitional state changes over time as rules get migrated. The new procedural rule is the direct enforcement mechanism that makes ADR-032 + the CBR actually prevent future ownership ambiguity, rather than just documenting today's gap once.

**What it doesn't decide:** Which specific TRX-001+ ticket runs first — the CBR and ADR-032's Migration Impact table already point at Settlement and Outstanding Balance as the only rules with an evidenced duplicate-count, but sequencing itself isn't decided here.

**Affected Tickets:** ADR-032, all future TRX-001+/ACC-001+/etc. tickets
**Affected Modules:** Transactions, Accounts, Bills, Settlements, all future modules
**Affected ADRs:** ADR-032 (frozen), ADR-018 (reopening clause, precedent now recorded)

---



`2026-08-01`

**Decision:** Corrected TRX-000C's Ownership Matrix to stop naming not-yet-built services (`TransactionDomainService`, etc.) as "correct owner" — replaced with "TBD — pending ADR-032," keeping the audit's factual/prescriptive boundary intact. Drafted ADR-032 (Settlement & Ledger Mutation Ownership) answering the 4 scoped questions (who owns settlement, who owns outstanding balance, which module may mutate ledger state, canonical lifecycle), with a Migration Impact section mapping current (mostly "None") to future canonical owners. Explicitly invoked ADR-018's reopening-clause pattern to justify writing a new ADR under the stated repo freeze, using TRX-000C's evidence (zero shared code between the two settlement implementations, 4 duplicate rule instances) as the "major architectural flaw" bar.

**Reasoning:** TRX-000C established an unresolved ownership question that blocks `TRX-001+` — implementing against it now would just create a 5th independent settlement implementation. Writing the ADR before any implementation ticket keeps the sequence "decide architecture, then implement it" rather than "implement, then discover we needed to decide."

**What it doesn't decide:** ADR-032 remains Proposed, not Active — needs explicit sign-off. Also doesn't decide code structure/timeline, deliberately scoped to what the evidence actually covers (Settlement + Outstanding Balance only, not a full ledger redesign).

**Affected Tickets:** TRX-000C, BUG-TRX-001, TRX-001 (blocked until this is signed off)
**Affected Modules:** Transactions, Accounts, Bills, Settlements
**Affected ADRs:** ADR-032 (new), ADR-018 (reopening-clause pattern invoked)

---



`2026-08-01`

**Decision:** Renamed "Business Rule Inventory" to "Canonical Business Rules Register (CBR)," restructured around Owner/Canonical/Duplicates/Status. Closed TRX-000C, confirming via full-file search that `applyRepaymentAllocations` and `SettleModal.settle()` share zero code (one call site total for the former, no cross-calls either direction) — settlement has always had two fully independent owners, which is the structural cause of this session's 3 settlement bugs, not a symptom of them. Documented that outstanding-balance and settlement-allocation rules are currently owned by UI components (`AddModal`/`SettleModal`), not any domain service — functionally equivalent to no owner.

**Reasoning:** The rename makes the register state its own objective (drive duplicates to zero) rather than just describe current state. TRX-000C's "owned by nobody" finding directly explains why bugs concentrated exactly where they did, and makes ADR-032 no longer a theoretical preference — it's the fix for a rule that's already caused confirmed production bugs.

**What it doesn't decide:** ADR-032 itself remains open. TRX-001+ can't meaningfully start on settlement until it's resolved.

**Affected Tickets:** TRX-000C, BUG-TRX-001
**Affected Modules:** Transactions, Accounts, Bills, Settlements
**Affected ADRs:** ADR-032 (now has concrete cost evidence behind it, not just architectural preference)

---



`2026-08-01`

**Decision:** Closed TRX-000A (Approved). Before writing BUG-TRX-001, went back and read the actual code at each flagged `setTxns`/`setAccounts` call site rather than trust the original pattern-matched claim — found the original "3 identical setTxns duplicates" claim was wrong (the 3 sites do different things), and the `setAccounts` finding was imprecise (2 duplicate pairs, not 1 triplicated formula). Corrected TRX-000A's own mutation map in place before it was used as evidence elsewhere. The corrected, verified finding — "reduce person's owed amount + recompute settled" duplicated in 4 places — is more specific and more useful than the original claim. Opened BUG-TRX-001 on the corrected evidence, and the Business Rule Inventory (Transactions) as a new artifact type tracking rules (not components) as the real unit of engineering progress. Closed TRX-000B (ItemSheetModal) same session — confirmed Safe/ready for extraction, no caveats, validating ARCH-005's tier prediction.

**Reasoning:** A bug ticket with an inaccurate technical claim is worse than no ticket — it would have sent implementation work at the wrong target. Verifying against the actual code before formalizing a finding is the same discipline already applied to EditPersonModal's LOC and ItemSheetModal's coupling; extending it to catch my own error here rather than let it stand is what keeps the evidence base trustworthy.

**What it doesn't decide:** The canonical implementation for either duplicate rule in BUG-TRX-001 — that's TRX-001+ work, deliberately excluded per TRX-000A's evidence-only rule.

**Affected Tickets:** TRX-000A, TRX-000B, BUG-TRX-001
**Affected Modules:** Transactions, Accounts, Settlements
**Affected ADRs:** ADR-032 (settlement-allocation duplication ties directly to the single-ledger question)

---



`2026-08-01`

**Decision:** Reclassified SEC-001 from Critical to High, reflecting the actual inspected content (dev snapshot data with limited real identifiers, not live financial history) rather than leaving the original presence-of-a-`snapshot`-key-based Critical flag standing. Opened a new artifact, the Repository Risk Register, seeded with RSK-001 (App.jsx monolith), RSK-002 (no tests), RSK-003 (local state explosion), RSK-004 (git history decision pending).

**Reasoning:** Severity should track actual evidence, not the shape of the initial finding — this is the same discipline already applied to EditPersonModal's LOC count (ARCH-002) and ItemSheetModal's coupling (ARCH-005). The Risk Register is justified as a new artifact (not a "framework document" of the kind now avoided) because it captures a genuinely different thing than Technical Debt/Bugs/EDL: risks that are monitored across multiple modules and sprints rather than resolved by one ticket.

**What it doesn't decide:** RSK-004's actual resolution (the history-rewrite call) — still pending the Product Owner.

**Affected Tickets:** SEC-001
**Affected Modules:** Security, Architecture (repo-wide)
**Affected ADRs:** none

---



`2026-08-01`

**Decision:** Inspected the 3 flagged backup files' actual contents (structure only, not exposing raw data in chat). Found they're early April setup/testing snapshots — `txns`/`bills`/`investments`/`loans` empty or near-empty — not the live financial data ARCH-001's flag raised concern about. Still contain real bank names, `last4` account digits, and one real person's name/relation. Removed from working tree, gitignored the pattern going forward. Did not execute git history rewriting — that decision requires knowing who's had repo access, which isn't determinable from the repo itself, so left as an explicit open decision for the repo owner.

**Reasoning:** Severity was real but lower than the original Critical flag implied once actually inspected — worth correcting rather than treating the original heat-map severity as final. Removal was warranted regardless of severity level (partial account metadata + a real name is still PII, even without full transaction history).

**What it doesn't decide:** Whether history gets rewritten. That's still open.

**Affected Tickets:** SEC-001
**Affected Modules:** Security, Repository Hygiene
**Affected ADRs:** none

---



`2026-08-01`

**Decision:** Used AST-derived closure-dependency counts (not line count or hook count alone) to set the extraction tier order, rather than sizing extraction risk by component size as ARCH-001/002 alone would suggest.

**Reasoning:** Measured external-reference counts per component. `ItemSheetModal` — central to this thread's item-save bug — has only 2 external dependencies, confirming it was never the coupled part of that bug; `AddModal` (62 external refs, 18 setters) is. This directly changes the extraction plan: shared primitives and `ItemSheetModal`/`SwipeableTxnRow` are safe near-term wins; `AddModal`, `People`, `Home`, `Settings` (all 60-90 external refs) are not mechanical extractions and need module-audit treatment first.

**What it doesn't decide:** The actual TRX-000 audit content, or whether Settlement becomes a first-class domain object — both flagged as open questions for TRX-000 to resolve, not answered here.

**Affected Tickets:** ARCH-005, TRX-000
**Affected Modules:** Transactions, Accounts, People, Home, Settings, Budgets
**Affected ADRs:** ADR-032 (Settlement-as-domain-object question relates to it)

---



`2026-08-01`

**Decision:** Adopted rule: no repository-wide refactoring (`ARCH-*` work) may occur while a module audit (`XXX-000`) is in progress, unless it addresses a Critical (P0) security, data integrity, or production issue.

**Reasoning:** Prevents `ARCH-*` and `TRX-*`/`ACC-*`/etc. work from stepping on each other — a repo-wide restructure landing mid-audit would invalidate whatever the audit had already mapped. Logged here rather than in a dedicated "Engineering Workflow" document, since that document doesn't exist yet and one sentence doesn't justify creating it.

**What it doesn't decide:** Where this rule permanently lives if/when a real Engineering Workflow doc gets written later — this entry is the rule's authoritative source until then.

**Affected Tickets:** ARCH-002, ARCH-005, SEC-001, TRX-000
**Affected Modules:** Architecture (repo-wide), all future module audits
**Affected ADRs:** none

---



`2026-08-01`

**Decision:** Signed off ARCH-004 as Active (not just Proposed), expanded its exceptions from "bug fixes only" to "bug fixes, logging, telemetry, emergency hotfixes," opened SEC-001 and ARCH-005 as new tickets, and set the module audit sequence to ARCH-002 → ARCH-005 → SEC-001 (parallel) → TRX-000, rather than starting TRX-000 immediately.

**Reasoning:** TRX-000 will be materially stronger informed by a real dependency graph (ARCH-002) and an extraction strategy (ARCH-005) than by discovering those relationships as part of the audit itself. SEC-001 runs in parallel since the sensitive-data finding is independent of architecture sequencing and shouldn't wait on it.

**What it doesn't decide:** The actual extraction order or dependency graph content — those are ARCH-002/005's deliverables, not decided here.

**Affected Tickets:** ARCH-004, ARCH-005, SEC-001, TRX-000
**Affected Modules:** Architecture (repo-wide), Security
**Affected ADRs:** none

---

## Template for future entries

```
## EDL-00X — [short decision title]

`YYYY-MM-DD`

**Decision:** ...

**Reasoning:** ...

**What it doesn't decide:** ...

**Affected Tickets:**
**Affected Modules:**
**Affected ADRs:**
```

---



`2026-08-01`

**Decision:** Patched three related bugs (bill status not recomputing on individual settlement; two independent settlement implementations drifting apart; bill settlements not mirroring onto linked source transactions) directly inside `App.jsx`, in place, rather than deferring the fix until the relevant logic is extracted into `src/domain/`.

**Reasoning:** These were live, user-facing bugs blocking actual use of the settlement feature — not something to hold for an extraction that hadn't been scoped yet. This is consistent with ARCH-004's rule: bug fixes are allowed directly in `App.jsx`; only new feature work is required to go through extraction.

**What it doesn't decide:** Whether `applyRepaymentAllocations` and `SettleModal.settle()` should eventually be merged into one implementation (the single-ledger direction discussed for ADR-032/2.0), or kept separate but synchronized. That's a real open architecture question, not resolved by patching both to behave consistently today.

**Affected Tickets:** ARCH-004
**Affected Modules:** Transactions, Bills, Settlements
**Affected ADRs:** ADR-032 (proposed)

---

## EDL-002 — Ran ARCH-001 ahead of the originally-proposed ENG-001 restructure

`2026-08-01`

**Decision:** Built the repository inventory (ARCH-001) instead of proceeding with the originally-drafted "move files into folders" ticket.

**Reasoning:** Static analysis of the repo showed 90%+ of the application lives in one file with no meaningful existing module boundaries — a "move files" ticket would have either accomplished almost nothing (most of the app has no separate files to move) or encouraged an unplanned, untested decomposition of a 16,349-line file with zero test coverage. Inventory-first was the safer sequencing.

**What it doesn't decide:** The eventual target folder shape (`src/features/*` vs. `src/domain/*` vs. something else) — that's ARCH-003's job, informed by ARCH-002's dependency graph, not assumed here.

**Affected Tickets:** ARCH-001, ARCH-002
**Affected Modules:** Architecture (repo-wide)
**Affected ADRs:** none

---

## EDL-001 — Governance docs from a prior session were never persisted to the repo

`2026-08-01`

**Decision:** Treated the ADR-030–035 numbering and Blueprint/AUD/RFC doc set from the original handover document as orphaned — not the canonical governance history — once the actual repo was uploaded and showed a completely different, real ADR history (ADR-001 through ADR-023, frozen at v2.0).

**Reasoning:** The repo is the source of truth; a prior chat session's sandbox output that was never downloaded or committed doesn't count as "existing," however detailed. Renumbered the local-first/durable-data proposal from the orphaned "ADR-036" to the correct next real number, ADR-032, and framed it against the actual frozen decision it interacts with (ADR-018's delete-permanence clause), not against decisions that don't exist in the real timeline.

**What it doesn't decide:** Whether the orphaned doc set (P-001–P-010, Blueprints, etc.) has any content worth recovering and manually re-adding to the real repo. That content may still exist in that old chat session and hasn't been reviewed.

**Affected Tickets:** none
**Affected Modules:** Architecture (governance)
**Affected ADRs:** ADR-018, ADR-032
