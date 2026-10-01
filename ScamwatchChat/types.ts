/**
 * Shared types, including the HTTP contract between this control and the backend
 * that wraps the Python TextToSQLAgent. docs/API_CONTRACT.md describes the same
 * contract in prose; this file is the source of truth.
 */

/** A cell value after the server has made it JSON-safe (Decimal → number, bytes → hex, dates → ISO). */
export type CellValue = string | number | boolean | null;
export type Row = Record<string, CellValue>;

export interface ColumnInfo {
  name: string;
  type: string;
}

/** GET {apiBaseUrl}/schema */
export interface SchemaResponse {
  table: string;
  database: string;
  columns: ColumnInfo[];
  sampleRows: Row[];
  limits?: {
    /** MAX_DICTIONARY_CHARS in text_to_sql_agent.py. */
    maxDictionaryChars?: number;
    /** max_result_rows on the agent. */
    maxResultRows?: number;
  };
}

/** One model turn sent as context for a follow-up question. */
export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

/** POST {apiBaseUrl}/query request body. */
export interface QueryRequest {
  question: string;
  history: HistoryMessage[];
  /** 1–5. Model rounds allowed before giving up. */
  maxAttempts: number;
  /** Plain-text data dictionary, sent with every question when one is active. */
  dataDictionary?: string;
}

export interface Attempt {
  query: string;
  success: boolean;
  error?: string | null;
}

/** POST {apiBaseUrl}/query response body. Mirrors TextToSQLAgent.query(). */
export interface QueryResponse {
  answer: string | null;
  sql: string | null;
  dataNote?: string | null;
  attempts: Attempt[];
  columnNames: string[];
  /** Full result rows, or null when no query succeeded. */
  rows: Row[] | null;
  totalRows: number;
  truncated: boolean;
  /** Set when the agent failed outright (shown inline, the chat keeps working). */
  error?: string | null;
}

// ------------------------------------------------------------------ UI state

export interface UserChatMessage {
  role: "user";
  id: string;
  content: string;
}

export interface AssistantChatMessage {
  role: "assistant";
  id: string;
  content: string;
  error?: string;
  sql?: string | null;
  dataNote?: string | null;
  attempts: Attempt[];
  columnNames: string[];
  rows: Row[] | null;
  totalRows: number;
  truncated: boolean;
  /** Name of the data dictionary sent with the question, if any. */
  dictionaryName?: string | null;
  /** True when the rows were too large to keep in session storage. */
  rowsDropped?: boolean;
}

export type ChatMessage = UserChatMessage | AssistantChatMessage;

export interface AnswerSettings {
  maxAttempts: number;
  useHistory: boolean;
}

/** A data dictionary ready to send with each question (DataDictionary in app.py). */
export interface DataDictionary {
  name: string;
  text: string;
  truncated: boolean;
  source: "upload" | "maker";
}

/** Values the control reports back to the hosting app. */
export interface ControlOutputs {
  lastQuestion?: string;
  lastAnswer?: string;
  lastSql?: string;
  lastRowCount?: number;
  lastError?: string;
  activeDictionaryName?: string;
}

/** What the UI needs from the backend. Implemented by apiClient.ts and mockApi.ts. */
export interface ChatApi {
  getSchema(signal?: AbortSignal): Promise<SchemaResponse>;
  query(request: QueryRequest, signal?: AbortSignal): Promise<QueryResponse>;
}
