// Error type and JWT storage shared by lib/api.ts, lib/ws.ts and src/mocks (no imports, so no cycles).
import type { ApiError, DeclineCode } from "./types";

/** Thrown for every non-2xx response. `code` is the contract error code. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly declineCode?: DeclineCode;

  constructor(status: number, body: ApiError) {
    super(body.message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = body.error;
    this.declineCode = body.declineCode;
  }
}

const TOKEN_KEY = "unihop.token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage blocked: session stays in memory only
  }
}
