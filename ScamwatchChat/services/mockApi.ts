/**
 * A fake backend for the test harness, the preview page and demos.
 *
 * It answers from generated data and picks a canned scenario from keywords in
 * the question, so every UI state can be reached without Azure:
 *   "how many" / "total"        → single-row count
 *   "most common" / "top"       → grouped counts
 *   "kind of field" / "sample"  → sampled column values
 *   "month"                     → monthly breakdown (good follow-up)
 *   "everything" / "all rows"   → 50,000+ rows, capped (grid and CSV stress test)
 *   "delete" / "drop"           → blocked write, then a corrected query (failed-attempts tab)
 *   "error"                     → the agent fails outright (inline error)
 *   "nothing"                   → an answer with no SQL
 */

import type { Attempt, ChatApi, ColumnInfo, QueryRequest, QueryResponse, Row, SchemaResponse } from "../types";

const TABLE = "Reporting.ScamWatchReportFiltered";
const DATABASE = "NASC_ODS";
const PREVIEW_LIMIT = 20;
const MAX_RESULT_ROWS = 50_000;

const COLUMNS: ColumnInfo[] = [
  { name: "report_id", type: "int" },
  { name: "date_reported", type: "date" },
  { name: "scam_type", type: "nvarchar" },
  { name: "contact_method", type: "nvarchar" },
  { name: "amount_lost", type: "decimal" },
  { name: "state", type: "nvarchar" },
  { name: "age_group", type: "nvarchar" },
  { name: "other_product_name", type: "nvarchar" },
  { name: "is_loss", type: "bit" },
];

const SCAM_TYPES = ["Phishing", "Investment", "Romance", "Online shopping", "Remote access", "Identity theft", "Threats to life"];
const CONTACT = ["Email", "Phone call", "Text message", "Social media", "Website", "In person"];
const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const AGES = ["Under 18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const PRODUCTS = [
  "Gift cards",
  "Cryptocurrency wallet",
  "Puppy for sale",
  "Concert tickets",
  "Parcel delivery fee",
  "Tax refund",
  "Superannuation rollover",
  "Car on marketplace",
  "Rental property bond",
  "Fake invoice",
  null,
];

/** Small deterministic PRNG so the mock gives the same data every run. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function pick<T>(items: T[], next: () => number): T {
  return items[Math.floor(next() * items.length)];
}

function makeRows(count: number, seed = 7): Row[] {
  const next = random(seed);
  const start = Date.UTC(2024, 0, 1);
  const rows: Row[] = [];
  for (let i = 0; i < count; i++) {
    const loss = next() < 0.35;
    rows.push({
      report_id: 100_000 + i,
      date_reported: new Date(start + Math.floor(next() * 640) * 86_400_000).toISOString().slice(0, 10),
      scam_type: pick(SCAM_TYPES, next),
      contact_method: pick(CONTACT, next),
      amount_lost: loss ? Math.round(next() * 25_000 * 100) / 100 : 0,
      state: pick(STATES, next),
      age_group: pick(AGES, next),
      other_product_name: pick(PRODUCTS, next),
      is_loss: loss,
    });
  }
  return rows;
}

const SAMPLE_ROWS = makeRows(3, 3);

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abortError = () => Object.assign(new Error("Cancelled."), { name: "AbortError" });
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(abortError());
    });
  });
}

function result(
  answer: string,
  sql: string,
  columnNames: string[],
  rows: Row[],
  options: { truncated?: boolean; attempts?: Attempt[]; previewLimit?: number } = {},
): QueryResponse {
  const truncated = options.truncated ?? false;
  const previewLimit = options.previewLimit ?? PREVIEW_LIMIT;
  const totalRows = rows.length;
  const notes: string[] = [];
  if (totalRows > previewLimit) {
    notes.push(`Interpretation based on the first ${previewLimit} of ${totalRows.toLocaleString("en-US")} rows.`);
  }
  if (truncated) {
    notes.push(`Results were capped at ${MAX_RESULT_ROWS.toLocaleString("en-US")} rows.`);
  }
  return {
    answer,
    sql,
    dataNote: notes.length ? notes.join(" ") : null,
    attempts: [...(options.attempts ?? []), { query: sql, success: true, error: null }],
    columnNames,
    rows,
    totalRows,
    truncated,
    error: null,
  };
}

function countBy(rows: Row[], column: string, top: number): Row[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row[column] === null ? "(blank)" : String(row[column]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts, ([value, report_count]) => ({ [column]: value, report_count }))
    .sort((a, b) => Number(b.report_count) - Number(a.report_count))
    .slice(0, top);
}

export class MockChatApi implements ChatApi {
  private readonly delayMs: number;
  private readonly data = makeRows(4_000);

  constructor(delayMs = 900) {
    this.delayMs = delayMs;
  }

  async getSchema(signal?: AbortSignal): Promise<SchemaResponse> {
    await wait(this.delayMs / 3, signal);
    return {
      table: TABLE,
      database: DATABASE,
      columns: COLUMNS,
      sampleRows: SAMPLE_ROWS,
      limits: { maxDictionaryChars: 40_000, maxResultRows: MAX_RESULT_ROWS },
    };
  }

  async query(request: QueryRequest, signal?: AbortSignal): Promise<QueryResponse> {
    await wait(this.delayMs, signal);
    const previewLimit = request.maxPreviewRows ?? PREVIEW_LIMIT;
    const sendResult = (
      answer: string,
      sql: string,
      columnNames: string[],
      rows: Row[],
      options: { truncated?: boolean; attempts?: Attempt[]; previewLimit?: number } = {},
    ) => result(answer, sql, columnNames, rows, { previewLimit, ...options });
    const q = request.question.toLowerCase();
    const dictionaryNote = request.dataDictionary
      ? "\n\n_Per the data dictionary, withdrawn reports are excluded by default._"
      : "";
    const followUp = request.history.length > 0 ? " (following on from your earlier question)" : "";

    if (q.includes("error")) {
      return {
        answer: null,
        sql: null,
        attempts: [],
        columnNames: [],
        rows: null,
        totalRows: 0,
        truncated: false,
        error: "The question couldn't be answered. RateLimitError: Too many requests to the model deployment (mock).",
      };
    }
    if (q.includes("nothing")) {
      return {
        answer: "I can only answer questions about the scam report table. Try asking about counts, trends or values in its columns.",
        sql: null,
        attempts: [],
        columnNames: [],
        rows: null,
        totalRows: 0,
        truncated: false,
      };
    }
    if (q.includes("everything") || q.includes("all rows")) {
      const rows = makeRows(MAX_RESULT_ROWS, 11);
      return sendResult(
        "This returns every report, so I've fetched the first 50,000. The sample I read is dominated by phishing and online shopping scams contacted by email and text message." +
          dictionaryNote,
        `SELECT * FROM ${TABLE}`,
        COLUMNS.map((c) => c.name),
        rows,
        { truncated: true },
      );
    }
    if (q.includes("delete") || q.includes("drop")) {
      return sendResult(
        "I can only read data, so I didn't change anything. Here are the 10 most recent reports instead.",
        `SELECT TOP 10 * FROM ${TABLE} ORDER BY date_reported DESC`,
        COLUMNS.map((c) => c.name),
        [...this.data].sort((a, b) => String(b.date_reported).localeCompare(String(a.date_reported))).slice(0, 10),
        {
          attempts: [
            { query: `DELETE FROM ${TABLE} WHERE is_loss = 0`, success: false, error: "'DELETE' is not allowed in a read-only query." },
            { query: `SELECT TOP 10 * FROM ${TABLE} ORDER BY date_reportd DESC`, success: false, error: "Invalid column name 'date_reportd'." },
          ],
        },
      );
    }
    if (q.includes("month")) {
      const counts = new Map<string, number>();
      this.data.forEach((row) => {
        const month = String(row.date_reported).slice(0, 7);
        counts.set(month, (counts.get(month) ?? 0) + 1);
      });
      const rows = Array.from(counts, ([month, report_count]) => ({ month, report_count })).sort((a, b) =>
        a.month.localeCompare(b.month),
      );
      return sendResult(
        `Reports by month${followUp}. Volumes are fairly steady at roughly ${Math.round(this.data.length / rows.length)} a month, with no single month standing out.` +
          dictionaryNote,
        `SELECT FORMAT(date_reported, 'yyyy-MM') AS month, COUNT(*) AS report_count\nFROM ${TABLE}\nGROUP BY FORMAT(date_reported, 'yyyy-MM')\nORDER BY month`,
        ["month", "report_count"],
        rows,
      );
    }
    if (q.includes("most common") || q.includes("top")) {
      const rows = countBy(this.data, "other_product_name", 10);
      return sendResult(
        `The most common value of **other_product_name** is **${rows[0].other_product_name}** with ${rows[0].report_count} reports. Blank values are shown as (blank).` +
          dictionaryNote,
        `SELECT TOP 10 ISNULL(other_product_name, '(blank)') AS other_product_name, COUNT(*) AS report_count\nFROM ${TABLE}\nGROUP BY other_product_name\nORDER BY report_count DESC`,
        ["other_product_name", "report_count"],
        rows,
      );
    }
    if (q.includes("kind of field") || q.includes("sample") || q.includes("describe")) {
      const rows = this.data.slice(0, 30).map((row) => ({ other_product_name: row.other_product_name }));
      return sendResult(
        "**other_product_name** is free text naming the product or service the scam involved, for example gift cards, cryptocurrency wallets or marketplace listings. It is often blank." +
          dictionaryNote,
        `SELECT TOP 30 other_product_name FROM ${TABLE} TABLESAMPLE (1 PERCENT)`,
        ["other_product_name"],
        rows,
      );
    }
    if (q.includes("how many") || q.includes("total") || q.includes("count")) {
      return sendResult(
        `There are **${this.data.length.toLocaleString("en-US")}** reports in the table${followUp}. Amounts like $1,200 or $500 display correctly.` +
          dictionaryNote,
        `SELECT COUNT(*) AS total_reports FROM ${TABLE}`,
        ["total_reports"],
        [{ total_reports: this.data.length }],
      );
    }
    const rows = this.data.slice(0, 25);
    return sendResult(
      `Here are 25 reports matching your question${followUp}. Ask about counts, trends or a specific column for a more focused answer.` +
        dictionaryNote,
      `SELECT TOP 25 * FROM ${TABLE}`,
      COLUMNS.map((c) => c.name),
      rows,
    );
  }
}
