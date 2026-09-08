import test from "node:test";
import assert from "node:assert/strict";
import { TxnsStateRepository } from "../TxnsStateRepository.js";
import { Transaction } from "../../Transaction.js";

// A minimal mock statePort — deliberately has no React involved, proving
// the repository is unit-testable without any UI framework.
function makeStatePort(initial = []) {
  let store = [...initial];
  return {
    getAll: () => store,
    upsert: (record) => {
      const idx = store.findIndex(t => String(t.id) === String(record.id));
      store = idx === -1 ? [record, ...store] : store.map((t, i) => (i === idx ? record : t));
    },
    _peek: () => store,
  };
}

test("save() on create writes into the real array via upsert(), no separate store", async () => {
  const port = makeStatePort([]);
  const repo = new TxnsStateRepository({ statePort: port });
  const txn = Transaction.post({ id: "t1", type: "expense", date: "2026-08-01", amount: 500, accountId: "acc-1", categoryId: "cat-1" });

  await repo.save(txn);

  assert.equal(port._peek().length, 1);
  assert.equal(port._peek()[0].id, "t1");
  assert.equal(port._peek()[0].accId, "acc-1");
});

test("load() returns null for an unknown id, not a throw", async () => {
  const repo = new TxnsStateRepository({ statePort: makeStatePort([]) });
  const result = await repo.load("does-not-exist");
  assert.equal(result, null);
});

test("load() hydrates without raising a TransactionPosted event", async () => {
  const port = makeStatePort([{ id: "t1", type: "expense", date: "2026-08-01", amount: 500, accId: "acc-1", catId: "cat-1" }]);
  const repo = new TxnsStateRepository({ statePort: port });
  const txn = await repo.load("t1");
  assert.equal(txn.pullEvents().length, 0, "loading an existing record must not fabricate a creation event");
});

test("save() after load()+edit() preserves unknown fields by looking up the current record itself, not via anything threaded from load()", async () => {
  const port = makeStatePort([{ id: "t1", type: "expense", date: "2026-08-01", amount: 500, accId: "acc-1", catId: "cat-1", desc: "Original desc", merchant: "Cafe X" }]);
  const repo = new TxnsStateRepository({ statePort: port });

  const txn = await repo.load("t1");
  txn.edit({ amount: 600 });
  await repo.save(txn);

  const saved = port._peek().find(t => t.id === "t1");
  assert.equal(saved.amount, 600);
  assert.equal(saved.desc, "Original desc", "unknown field must survive even though load() never returned it alongside the aggregate");
  assert.equal(saved.merchant, "Cafe X");
});

test("repository never holds its own copy — an external mutation of the port's array is visible on the next load()", async () => {
  const port = makeStatePort([{ id: "t1", type: "expense", date: "2026-08-01", amount: 500, accId: "acc-1" }]);
  const repo = new TxnsStateRepository({ statePort: port });

  // Simulate something else (e.g. legacy upsertTxn on a different record)
  // mutating the same underlying store the repository reads from.
  port.upsert({ id: "t1", type: "expense", date: "2026-08-01", amount: 999, accId: "acc-1" });

  const txn = await repo.load("t1");
  assert.equal(txn.amount.amount, 999, "repository must reflect the live store, proving it holds no stale internal copy");
});

test("constructing without a valid statePort throws immediately rather than failing silently later", () => {
  assert.throws(() => new TxnsStateRepository({}), /statePort/);
});
