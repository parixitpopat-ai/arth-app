// TRX-002B — Transaction domain wiring. Same shape as TRX-002A's
// wireExampleApplication, now registering the real Transaction commands
// instead of the trivial Tag example.

import { CommandDispatcher } from "../CommandDispatcher.js";
import { InMemoryRepository } from "../../infrastructure/InMemoryRepository.js";
import { InMemoryEventPublisher } from "../../infrastructure/InMemoryEventPublisher.js";
import { SnapshotAdapter } from "../../infrastructure/SnapshotAdapter.js";
import { TxnsStateRepository } from "../../domain/transactions/legacy/TxnsStateRepository.js";
import { PostTransactionHandler } from "./PostTransactionHandler.js";
import { ApplySettlementHandler } from "./ApplySettlementHandler.js";
import { EditTransactionHandler } from "./EditTransactionHandler.js";

// WP-TXN-01 — `statePort` is optional and additive. Callers that don't pass
// it (including the pre-existing transaction-pipeline.test.js, unmodified)
// keep getting the original InMemoryRepository-backed pipeline exactly as
// before — zero behavior change for anything that doesn't opt in. Passing a
// statePort is how App.jsx will eventually connect this pipeline to the
// real txns[] state instead of an isolated in-memory store.
export function wireTransactionApplication({ saveSnapshot, loadSnapshot, statePort } = {}) {
  const repository = statePort
    ? new TxnsStateRepository({ statePort })
    : new InMemoryRepository();
  const eventPublisher = new InMemoryEventPublisher();
  const dispatcher = new CommandDispatcher();

  dispatcher.register("PostTransaction", new PostTransactionHandler({ repository, eventPublisher }));
  dispatcher.register("ApplySettlement", new ApplySettlementHandler({ repository, eventPublisher }));
  dispatcher.register("EditTransaction", new EditTransactionHandler({ repository, eventPublisher }));

  const snapshotAdapter = saveSnapshot && loadSnapshot
    ? new SnapshotAdapter({ saveSnapshot, loadSnapshot })
    : null;

  return { dispatcher, repository, eventPublisher, snapshotAdapter };
}
