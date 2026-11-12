import test from "node:test";
import assert from "node:assert/strict";
import { personForName, splitVendorsAndPeople, suggestPeople, addAlias, removeAlias } from "./payees.js";

const people = [{ id: "__me__", name: "Me" }, { id: "p1", name: "Raj Adhiya" }, { id: "p2", name: "Nidhi Yadav", aliases: ["NIDHI Y"] }, { id: "p3", name: "Nidhi Sharma" }];
const rows = [{ name: "Zomato", variants: ["Zomato"], amount: 900 }, { name: "Nidhi Y", variants: ["Nidhi Y", "NIDHI Y"], amount: 4000 }, { name: "Raj Adhiya", variants: ["Raj Adhiya"], amount: 15000 }, { name: "Raj Ad", variants: ["Raj Ad"], amount: 500 }];

test("a person's name or alias makes a payee a person; shops stay vendors", () => {
  assert.equal(personForName("raj  adhiya", people).id, "p1");
  assert.equal(personForName("NIDHI Y", people).id, "p2");           // alias
  assert.equal(personForName("Zomato", people), null);
  assert.equal(personForName("Me", people), null);                    // my own name never counts
  const s = splitVendorsAndPeople(rows, people);
  assert.deepEqual(s.vendors.map(v => v.name), ["Zomato", "Raj Ad"]);
  assert.deepEqual(s.people.map(x => x.person.id), ["p2", "p1"]);
});
test("cut-short names are only SUGGESTED, and only when exactly one person fits", () => {
  const sug = suggestPeople([{ name: "Raj Ad" }, { name: "Nidhi" }, { name: "Raj" }, { name: "Zomato" }], people);
  assert.deepEqual(sug.map(x => [x.name, x.person.id]), [["Raj Ad", "p1"], ["Raj", "p1"]]);   // "Nidhi" fits two people: no suggestion
});
test("aliases are added once and can be removed", () => {
  let p = addAlias(people, "p1", "RAJ AD"); p = addAlias(p, "p1", "raj ad");
  assert.deepEqual(p.find(x => x.id === "p1").aliases, ["RAJ AD"]);
  p = removeAlias(p, "p1", "Raj Ad");
  assert.deepEqual(p.find(x => x.id === "p1").aliases, []);
});
