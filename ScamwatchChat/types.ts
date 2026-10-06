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

/**
 * The Connection form in app.py (render_connection_settings). Sent to the API only
 * when the app maker turns on allowConnectionChange; blank fields are left out and
 * the API uses its own setting. The API must check every value against an allowlist.
 */
export interface ConnectionSettings {
  server?: string;
  database?: string;
  /** Schema-qualified, e.g. Reporting.ScamWatchReportFiltered. */
  table?: string;
  openAiEndpoint?: string;
  openAiApiVersion?: string;
  /** Model deployment name. */
  model?: string;
}

/** GET {apiBaseUrl}/schema, with any ConnectionSettings as query parameters. */
export interface SchemaResponse {
  table: string;
  database: string;
  /** SQL server host (server_name on the agent). Optional; shown in Settings → Connection. */
  server?: string;
  /** Model deployment (deployment_name on the agent). Optional; shown in Settings → Connection. */
  model?: string;
  /** Azure OpenAI endpoint. Optional; shown in Settings → Connection. */
  openAiEndpoint?: string;
  /** Azure OpenAI API version. Optional; shown in Settings → Connection. */
  openAiApiVersion?: string;
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
  /** 5–200. How many result rows the model reads (llm_preview_limit on the agent). Default 20. */
  maxPreviewRows?: number;
  /** Plain-text data dictionary, sent with every question when one is active. */
  dataDictionary?: string;
  /** The user's Connection form values, when the app lets users change the connection. */
  connection?: ConnectionSettings;
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
  maxPreviewRows: number;
  useHistory: boolean;
}

/** A data dictionary ready to send with each question (DataDictionary in app.py). */
export interface DataDictionary {
  name: string;
  text: string;
  truncated: boolean;
  source: "upload" | "maker";
  /** Size of the uploaded file, shown beside its name as st.file_uploader did. */
  bytes?: number;
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
  getSchema(signal?: AbortSignal, connection?: ConnectionSettings): Promise<SchemaResponse>;
  query(request: QueryRequest, signal?: AbortSignal): Promise<QueryResponse>;
}
