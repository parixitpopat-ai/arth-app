// TRX-002A — Command Result model.
// Every Command Handler returns one of these, never a raw value and never a thrown
// aggregate-validation error. This keeps the Dispatcher's contract uniform regardless
// of which aggregate handled the command.

export class CommandResult {
  constructor({ ok, data = null, error = null, events = [] }) {
    this.ok = ok;
    this.data = data;
    this.error = error;
    this.events = events; // domain events raised by the aggregate during this command, if ok
  }

  static success(data, events = []) {
    return new CommandResult({ ok: true, data, events });
  }

  // `error` is a plain { code, message } shape, not an Error instance — commands are a
  // boundary; callers (UI) shouldn't need to know whether a failure is a validation
  // error, a not-found, or something else beyond what's in `code`.
  static failure(code, message) {
    return new CommandResult({ ok: false, error: { code, message } });
  }
}
