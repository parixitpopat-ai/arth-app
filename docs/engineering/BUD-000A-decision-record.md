# BUD-000A — Decision Record

**Status:** Decided
**Decided by:** Product/Architecture owner (PP Sir)
**Context:** Resolves the three questions raised in `BUD-000A-architectural-tensions-adr-impact-review.md`. This record is the output of the Architecture Decision Review that document called for — BUD-000 itself remains paused; these decisions unblock the next stage (ADR-035, ADR-036, BUD-001) rather than resuming BUD-000's own phase sequence.

---

## Decisions

### Q1 — What does "Allocation" mean in Arth?

**Decision: Hybrid.** "Allocation" names two distinct concepts that BUD-000's audit had merged under one word:

- **Financial Allocation (Planning)** — the money plan. Hierarchical and reconciling: Annual Budget → Category → Monthly value, where the parts sum to the whole and money cannot be allocated twice. Belongs to the Budget domain.
- **Analytical Allocation (Attribution)** — how spend is classified after the fact. Independent, non-reconciling dimensions (Category, Person, Trip, Goal, Project, Liability, Account) — one transaction can attribute fully to several dimensions at once, with no requirement that they sum to anything.

These are not two implementations of one idea; they are two different ideas that happen to share a name. Documents and code going forward should use distinct terms (e.g. **Budget Allocation** vs. **Allocation** or **Attribution**) rather than "Allocation" unqualified.

### Q2 — Who owns Allocation?

**Decision: Shared Platform Capability.** Neither Budget nor Transactions. Transactions produce facts; the Allocation capability maps those facts onto dimensions; Budget, Reports, Goals, AI, and Forecasting all consume it as independent clients. Architecturally parallel to Ledger's existing role.

### Q3 — Who owns the Fiscal Calendar?

**Decision: Shared Platform Capability.** Not Budget. Multiple current and future modules (Budget, Goals, Investments, Reports, Tax, Forecasting, recurring payments) all need period/quarter/FY normalization; owning it inside Budget would mean duplicating it elsewhere later, the same failure pattern the repository audit already found six times over for the monthly-budget formula.

---

## Follow-on artifacts authorized by this decision

| Item | Number | Scope |
|---|---|---|
| Allocation Engine ADR | **ADR-035** | Planning allocations, analytical allocations, dimension model, ownership, APIs, consumers |
| Financial Calendar ADR | **ADR-036** | FY, month, quarter, custom periods, credit card cycles, reporting periods, time normalization |

**Numbering correction applied:** originally proposed as ADR-031/ADR-032 in discussion; both numbers are already frozen in the canonical `ARCHITECTURE_DECISIONS.md` (ADR-031 = Record Transaction Flow, ADR-032 = Settlement & Ledger Mutation Ownership, file frozen through ADR-034). Renumbered to the next available slots, ADR-035 and ADR-036, before any drafting begins.

---

## Revised roadmap

```
BUD-000A (architectural review — concluded by this record)
    ↓
ARCH-001 Architecture Decision Review   (temporary — closes once ADR-035/036 approved)
    ↓
ADR-035 Allocation Engine
    ↓
ADR-036 Financial Calendar
    ↓
BUD-001 Budget Modernization Plan
    ↓
BUD-001A Budget Architecture Approval
    ↓
Implementation

────────────────────────────────────────────
Later: TRIP-000, GOAL-000, REPORT-000, INVEST-000
────────────────────────────────────────────
Finally: ARTH-001 — Core Domain Architecture (canonical handbook, unchanged scope)
```

---

## Resolved item — ARCH-001 vs. ARTH-001

**`ARTH-001` stays untouched, exactly as originally scoped** — a permanent, canonical architecture handbook (Domain Map, Bounded Contexts, Platform Capabilities, Engine Architecture, ADR Dependency Graph, Canonical Vocabulary, Cross-domain Rules, Integration Principles), still deliberately deferred until after multiple modernization cycles complete.

**A new ticket, `ARCH-001` — Architecture Decision Review, is created instead** for this specific review step. It is temporary and narrowly scoped: it exists solely to validate and freeze the three platform decisions in this record (Hybrid Allocation, Allocation as shared platform capability, Financial Calendar as shared platform capability) and authorize ADR-035/036 drafting. ARCH-001 closes once those two ADRs are approved — it does not become a standing document the way ARTH-001 will.

---

## Governance precedent (recorded per this session's discussion)

> A module audit is permitted to identify architectural ambiguity but is not permitted to resolve or override frozen ADRs. Architectural ambiguities discovered during module audits must be escalated through an ADR Impact Review before any ADR amendment or implementation planning proceeds.

Applies going forward to all modernization streams (TRX, ACC, HOME, BUD, and future GOAL/INV work), not just this one.

---

## Status of BUD-000

Unchanged by this record. Remains frozen at:
✅ Repository Audit · ✅ Component Audit · ✅ Mutation Census · ✅ Business Rule Extraction · ✅ Domain Reconciliation · ✅ Aggregate Identification · ✅ ADR Review · ✅ BUD-000A Architectural Impact Review — **now resolved by this record**.

BUD-000 does not resume until ADR-035 and ADR-036 exist and BUD-001 (Modernization Plan) is scoped against them.
