// TRX-002B — Transaction domain wiring. Same shape as TRX-002A's
// wireExampleApplication, now registering the real Transaction commands
// instead of the trivial Tag example.

import { CommandDispatcher } from "../CommandDispatcher.js";
import { InMemoryRepository } from "../../infrastructure/InMemoryRepository.js";
import { InMemoryEventPublisher } from "../../infrastructure/InMemoryEventPublisher.js";
import { SnapshotAdapter } from "../../infrastructure/SnapshotAdapter.js";
import { PostTransactionHandler } from "./PostTransactionHandler.js";
import { ApplySettlementHandler } from "./ApplySettlementHandler.js";

export function wireTransactionApplication({ saveSnapshot, loadSnapshot } = {}) {
  const repository = new InMemoryRepository();
  const eventPublisher = new InMemoryEventPublisher();
  const dispatcher = new CommandDispatcher();

  dispatcher.register("PostTransaction", new PostTransactionHandler({ repository, eventPublisher }));
  dispatcher.register("ApplySettlement", new ApplySettlementHandler({ repository, eventPublisher }));

  const snapshotAdapter = saveSnapshot && loadSnapshot
    ? new SnapshotAdapter({ saveSnapshot, loadSnapshot })
    : null;

  return { dispatcher, repository, eventPublisher, snapshotAdapter };
}
