// TRX-002A — Command Dispatcher.
// The single entry point every UI intent passes through. Per ADR-026: no code upstream
// of this point is allowed to mutate application state directly — it must go through a
// command, dispatched here, handled by exactly one handler.

import { CommandResult } from "./CommandResult.js";

export class CommandDispatcher {
  constructor() {
    this._handlers = new Map();
  }

  register(commandType, handler) {
    if (this._handlers.has(commandType)) {
      throw new Error(
        `CommandDispatcher: a handler is already registered for "${commandType}". ` +
        `Exactly one handler per command type is required — this is the command-side ` +
        `equivalent of the "one publisher per event" rule.`
      );
    }
    this._handlers.set(commandType, handler);
  }

  async dispatch(command) {
    const handler = this._handlers.get(command.type);
    if (!handler) {
      return CommandResult.failure(
        "UNKNOWN_COMMAND",
        `No handler registered for command type "${command.type}".`
      );
    }
    try {
      return await handler.handle(command);
    } catch (err) {
      return CommandResult.failure(
        "UNHANDLED_ERROR",
        `Handler for "${command.type}" threw instead of returning a CommandResult: ${err.message}`
      );
    }
  }
}
