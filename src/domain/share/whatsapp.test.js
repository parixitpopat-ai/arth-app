import test from "node:test";
import assert from "node:assert/strict";
import { normalisePhone, whatsappLink } from "./whatsapp.js";

test("a 10-digit number gets +91; formatting is stripped", () => {
  assert.equal(normalisePhone("98765 43210"), "919876543210");
  assert.equal(normalisePhone("098765-43210"), "919876543210");
});

test("a number with its own country code is kept", () => {
  assert.equal(normalisePhone("+91 98765 43210"), "919876543210");
  assert.equal(normalisePhone("+44 7700 900123"), "447700900123");
  assert.equal(normalisePhone("0044 7700 900123"), "447700900123");
});

test("nothing usable gives an empty number", () => {
  for (const v of ["", "  ", "abc", "123", null, undefined]) assert.equal(normalisePhone(v), "");
});

test("the link carries the number and the encoded message; with no number it opens WhatsApp's chooser", () => {
  assert.equal(whatsappLink({ phone: "9876543210", text: "Hello Raj,\nYour share is ₹1,015" }), "https://wa.me/919876543210?text=Hello%20Raj%2C%0AYour%20share%20is%20%E2%82%B91%2C015");
  assert.equal(whatsappLink({ phone: "", text: "Hi" }), "https://wa.me/?text=Hi");
});
