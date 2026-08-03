import test from "node:test";
import assert from "node:assert/strict";
import { wireExampleApplication } from "../wiring.js";

test("TRX-002A pipeline: command travels from intent to snapshot persistence", async () => {
  let persistedPayload = null;
  const fakeSaveSnapshot = async (userId, payload) => {
    persistedPayload = { userId, payload };
    return { updated_at: new Date().toISOString() };
  };
  const fakeLoadSnapshot = async (userId) => {
    return persistedPayload && persistedPayload.userId === userId ? persistedPayload.payload : null;
  };

  const { dispatcher, repository, eventPublisher, snapshotAdapter } = wireExampleApplication({
    saveSnapshot: fakeSaveSnapshot,
    loadSnapshot: fakeLoadSnapshot,
  });

  const command = { type: "CreateTag", payload: { id: "tag-1", name: "Groceries" } };
  const result = await dispatcher.dispatch(command);

  assert.equal(result.ok, true, "command should succeed");
  assert.equal(result.data.name, "Groceries");

  const stored = await repository.load("tag-1");
  assert.ok(stored, "aggregate should be saved in the repository");
  assert.equal(stored.name, "Groceries");

  assert.equal(eventPublisher.published.length, 1);
  assert.equal(eventPublisher.published[0].type, "TagCreated");
  assert.equal(eventPublisher.published[0].tagId, "tag-1");

  await snapshotAdapter.persist("user-1", { tags: [stored] });
  assert.ok(persistedPayload, "snapshot adapter should have called the injected saveSnapshot");
  assert.equal(persistedPayload.userId, "user-1");
  assert.equal(persistedPayload.payload.tags[0].name, "Groceries");

  const restored = await snapshotAdapter.restore("user-1");
  assert.equal(restored.tags[0].name, "Groceries");
});

test("TRX-002A pipeline: aggregate validation failure never throws past the Dispatcher", async () => {
  const { dispatcher } = wireExampleApplication();
  const command = { type: "CreateTag", payload: { id: "tag-2", name: "   " } };
  const result = await dispatcher.dispatch(command);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "VALIDATION_ERROR");
});

test("CommandDispatcher: exactly one handler per command type is enforced", async () => {
  const { dispatcher } = wireExampleApplication();
  assert.throws(
    () => dispatcher.register("CreateTag", {}),
    /already registered/,
    "registering a second handler for the same command type should throw"
  );
});

test("CommandDispatcher: unknown command type returns a failure, not a throw", async () => {
  const { dispatcher } = wireExampleApplication();
  const result = await dispatcher.dispatch({ type: "NotARealCommand", payload: {} });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "UNKNOWN_COMMAND");
});
