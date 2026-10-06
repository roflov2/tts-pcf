/** Helpers for the Connection form values (render_connection_settings in app.py). */

import type { ConnectionSettings } from "../types";

/** The form's fields, in app.py's order. */
export const CONNECTION_FIELDS = ["server", "database", "table", "openAiEndpoint", "openAiApiVersion", "model"] as const;
export type ConnectionField = (typeof CONNECTION_FIELDS)[number];

/**
 * Trim every value and drop blank ones, as app.py stripped each field on Connect.
 * A blank field means "use the API's own setting". Null when nothing is left.
 */
export function normalizeConnection(values: Partial<Record<ConnectionField, unknown>> | null | undefined): ConnectionSettings | null {
  const settings: ConnectionSettings = {};
  for (const field of CONNECTION_FIELDS) {
    const value = values?.[field];
    if (typeof value === "string" && value.trim()) {
      settings[field] = value.trim();
    }
  }
  return Object.keys(settings).length > 0 ? settings : null;
}

/** "?server=…&table=…" for GET /schema, or "" when there's nothing to send. */
export function connectionQuery(connection: ConnectionSettings | null | undefined): string {
  const params = new URLSearchParams();
  for (const field of CONNECTION_FIELDS) {
    const value = connection?.[field];
    if (value) {
      params.set(field, value);
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Same values once trimmed and blanks dropped. */
export function sameConnection(a: ConnectionSettings | null | undefined, b: ConnectionSettings | null | undefined): boolean {
  return JSON.stringify(normalizeConnection(a)) === JSON.stringify(normalizeConnection(b));
}
