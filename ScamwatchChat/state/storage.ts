/**
 * Session storage for the conversation, the answering settings and the uploaded
 * dictionary, so a canvas screen change or a form reload doesn't wipe them (they
 * last the session, as Streamlit's session state did). Every access is wrapped:
 * storage can be blocked or full inside Power Apps frames, and the control must
 * work without it.
 */

import type { AnswerSettings, AssistantChatMessage, ChatMessage, DataDictionary } from "../types";

/** Result rows bigger than this aren't kept; the message says to ask again. */
export const MAX_STORED_RESULT_CHARS = 2_000_000;

function read<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null || value === undefined) {
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // Storage full or blocked: the in-memory state still works.
  }
}

export function storageKeys(namespace: string) {
  return {
    messages: `scamwatch-chat:${namespace}:messages`,
    dictionary: `scamwatch-chat:${namespace}:dictionary`,
    settings: `scamwatch-chat:${namespace}:settings`,
  };
}

/** Drop large result sets before saving, marking the messages so the UI can explain. */
export function compactForStorage(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => {
    if (message.role !== "assistant" || !message.rows) {
      return message;
    }
    const size = JSON.stringify(message.rows).length;
    if (size <= MAX_STORED_RESULT_CHARS) {
      return message;
    }
    const compact: AssistantChatMessage = { ...message, rows: null, rowsDropped: true };
    return compact;
  });
}

export function loadMessages(namespace: string): ChatMessage[] {
  return read<ChatMessage[]>(storageKeys(namespace).messages) ?? [];
}

export function saveMessages(namespace: string, messages: ChatMessage[]): void {
  write(storageKeys(namespace).messages, messages.length ? compactForStorage(messages) : null);
}

export function loadDictionary(namespace: string): DataDictionary | null {
  return read<DataDictionary>(storageKeys(namespace).dictionary);
}

export function saveDictionary(namespace: string, dictionary: DataDictionary | null): void {
  write(storageKeys(namespace).dictionary, dictionary);
}

/** The answering settings the user chose this session. Fields of the wrong type are dropped. */
export function loadSettings(namespace: string): Partial<AnswerSettings> {
  const stored = read<Record<string, unknown>>(storageKeys(namespace).settings) ?? {};
  const settings: Partial<AnswerSettings> = {};
  if (typeof stored.maxAttempts === "number") settings.maxAttempts = stored.maxAttempts;
  if (typeof stored.maxPreviewRows === "number") settings.maxPreviewRows = stored.maxPreviewRows;
  if (typeof stored.useHistory === "boolean") settings.useHistory = stored.useHistory;
  return settings;
}

export function saveSettings(namespace: string, settings: AnswerSettings): void {
  write(storageKeys(namespace).settings, settings);
}
