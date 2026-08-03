// TRX-002B — LineItem.
// Local entity per Team 1's model: has its own id (editable in place, matching the
// existing `editingItemId` pattern confirmed in TRX-000B), but no identity or
// meaning outside its parent Transaction.
//
// Deliberately does NOT enforce sum(lineItems) == transaction.amount — Team 1's
// Invariant Table left this explicitly Open, pending evidence this audit never
// gathered. Enforcing it here would be inventing a rule the audit didn't support.

import { Money } from "./Money.js";

export class LineItemValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "LineItemValidationError";
  }
}

export class LineItem {
  constructor({ id, label, qty, unit = null, unitPrice, catId = null, subId = null }) {
    if (!id) throw new LineItemValidationError("LineItem requires an id");
    if (!label || !label.trim()) throw new LineItemValidationError("LineItem label cannot be empty");
    const q = Number(qty);
    if (!Number.isFinite(q) || q <= 0) {
      throw new LineItemValidationError(`LineItem qty must be a positive number, got: ${qty}`);
    }
    this.id = id;
    this.label = label.trim();
    this.qty = q;
    this.unit = unit;
    this.unitPrice = Money.of(unitPrice);
    this.catId = catId;
    this.subId = subId;
    Object.freeze(this);
  }

  get amount() {
    return Money.of(this.unitPrice.amount * this.qty);
  }
}
