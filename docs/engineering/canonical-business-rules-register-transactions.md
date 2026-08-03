# Canonical Business Rules Register (CBR) — Transactions

`Opened 2026-08-01` · Renamed from "Business Rule Inventory" — the register's job is to state the engineering objective (one canonical implementation per rule), not just list rules.

| Rule | Owner (domain) | Canonical? | Duplicates | Status |
|---|---|---|---|---|
| Settlement allocation (bill/group/plain-txn kinds) | Transactions *(per ADR-032, frozen)* | ❌ | 4 | **Duplicate** — see BUG-TRX-001, TRX-000C, ADR-032 |
| Reduce person's owed/remaining amount + recompute settled | Transactions *(per ADR-032, frozen)* | ❌ | 4 (same 4 as above — same underlying rule) | **Duplicate** — see ADR-032 |
| Outstanding balance — increment on CC charge | Accounts *(per ADR-032, frozen)* | ❌ | 2 | **Duplicate** — see BUG-TRX-001, ADR-032 |
| Outstanding balance — decrement on CC payment/refund | Accounts *(per ADR-032, frozen)* | ❌ | 2 | **Duplicate** — see BUG-TRX-001, ADR-032 |
| Bill status recomputation on settlement | Bills *(per ADR-032, frozen)* | ✔ | 0 | **Canonical** — fixed this session (was previously missing) |
| Bill settlement mirrors to linked source transaction | Bills/Transactions *(per ADR-032, frozen)* | ✔ | 0 | **Canonical** — added this session |
| Investment record create/update | Investments | ✔ | 0 | **Canonical** — audited TRX-001A, no duplication found |
| Investment record removal on type change | Investments | ✔ | 0 | **Canonical** — audited TRX-001A, no duplication found |
| Loan creation — generic | Loans | ✔ | 0 | **Canonical** — audited TRX-001A; related to next row, not confirmed distinct |
| Loan creation — CC-EMI-linked | Loans | ✔ | 0 | **Canonical** — audited TRX-001A; related to previous row, not confirmed distinct |
| Loan outstanding reduction — manual settlement | Loans | ✔ | 0 | **Canonical**, but conceptually overlaps with Settlement Allocation (above) — see TRX-001A note; candidate for unification when the canonical settlement service is designed |
| Loan outstanding reduction — CC-EMI auto-tracking | Loans | ✔ | 0 | **Canonical** — audited TRX-001A, standalone rule |

## Progress KPI

| Checkpoint | Canonical | Duplicate |
|---|---|---|
| **2026-08-01 (baseline)** | **2** | **4** |
| **2026-08-03 (TRX-001 reconciliation)** | **2** | **4** — unchanged; see TRX-001 CBR Reconciliation Report for why |
| **2026-08-03 (TRX-001A audit closure)** | **8** | **4** — 6 pre-existing rules identified, audited, and formally admitted to the register; no new duplication found |

Target direction: canonical count up, duplicate count down, tracked at every module audit and release review — not "components extracted."

## TRX-001 Baseline (final)

| Category | Count | Status |
|---|---|---|
| Canonical Rules | 8 | Complete |
| Duplicate Rules | 4 | Registered |
| Unaudited Rules | 0 | Closed |
| Change Register | Operational | ADR-032 §3B satisfied |

**Note on the 2→8 move:** the underlying business logic for those 6 rules already existed in the code before TRX-001A — nothing new was written. What moved was governance catching up to reality: the rules were identified, audited directly against the code, and formally admitted into the CBR. Worth keeping this distinction precise in every future audit, since "canonical count went up" should never be conflated with "new capability was built."

## Audit gaps

**Closed** — `setLoans` and `setInvestments` audited in TRX-001A (2026-08-03), direct code read, no assumptions. Results folded into the table above.

---

## Definition of Done for every TRX-001+ ticket

A ticket is not complete simply because the code works. It is complete only if all of the following are true:

- ✅ Acceptance criteria pass
- ✅ ADR-032 remains satisfied
- ✅ This register (CBR) is updated
- ✅ The ticket either reduces the duplicate count, increases the canonical count, or explicitly records why neither changed
- ✅ No new duplicate business rule is introduced — a ticket that fixes one bug by creating a second independent implementation of a rule is incomplete, not done
- ✅ Any duplicate migration has a corresponding entry in the [Change Register](./CHANGE-REGISTER-transactions.md), moved to `Complete`

## Standing review question for every PR

**"What happened to the CBR?"** Every PR states its impact explicitly:

| PR | CBR Impact |
|---|---|
| *(example)* TRX-001 | Outstanding Balance Mutation: Duplicate → Canonical |
| *(example)* TRX-002 | Settlement Allocation: 4 duplicates → 2 duplicates |
| *(example)* TRX-003 | No CBR impact (UI-only extraction) |

Real entries get logged here as tickets close, replacing the examples above.
