# ADR-032 — Settlement & Ledger Mutation Ownership

`Proposed 2026-08-01` · **Status: ✅ Approved (Frozen)** — signed off 2026-08-01

**Reason for approval:** TRX-000C demonstrated an architectural ownership gap, not merely an implementation issue. The audit established that settlement and outstanding-balance mutation are duplicated across independent UI implementations with no canonical owner. That satisfies the reopening criterion established by ADR-018 and justifies a new architectural decision.

**Invokes ADR-018's reopening clause.** ADR-018 Decision 2 (permanent delete, no soft-delete) explicitly named its own trigger for revisiting: *"if Sync/Cloud-Backup/Collaboration ever make undo-ability matter."* This ADR isn't reopening that specific decision, but it establishes the same justification pattern for touching the repo under its stated freeze (`Status: FROZEN, as of ADR-021 — no new ADRs unless a major architectural flaw is discovered`).

**Precedent statement, recorded explicitly since this is the freeze's first invocation:** This ADR was approved because repository evidence (TRX-000C and the Canonical Business Rules Register) demonstrated duplicated ownership of core financial business rules with no canonical owner, resulting in multiple confirmed production defects. **This establishes that the architectural freeze may be reconsidered only when objective repository evidence demonstrates a systemic ownership gap that materially affects correctness or maintainability** — not on the basis of a general sense that something looks messy. Future ADRs invoking this clause should be held to the same evidentiary bar: an audit (`XXX-000`), a register entry (CBR or equivalent), and confirmed production defects or an equivalent measurable harm — not stylistic disagreement.

**Evidence this ADR is answering to** (not repeated in full — see TRX-000C and the Canonical Business Rules Register):
- `applyRepaymentAllocations` and `SettleModal.settle()` share zero code; one call site total for the former in the entire file
- 4 independent implementations of "reduce person's owed amount + recompute settled"
- 2 duplicate pairs implementing outstanding-balance mutation
- CBR baseline: 2 canonical rules, 4 duplicate rules, as of 2026-08-01

---

## Question 1 — Who owns settlement?

**Decision:** Settlement allocation and its consequences (reducing owed amounts, recomputing settled status, mirroring to linked bills) become the responsibility of a single domain owner: the **Transactions domain.** Not because settlement is conceptually "a transaction," but because every settlement in this app either originates as a transaction (the Settlement-tab repayment flow) or targets one (bills' `paidByTxnId` link already makes transactions the source of truth over bills, confirmed in this session's bug fixes). Bills and Accounts consume settlement outcomes; they don't own the rule.

## Question 2 — Who owns outstanding balance mutation?

**Decision:** Outstanding balance mutation becomes the responsibility of the **Accounts domain.** Currently it's an inline side-effect of whatever transaction happens to touch a CC account (`AddModal`, 4 sites). Under this decision, a transaction that affects an account's outstanding balance *requests* that change from Accounts; it does not compute or apply the change itself.

## Question 3 — Which module is allowed to mutate ledger state?

### 3A. Architectural Invariant (Frozen)

**Only the canonical domain owner may own the business rules that mutate ledger state. UI components are never the canonical owner of ledger mutation rules.**

This is timeless — it remains true regardless of whether the canonical implementation currently exists. It does not, by itself, require any code to change today.

### 3B. Implementation Policy (Transitional)

**Until the canonical domain services are implemented, existing UI mutations may remain in place for backward compatibility.** However:
- **No new business-rule mutations may be introduced directly into UI components.** All new mutation logic must follow the ownership model defined by this ADR.
- **Existing duplicated mutations shall be removed incrementally through approved Change Register items** — not a big-bang rewrite, not left indefinitely either.

This is the specific, enforceable rule that prevents duplicate implementation #5: a component that needs to change ledger state calls a named domain function going forward; it does not `setTxns(prev=>prev.map(...))` inline in new code. It is a hard rule for new code and is **not** retroactively enforced against existing code by this ADR alone — that migration happens through tracked Change Register items, giving 3A something to converge toward without forcing an immediate rewrite.

## Question 4 — What is the canonical lifecycle?

**Decision:**

```
Transaction recorded
        ↓
Settlement calculated (if applicable)
        ↓
Account balances updated
        ↓
Bill state updated
        ↓
Derived projections refreshed (Home/Outlook/Insights aggregates)
```

Each arrow is a domain boundary. A step may only be triggered by the step before it completing — never invoked directly by a UI component skipping ahead (e.g., a component should not update Bill state directly without Settlement having calculated what changed and Account balances having been updated first, even if today's code sometimes does exactly that).

---

## Migration Impact

Ownership only — no implementation steps, no code changes proposed by this ADR itself:

| Existing rule | Current owner | Future canonical owner |
|---|---|---|
| Settlement allocation | None (duplicated: `AddModal`, `SettleModal` — 4 locations) | Transactions domain |
| Reduce person's owed amount + recompute settled | None (same 4 locations) | Transactions domain |
| Outstanding balance — CC charge/payment | None (duplicated inline in `AddModal` — 4 sites, 2 rule-pairs) | Accounts domain |
| Bill status recomputation | Bills (canonical, but component-scope) | Bills domain (unchanged owner, formalized location) |
| Bill-to-transaction settlement mirroring | Bills/Transactions (canonical, but component-scope) | Transactions domain (settlement is the trigger; bill state is the consequence) |

## What this ADR does not decide

- The actual code structure (file names, whether "domain function" means a plain module export, a class, or something else) — implementation detail for `TRX-001+`
- Timeline or sequencing of which rule gets migrated first (though the CBR and TRX-000A/C evidence make Settlement and Outstanding Balance the obvious starting pair, being the only rules already proven duplicated)
- Anything about Accounts, People, or Loans domains beyond the two rules explicitly addressed above — this ADR is scoped to what TRX-000A/C's evidence actually covered, not a full ledger redesign

## Sign-off

**Approved and Frozen 2026-08-01.** Amendments 1 (3A/3B split) and 2 (strengthened precedent statement) incorporated per review before freezing.
