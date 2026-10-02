/**
 * Conversation state: messages, the in-flight question, answering settings and
 * the uploaded data dictionary. The reducer is pure and exported for tests; the
 * hook wires it to the API, session storage and the control's outputs.
 */

import * as React from "react";
import { ApiError } from "../services/apiClient";
import { DEFAULT_MAKER_DICTIONARY_NAME } from "../defaults";
import type {
  AnswerSettings,
  AssistantChatMessage,
  ChatApi,
  ChatMessage,
  ControlOutputs,
  DataDictionary,
  QueryResponse,
} from "../types";
import { prepareDataDictionary } from "../utils/dictionary";
import { buildHistory, newId } from "../utils/format";
import { loadDictionary, loadMessages, loadSettings, saveDictionary, saveMessages, saveSettings } from "./storage";

export const MIN_ATTEMPTS = 1;
export const MAX_ATTEMPTS = 5;
export { DEFAULT_PREVIEW_ROWS, MAX_PREVIEW_ROWS, MIN_PREVIEW_ROWS, PREVIEW_ROWS_STEP } from "../defaults";
import { DEFAULT_PREVIEW_ROWS, MAX_PREVIEW_ROWS, MIN_PREVIEW_ROWS } from "../defaults";

export interface ChatState {
  messages: ChatMessage[];
  pending: boolean;
  settings: AnswerSettings;
  /** The dictionary the user uploaded. The maker's dictionary comes from props instead. */
  uploaded: DataDictionary | null;
}

export type ChatAction =
  | { type: "ask"; id: string; question: string }
  | { type: "answer"; message: AssistantChatMessage }
  | { type: "clear" }
  | { type: "settings"; settings: Partial<AnswerSettings> }
  | { type: "upload"; dictionary: DataDictionary | null };

export function clampAttempts(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 3;
  }
  return Math.min(MAX_ATTEMPTS, Math.max(MIN_ATTEMPTS, Math.round(value)));
}

export function clampPreviewRows(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return DEFAULT_PREVIEW_ROWS;
  }
  return Math.min(MAX_PREVIEW_ROWS, Math.max(MIN_PREVIEW_ROWS, Math.round(value)));
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "ask":
      return {
        ...state,
        pending: true,
        messages: [...state.messages, { role: "user", id: action.id, content: action.question }],
      };
    case "answer":
      return { ...state, pending: false, messages: [...state.messages, action.message] };
    case "clear":
      return { ...state, messages: [] };
    case "settings":
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.settings,
          maxAttempts: clampAttempts(action.settings.maxAttempts ?? state.settings.maxAttempts),
          maxPreviewRows: clampPreviewRows(action.settings.maxPreviewRows ?? state.settings.maxPreviewRows),
        },
      };
    case "upload":
      return { ...state, uploaded: action.dictionary };
    default:
      return state;
  }
}

export interface MakerDictionary {
  text: string | null | undefined;
  name: string | null | undefined;
}

/**
 * The dictionary sent with new questions: the user's upload wins over the one
 * the app maker supplied, unless uploads are turned off.
 */
export function activeDictionary(
  uploaded: DataDictionary | null,
  maker: MakerDictionary,
  allowUpload: boolean,
  maxChars?: number,
): DataDictionary | null {
  if (allowUpload && uploaded) {
    return uploaded;
  }
  if (maker.text) {
    const { text, truncated } = prepareDataDictionary(maker.text, maxChars);
    if (text) {
      return { name: maker.name || DEFAULT_MAKER_DICTIONARY_NAME, text, truncated, source: "maker" };
    }
  }
  return null;
}

/** Shape an API response as a chat message (ask_agent in app.py). */
export function toAssistantMessage(response: QueryResponse, dictionaryName: string | null): AssistantChatMessage {
  return {
    role: "assistant",
    id: newId(),
    content: response.answer ?? "",
    error: response.error ?? undefined,
    sql: response.sql,
    dataNote: response.dataNote,
    attempts: response.attempts ?? [],
    columnNames: response.columnNames ?? [],
    rows: response.rows,
    totalRows: response.totalRows ?? 0,
    truncated: response.truncated ?? false,
    dictionaryName,
  };
}

export function errorMessage(error: unknown): AssistantChatMessage {
  let text: string;
  if (error instanceof ApiError && error.kind === "aborted") {
    text = "Stopped before an answer came back. Ask again whenever you're ready.";
  } else if (error instanceof Error) {
    text = `The question couldn't be answered. ${error.message}`;
  } else {
    text = "The question couldn't be answered.";
  }
  return {
    role: "assistant",
    id: newId(),
    content: "",
    error: text,
    attempts: [],
    columnNames: [],
    rows: null,
    totalRows: 0,
    truncated: false,
  };
}

export interface UseChatOptions {
  api: ChatApi;
  /** Keys session storage, so two controls on one page don't share a conversation. */
  storageNamespace: string;
  historyTurns: number;
  initialSettings: AnswerSettings;
  /** The app maker's dictionary, from the dataDictionary property. */
  maker: MakerDictionary;
  allowUpload: boolean;
  maxDictionaryChars?: number;
  onOutputs?: (outputs: ControlOutputs) => void;
  onSignInRequired?: () => void;
}

export function useChat(options: UseChatOptions) {
  const { api, storageNamespace, historyTurns, initialSettings, maker, allowUpload, maxDictionaryChars } = options;
  const { onOutputs, onSignInRequired } = options;

  const [state, dispatch] = React.useReducer(chatReducer, undefined, () => {
    // Settings the user changed earlier this session win over the app's defaults.
    const settings = { ...initialSettings, ...loadSettings(storageNamespace) };
    return {
      messages: loadMessages(storageNamespace),
      pending: false,
      settings: {
        maxAttempts: clampAttempts(settings.maxAttempts),
        maxPreviewRows: clampPreviewRows(settings.maxPreviewRows),
        useHistory: settings.useHistory !== false,
      },
      uploaded: loadDictionary(storageNamespace),
    };
  });
  const settingsChanged = React.useRef(false);

  const dictionary = React.useMemo(
    () => activeDictionary(state.uploaded, maker, allowUpload, maxDictionaryChars),
    [state.uploaded, maker.text, maker.name, allowUpload, maxDictionaryChars], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const controller = React.useRef<AbortController | null>(null);
  // The latest state and props, read inside async callbacks.
  const latest = React.useRef({ state, dictionary, historyTurns, api });
  latest.current = { state, dictionary, historyTurns, api };

  React.useEffect(() => {
    if (!state.pending) {
      saveMessages(storageNamespace, state.messages);
    }
  }, [state.messages, state.pending, storageNamespace]);

  React.useEffect(() => {
    saveDictionary(storageNamespace, state.uploaded);
  }, [state.uploaded, storageNamespace]);

  // Only once the user changes something, so the app's defaults still apply until then.
  React.useEffect(() => {
    if (settingsChanged.current) {
      saveSettings(storageNamespace, state.settings);
    }
  }, [state.settings, storageNamespace]);

  // Abort an in-flight question when the control unmounts.
  React.useEffect(() => () => controller.current?.abort(), []);

  const ask = React.useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      const current = latest.current;
      if (!trimmed || current.state.pending) {
        return;
      }
      const { settings, messages } = current.state;
      const history = settings.useHistory ? buildHistory(messages, current.historyTurns) : [];
      const activeDict = current.dictionary;

      dispatch({ type: "ask", id: newId(), question: trimmed });
      const abort = new AbortController();
      controller.current = abort;

      let reply: AssistantChatMessage;
      try {
        const response = await current.api.query(
          {
            question: trimmed,
            history,
            maxAttempts: settings.maxAttempts,
            maxPreviewRows: settings.maxPreviewRows,
            ...(activeDict ? { dataDictionary: activeDict.text } : {}),
          },
          abort.signal,
        );
        reply = toAssistantMessage(response, activeDict?.name ?? null);
      } catch (error) {
        const aborted = abort.signal.aborted || (error instanceof Error && error.name === "AbortError");
        reply = errorMessage(aborted ? new ApiError("aborted", "Cancelled.") : error);
        if (error instanceof ApiError && error.kind === "signin") {
          onSignInRequired?.();
        }
      } finally {
        if (controller.current === abort) {
          controller.current = null;
        }
      }

      dispatch({ type: "answer", message: reply });
      onOutputs?.({
        lastQuestion: trimmed,
        lastAnswer: reply.content,
        lastSql: reply.sql ?? "",
        lastRowCount: reply.totalRows,
        lastError: reply.error ?? "",
      });
    },
    [onOutputs, onSignInRequired],
  );

  const cancel = React.useCallback(() => controller.current?.abort(), []);
  const clear = React.useCallback(() => dispatch({ type: "clear" }), []);
  const updateSettings = React.useCallback((settings: Partial<AnswerSettings>) => {
    settingsChanged.current = true;
    dispatch({ type: "settings", settings });
  }, []);
  const setUploaded = React.useCallback(
    (uploaded: DataDictionary | null) => dispatch({ type: "upload", dictionary: uploaded }),
    [],
  );

  return { state, dictionary, ask, cancel, clear, updateSettings, setUploaded };
}
