import type { EngineErrorCode } from "./types.ts";

export const ERROR_CATALOG: Record<
  EngineErrorCode,
  { httpish: number; retryable: boolean; terminal: boolean; meaning: string }
> = {
  INVALID_INPUT: {
    httpish: 400,
    retryable: false,
    terminal: true,
    meaning: "Input failed validation or canonicalization. May produce REJECT if persisted.",
  },
  INPUT_TOO_LARGE: {
    httpish: 413,
    retryable: false,
    terminal: false,
    meaning: "Request exceeds size limit. No decision is issued and nothing is stored.",
  },
  RATE_LIMITED: {
    httpish: 429,
    retryable: true,
    terminal: false,
    meaning: "Abuse control. No decision is issued.",
  },
  AUDIT_PERSISTENCE_FAILURE: {
    httpish: 503,
    retryable: true,
    terminal: false,
    meaning: "Terminal decision cannot be exposed without a durable audit record.",
  },
  NOT_FOUND: {
    httpish: 404,
    retryable: false,
    terminal: false,
    meaning: "No audit record for the requested identity.",
  },
  UNKNOWN_STATE: {
    httpish: 500,
    retryable: false,
    terminal: false,
    meaning: "Runtime produced a state outside SHIP, HOLD, and REJECT. Fail-closed: no decision.",
  },
};

export class EngineError extends Error {
  code: EngineErrorCode;
  retryable: boolean;
  terminal: boolean;

  constructor(code: EngineErrorCode, message?: string) {
    super(message ?? ERROR_CATALOG[code].meaning);
    this.name = "EngineError";
    this.code = code;
    this.retryable = ERROR_CATALOG[code].retryable;
    this.terminal = ERROR_CATALOG[code].terminal;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      terminal: this.terminal,
    };
  }
}
