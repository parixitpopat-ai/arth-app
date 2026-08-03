// TRX-002A — Dependency wiring, example flow.
import { CommandDispatcher } from "./CommandDispatcher.js";
import { InMemoryRepository } from "../infrastructure/InMemoryRepository.js";
import { InMemoryEventPublisher } from "../infrastructure/InMemoryEventPublisher.js";
import { SnapshotAdapter } from "../infrastructure/SnapshotAdapter.js";
import { CreateTagHandler } from "./example/CreateTagHandler.js";

export function wireExampleApplication({ saveSnapshot, loadSnapshot } = {}) {
  const repository = new InMemoryRepository();
  const eventPublisher = new InMemoryEventPublisher();
  const dispatcher = new CommandDispatcher();

  dispatcher.register("CreateTag", new CreateTagHandler({ repository, eventPublisher }));

  const snapshotAdapter = saveSnapshot && loadSnapshot
    ? new SnapshotAdapter({ saveSnapshot, loadSnapshot })
    : null;

  return { dispatcher, repository, eventPublisher, snapshotAdapter };
}
