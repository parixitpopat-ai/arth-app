// ACC-002 WP-01 — Account aggregate scaffolding.
// Implements the model frozen in ACC-001-account-aggregate-definition.md,
// as amended 2026-08-04 per ADR-035 (Behavior vs. Classification).
//
// This module is additive only: nothing in src/App.jsx calls it yet
// (that's WP-02). Introducing it here with zero call sites is deliberate,
// mirroring how Transaction.js/AggregateRoot.js were scaffolded before
// TRX-002B wired anything to them.
//
// ADR-035 correction (post-initial-scaffolding): the original version of
// this file used `type` as a closed 5-value enum and treated
// accountTypeId/typeLabel/typeIcon/typeBucket as passthrough display
// metadata. Tracing normalizeAccountTypes (App.jsx L134-165) while wiring
// WP-02 showed `type` is NOT closed — users can define custom account
// "behaviors" (Crypto, BNPL, etc.) with no system-meaningful mapping. Per
// ADR-035, this file now separates:
//   - `behavior`: the closed, system-owned enum every downstream
//     calculation (accountBalance, getCardSummary, ledgerRows) actually
//     switches on. This IS the real invariant.
//   - `classificationId`/`classificationLabel`/`icon`/`bucket`: open,
//     user-configurable, no invariant weight — analogous to Categories.
//     Every classification must declare exactly one canonical `behavior`
//     (enforced where classifications are registered — a future
//     AccountTypeRegistry, not yet built — not by Account itself, since
//     Account only ever receives an already-resolved `behavior` value).

import { AggregateRoot } from "../contracts/AggregateRoot.js";

export class AccountValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AccountValidationError";
  }
}

// Frozen per ADR-035 — the closed, system-owned behavior enum. Values kept
// as the existing lowercase strings already used throughout App.jsx's
// stored account data ("bank"/"cash"/"cc"/"debit"/"upi"), not renamed to
// anything else — renaming the *field* (type -> behavior) is an in-memory
// domain-modeling concern for this aggregate; renaming the *values* would
// be a data migration this ADR does not authorize or need.
export const VALID_ACCOUNT_BEHAVIORS = ["bank", "cash", "cc", "debit", "upi"];

export class Account extends AggregateRoot {
  constructor({
    id, behavior, name, color = null,
    last4 = null,
    // Classification/presentation (ADR-035) — open, user-configurable, no
    // invariant weight. Renamed from accountTypeId/typeLabel/typeIcon/
    // typeBucket per the amendment; same underlying data
    // (AddAccountModal L6284-6287), reframed as configuration, not identity.
    classificationId = null, classificationLabel = null, icon = null, bucket = null,
    // bank/cash-specific (ACC-001 §2, AddAccountModal L6293)
    openingBalance = 0, openingBalanceDate = null, needsCalibration = false,
    // cc-specific (AddAccountModal L6294)
    limit = 0, outstanding = 0, statementDate = 15, dueDate = 5, alertPct = 30, billingCycle = null,
    // debit-specific (AddAccountModal L6295) — REQUIRED invariant, see below
    linkedBank = null,
    // upi-specific (AddAccountModal L6296)
    handle = null, linkedAccount = null,
    // cross-aggregate attribution (ACC-001 §2 — held, not validated; Person/Group
    // existence-checking is the orchestrator's job per ADR-033, not Account's)
    attributedTo = null, attributeType = null,
    // Wealth-dashboard opt-out (EditAccountModal L12362, read at App.jsx
    // L1958's liquidAssetsTotal calc). Settable only via update() today —
    // no creation-time field for it in AddAccountModal — kept true to that
    // asymmetry rather than "fixing" it silently; that's a product decision,
    // not WP-01/02's to make.
    excludeFromWealth = false,
    // lifecycle state (ACC-001 §2 — new, not evidence-recovered; mirrors the
    // existing Insurance-policy `status:"archived"` pattern, App.jsx L12312)
    status = "active",
  }) {
    super(id);

    // Invariant (ACC-001 §2): name is required.
    if (!name || !name.trim()) {
      throw new AccountValidationError("Account requires a name");
    }
    // Invariant (ACC-001 §2, amended per ADR-035): behavior must be one of
    // the 5 closed, system-owned values. Classification (above) is where
    // the open/custom concept lives now — this check is intentionally
    // strict, with no fallback default, per ADR-035's rejection of silently
    // defaulting unmapped custom types to "bank".
    if (!VALID_ACCOUNT_BEHAVIORS.includes(behavior)) {
      throw new AccountValidationError(
        `Invalid account behavior "${behavior}" — must be one of: ${VALID_ACCOUNT_BEHAVIORS.join(", ")}`
      );
    }
    // Invariant (ACC-001 §2): a debit-behavior account requires a linked bank.
    // This check exists in AddAccountModal (L6280) today but is CONFIRMED
    // MISSING from EditAccountModal (ACC-000 §2/§6) — encoding it once, here,
    // is what closes that gap for good once WP-02 wires both flows through it.
    if (behavior === "debit" && !linkedBank) {
      throw new AccountValidationError("Debit account requires a linked bank");
    }
    if (status !== "active" && status !== "archived") {
      throw new AccountValidationError(`Invalid status "${status}" — must be "active" or "archived"`);
    }

    this.id = id;
    this.behavior = behavior;
    this.name = name.trim();
    this.color = color;
    this.last4 = last4;
    this.classificationId = classificationId;
    this.classificationLabel = classificationLabel;
    this.icon = icon;
    this.bucket = bucket;
    this.openingBalance = openingBalance;
    this.openingBalanceDate = openingBalanceDate;
    this.needsCalibration = needsCalibration;
    this.limit = limit;
    // NOTE: `outstanding` is retained on the constructor for shape-compatibility
    // with existing stored data during migration, but per AQ-001 it is a
    // CONFIRMED DEAD FIELD — nothing reads it; canonical outstanding is
    // domain/cards/summaries.js's getCardSummary().totalOutstanding. Not
    // removed here (that's WP-10, gated on CR-005's cache-vs-retire decision),
    // just flagged so nobody mistakes its presence for it mattering.
    this.outstanding = outstanding;
    this.statementDate = statementDate;
    this.dueDate = dueDate;
    this.alertPct = alertPct;
    this.billingCycle = billingCycle;
    this.linkedBank = linkedBank;
    this.handle = handle;
    this.linkedAccount = linkedAccount;
    this.attributedTo = attributedTo;
    this.attributeType = attributedTo ? attributeType : null;
    this.excludeFromWealth = excludeFromWealth;
    this.status = status;

    this._deleted = false;
  }

  // --- Behavior: create() ---
  static create(params) {
    const acc = new Account(params);
    acc._raise({
      type: "AccountCreated",
      accountId: acc.id,
      behavior: acc.behavior,
      occurredAt: new Date().toISOString(),
    });
    return acc;
  }

  // --- Behavior: update() ---
  // Re-validates on every field that changes — this is the single validation
  // path that closes the create/update invariant-duplication finding
  // (ACC-000 §2/§6, ACR-001): both AddAccountModal and EditAccountModal will
  // route through this one method once WP-02 wires them up, instead of each
  // re-implementing the same rules in different shapes.
  update(changes = {}) {
    if (this._deleted) {
      throw new AccountValidationError("Cannot update a deleted account");
    }
    if (changes.name !== undefined && (!changes.name || !changes.name.trim())) {
      throw new AccountValidationError("Account requires a name");
    }
    if (changes.behavior !== undefined && !VALID_ACCOUNT_BEHAVIORS.includes(changes.behavior)) {
      throw new AccountValidationError(
        `Invalid account behavior "${changes.behavior}" — must be one of: ${VALID_ACCOUNT_BEHAVIORS.join(", ")}`
      );
    }
    // Guards the debit->linkedBank invariant against an update that would
    // violate it — either by clearing linkedBank on an existing debit
    // account, or (defensively) an update that also tries to change behavior.
    const effectiveBehavior = changes.behavior !== undefined ? changes.behavior : this.behavior;
    const effectiveLinkedBank = changes.linkedBank !== undefined ? changes.linkedBank : this.linkedBank;
    if (effectiveBehavior === "debit" && !effectiveLinkedBank) {
      throw new AccountValidationError("Debit account requires a linked bank");
    }

    const applied = { ...changes };
    if (applied.name !== undefined) applied.name = applied.name.trim();
    Object.assign(this, applied);

    this._raise({
      type: "AccountUpdated",
      accountId: this.id,
      changes,
      occurredAt: new Date().toISOString(),
    });
  }

  // --- Behavior: archive() / unarchive() ---
  // Per ACC-001 §4: the everyday "I don't use this anymore" action. Does NOT
  // touch any Transaction reference — historical data is untouched by design.
  archive() {
    if (this._deleted) {
      throw new AccountValidationError("Cannot archive a deleted account");
    }
    if (this.status === "archived") {
      throw new AccountValidationError("Account is already archived");
    }
    this.status = "archived";
    this._raise({ type: "AccountArchived", accountId: this.id, occurredAt: new Date().toISOString() });
  }

  unarchive() {
    if (this._deleted) {
      throw new AccountValidationError("Cannot unarchive a deleted account");
    }
    if (this.status === "active") {
      throw new AccountValidationError("Account is already active");
    }
    this.status = "active";
    this._raise({ type: "AccountUnarchived", accountId: this.id, occurredAt: new Date().toISOString() });
  }

  // --- Behavior: markDeleted() ---
  // Per ACC-001 §4's frozen invariant: an Account may not be deleted while
  // referenced by financial events. This method assumes the orchestrator
  // (AccountDeletionService, WP-06 — not yet implemented) has already
  // resolved every reference before calling it. Account itself does not and
  // cannot verify reference-freedom; that requires querying Transaction, a
  // different aggregate — the orchestrator's job per ADR-033, not Account's.
  markDeleted() {
    if (this._deleted) {
      throw new AccountValidationError("Account is already deleted");
    }
    this._deleted = true;
    this._raise({ type: "AccountDeleted", accountId: this.id, occurredAt: new Date().toISOString() });
  }
}
