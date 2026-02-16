export function extractErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") {
    return undefined;
  }
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string") {
    return code;
  }
  if (typeof code === "number") {
    return String(code);
  }
  return undefined;
}

/**
 * Type guard for NodeJS.ErrnoException (any error with a `code` property).
 */
export function isErrno(err: unknown): err is NodeJS.ErrnoException {
  return Boolean(err && typeof err === "object" && "code" in err);
}

/**
 * Check if an error has a specific errno code.
 */
export function hasErrnoCode(err: unknown, code: string): boolean {
  return isErrno(err) && err.code === code;
}

export function formatErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message || err.name || "Error";
  }
  if (typeof err === "string") {
    return err;
  }
  if (typeof err === "number" || typeof err === "boolean" || typeof err === "bigint") {
    return String(err);
  }
  try {
    return JSON.stringify(err);
  } catch {
    return Object.prototype.toString.call(err);
  }
}

/**
 * Checks if an uncaught exception is non-fatal and the process should continue running.
 *
 * Currently handles:
 * - EPIPE (broken pipe): occurs when stdout/stderr pipe to a parent process breaks,
 *   e.g., when the terminal or shell exits. This is harmless for a background gateway.
 */
export function isNonFatalException(err: unknown): boolean {
  return hasErrnoCode(err, "EPIPE");
}

/**
 * Checks if an error is an EPIPE (broken pipe) error.
 * EPIPE errors must be silently swallowed — attempting to log them via
 * console.warn/console.error triggers another EPIPE, creating an infinite
 * recursive loop that freezes the event loop and generates multi-GB log files.
 */
export function isEpipeError(err: unknown): boolean {
  return hasErrnoCode(err, "EPIPE");
}

export function formatUncaughtError(err: unknown): string {
  if (extractErrorCode(err) === "INVALID_CONFIG") {
    return formatErrorMessage(err);
  }
  if (err instanceof Error) {
    return err.stack ?? err.message ?? err.name;
  }
  return formatErrorMessage(err);
}
