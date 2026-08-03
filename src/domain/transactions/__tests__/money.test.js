import test from "node:test";
import assert from "node:assert/strict";
import { Money } from "../Money.js";

test("Money: rejects negative amounts", () => {
  assert.throws(() => Money.of(-5), /cannot be negative/);
});

test("Money: rejects non-finite amounts", () => {
  assert.throws(() => Money.of(NaN), /finite number/);
  assert.throws(() => Money.of(Infinity), /finite number/);
});

test("Money: rounds to 2 decimal places", () => {
  assert.equal(Money.of(10.005).amount, 10.01);
  assert.equal(Money.of(10.004).amount, 10.0);
});

test("Money: add/subtract arithmetic", () => {
  assert.equal(Money.of(10).add(Money.of(5)).amount, 15);
  assert.equal(Money.of(10).subtract(Money.of(3)).amount, 7);
});

test("Money: subtract throws if result would be negative", () => {
  assert.throws(() => Money.of(5).subtract(Money.of(10)), /cannot be negative/);
});

test("Money: subtractClamped floors at zero instead of throwing", () => {
  assert.equal(Money.of(5).subtractClamped(Money.of(10)).amount, 0);
});

test("Money: isZero, isGreaterThan, equals", () => {
  assert.equal(Money.zero().isZero(), true);
  assert.equal(Money.of(10).isGreaterThan(Money.of(5)), true);
  assert.equal(Money.of(10).equals(Money.of(10)), true);
});
