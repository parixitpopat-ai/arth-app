# AQ-002 — Reconcile `people`/`splitPeople` with ADR-030

`2026-08-03` · Status: **Resolved** · Final architectural checkpoint before TRX-002B

---

## 1. Audit of the current model

Direct code counts, `src/App.jsx`:
- `.people` referenced 125 times
- `.splitPeople` referenced 80 times
- `.forPerson` referenced 22 times

**Every single read site that looks up a person's share uses the identical fallback pattern**, 14 confirmed occurrences, no exceptions found:
```js
const info = t.people?.[pid] || t.splitPeople?.[pid];
```

**Every one of the 13 write sites for `splitPeople:` is constructing or updating a Bill object** — confirmed by checking surrounding fields at each site (`dueDate`, `recurring`, `frequency`, `status:"paid"`, `createdDate`, all Bill-only fields), then passed to `setBills(...)`. Not one write site sets `splitPeople` on a Transaction object.

**Every Transaction that's created *from* a bill payment copies the Bill's `splitPeople` into its own `people` field**, confirmed at both call sites:
```js
setTxns(p=>[{ ..., people:b.splitPeople||{}, ... }, ...p]);
```

**`forPerson` is structurally distinct from both** — a single ID (not a map), always checked alongside `tagMode==="person"`, used for lightweight single-person tagging with no split math, never merged into the `people`/`splitPeople` maps.

## 2. Comparison against ADR-030

ADR-030 states: *"`people`, `splitPeople`, `forPerson` — three distinct real fields, not one... this ADR does not attempt to unify them, flagging as a real naming/purpose overlap."*

**That's accurate on `forPerson`** — confirmed genuinely distinct in both purpose and shape.

**It's imprecise on `people`/`splitPeople`.** ADR-030 describes them as if both could exist ambiguously on the same object. The actual code shows something cleaner: **`people` belongs to Transaction. `splitPeople` belongs to Bill. They are the same underlying concept — a per-person share attribution map (amount/mode/settledAmt/remainingAmt/settled) — expressed under different names on two different entities, not two competing fields on one entity.** The universal read-fallback exists because several helper functions are generic across both Transactions and Bills (unsurprising, given this session's whole settlement-mirroring work already established Transactions and Bills both carry person-share state).

## 3. Answering the three questions

**Is the current model consistent with ADR-030?** Mostly yes. `forPerson` matches exactly. `people`/`splitPeople` match in spirit (three distinct concepts, not unified) but ADR-030's own description slightly mischaracterizes *where* the ambiguity sits — not on one object, but across two different entities using different names for the same concept.

**Architectural or implementation?** Neither is actually broken — this is a **documentation precision gap**, not code drift and not a design flaw. No code needs to change.

**Does TRX-002B need a design change, or just conforming implementation?** One addendum to Team 1's frozen model, not a redesign: **`PersonShare` is a value object shared by both the `Transaction` and `Bill` aggregates**, not exclusively Transaction's own. Team 1's original model only discussed `PersonShare` in Transaction's context; this audit confirms Bill needs the identical shape for its own `splitPeople` field. Same value object, two aggregate owners — consistent with everything already frozen (ADR-024/032's Question 2 already treats Bill as consuming settlement outcomes, this just confirms the shared data shape underneath).

---

## Outcome

**Outcome A, with one precision correction — no Change Register entry needed, no code changes required.**

- ADR-030 gets a short addendum (not a reopen): clarify that the `people`/`splitPeople` "overlap" is cross-entity naming (Transaction vs. Bill), not same-entity ambiguity.
- Team 1's `transaction-aggregate.md` gets one addendum: note `PersonShare` is shared with the `Bill` aggregate, not Transaction-exclusive.
- TRX-002B proceeds as designed. No mismatch to resolve before implementation starts.

---

## Architecture Phase Complete

Per the agreed checkpoint: this closes the last open architectural dependency. From here, the project's default posture changes:

- No further architectural discovery unless implementation surfaces contradictory evidence
- Every review checks conformance against ADR-024/025/026/030 (renumbered: 032/033/034/030) and the Change Register
- The burden of proof shifts: reopening any frozen decision requires demonstrating a real conflict, not stating a preference
