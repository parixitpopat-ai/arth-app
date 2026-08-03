import test from "node:test";
import assert from "node:assert/strict";
import { LineItem, LineItemValidationError } from "../LineItem.js";

test("LineItem: computes amount as qty * unitPrice", () => {
  const item = new LineItem({ id: "li1", label: "Milk", qty: 2, unitPrice: 50 });
  assert.equal(item.amount.amount, 100);
});

test("LineItem: rejects empty label", () => {
  assert.throws(
    () => new LineItem({ id: "li1", label: "   ", qty: 1, unitPrice: 50 }),
    LineItemValidationError
  );
});

test("LineItem: rejects zero or negative qty", () => {
  assert.throws(() => new LineItem({ id: "li1", label: "Milk", qty: 0, unitPrice: 50 }), LineItemValidationError);
  assert.throws(() => new LineItem({ id: "li1", label: "Milk", qty: -1, unitPrice: 50 }), LineItemValidationError);
});

test("LineItem: rejects missing id", () => {
  assert.throws(() => new LineItem({ label: "Milk", qty: 1, unitPrice: 50 }), LineItemValidationError);
});
