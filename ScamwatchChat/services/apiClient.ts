/** HTTP client for the backend that wraps TextToSQLAgent. See types.ts for the contract. */

import type { ChatApi, QueryRequest, QueryResponse, SchemaResponse } from "../types";
import { SignInRequiredError, type TokenProvider } from "./auth";

/** Under the ~240 s ingress timeout of common Azure hosts, so the server's own error wins. */
export const DEFAULT_TIMEOUT_MS = 230_000;

export type ApiErrorKind = "network" | "http" | "timeout" | "aborted" | "signin" | "config";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

/** Abort when either the caller's signal fires or the timeout passes. */
function withTimeout(signal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", onAbort);
  }
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    const detail = body?.detail ?? body?.error ?? body?.message;
    if (typeof detail === "string") {
      return detail;
    }
  } catch {
    // Not JSON; use the status text below.
  }
  return response.statusText || `HTTP ${response.status}`;
}

export class HttpChatApi implements ChatApi {
  private readonly baseUrl: string;
  private readonly tokens: TokenProvider;
  private readonly timeoutMs: number;

  constructor(baseUrl: string, tokens: TokenProvider, timeoutMs = DEFAULT_TIMEOUT_MS) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.tokens = tokens;
    this.timeoutMs = timeoutMs;
  }

  getSchema(signal?: AbortSignal): Promise<SchemaResponse> {
    return this.request<SchemaResponse>("GET", "/schema", undefined, signal);
  }

  query(request: QueryRequest, signal?: AbortSignal): Promise<QueryResponse> {
    return this.request<QueryResponse>("POST", "/query", request, signal);
  }

  private async request<T>(method: string, path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    if (!this.baseUrl) {
      throw new ApiError("config", "The control has no API URL. Set the apiBaseUrl property, or turn on useMockApi.");
    }
    let response = await this.send(method, path, body, signal, false);
    if (response.status === 401) {
      // The cached token may have expired or been revoked; get a fresh one and retry once.
      response = await this.send(method, path, body, signal, true);
    }
    if (!response.ok) {
      const message = await errorMessage(response);
      if (response.status === 401 || response.status === 403) {
        throw new ApiError("http", `You don't have access to the assistant (${response.status}). ${message}`, response.status);
      }
      if (response.status === 413) {
        throw new ApiError("http", "The request was too large for the server. Try a shorter data dictionary.", 413);
      }
      throw new ApiError("http", `The server returned an error (${response.status}). ${message}`, response.status);
    }
    return (await response.json()) as T;
  }

  private async send(
    method: string,
    path: string,
    body: unknown,
    signal: AbortSignal | undefined,
    retry: boolean,
  ): Promise<Response> {
    let token: string;
    try {
      token = await this.tokens.getToken({ forceRefresh: retry });
    } catch (error) {
      if (error instanceof SignInRequiredError) {
        throw new ApiError("signin", error.message);
      }
      throw error;
    }
    const timeout = withTimeout(signal, this.timeoutMs);
    try {
      return await fetch(this.baseUrl + path, {
        method,
        signal: timeout.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      if (timeout.timedOut()) {
        throw new ApiError("timeout", "The assistant took too long to answer. Try a narrower question.");
      }
      if (signal?.aborted) {
        throw new ApiError("aborted", "Cancelled.");
      }
      throw new ApiError(
        "network",
        `Couldn't reach ${this.baseUrl}. Check your network, and that the API allows this site (CORS: ${window.location.origin}).`,
      );
    } finally {
      timeout.dispose();
    }
  }
}

/** Stands in for the real client when required properties are missing, so the UI can say which. */
export class MisconfiguredChatApi implements ChatApi {
  private readonly missing: string[];

  constructor(missing: string[]) {
    this.missing = missing;
  }

  private fail(): Promise<never> {
    return Promise.reject(
      new ApiError(
        "config",
        `Set these control properties: ${this.missing.join(", ")}. Or turn on useMockApi to try the control with sample data.`,
      ),
    );
  }

  getSchema(): Promise<SchemaResponse> {
    return this.fail();
  }

  query(): Promise<QueryResponse> {
    return this.fail();
  }
}
