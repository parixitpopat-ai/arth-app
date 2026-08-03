// TRX-002B — Money value object.
// Per Team 1's frozen model (transaction-aggregate.md): introduced to centralize
// non-negative/rounding invariants in one place, replacing the scattered
// `Number(x||0)` / `Math.max(0,...)` defensive coercion found at every audited
// mutation site — the exact "duplicated instead of shared" pattern that caused
// BUG-TRX-001, just for numeric safety instead of business logic.

export class MoneyValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "MoneyValidationError";
  }
}

export class Money {
  constructor(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) {
      throw new MoneyValidationError(`Money amount must be a finite number, got: ${amount}`);
    }
    if (n < 0) {
      throw new MoneyValidationError(`Money amount cannot be negative: ${n}`);
    }
    // 2-decimal rounding — matches real currency precision, avoids float drift
    // accumulating across repeated add/subtract calls.
    this.amount = Math.round(n * 100) / 100;
    Object.freeze(this);
  }

  static of(amount) {
    return amount instanceof Money ? amount : new Money(amount);
  }

  static zero() {
    return new Money(0);
  }

  add(other) {
    return new Money(this.amount + Money.of(other).amount);
  }

  // Plain subtraction — throws if the result would be negative, same as the
  // constructor. Use subtractClamped() where the domain expects a floor at zero
  // (e.g. remaining balance after a payment that could exceed what's owed).
  subtract(other) {
    return new Money(this.amount - Money.of(other).amount);
  }

  subtractClamped(other) {
    return new Money(Math.max(0, this.amount - Money.of(other).amount));
  }

  isZero() {
    return this.amount === 0;
  }

  isGreaterThan(other) {
    return this.amount > Money.of(other).amount;
  }

  equals(other) {
    return this.amount === Money.of(other).amount;
  }

  toJSON() {
    return this.amount;
  }
}
