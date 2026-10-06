/** Formatting helpers ported from the Streamlit app (app.py), plus browser download helpers. */

import type { CellValue, ChatMessage, HistoryMessage, Row } from "../types";

/** HISTORY_TURNS in app.py: question/answer pairs sent back to the model for follow-ups. */
export const DEFAULT_HISTORY_TURNS = 3;

const numberFormat = new Intl.NumberFormat("en-US");

export function formatCount(value: number): string {
  return numberFormat.format(value);
}

/**
 * "1 row", "12 rows", "50,000+ rows".
 * Python twin: row_label (app.py).
 */
export function rowLabel(totalRows: number, truncated: boolean): string {
  const plus = truncated ? "+" : "";
  return `${formatCount(totalRows)}${plus} row` + (totalRows === 1 && !plus ? "" : "s");
}

/**
 * Turn recent chat turns into model messages, including the SQL each answer used.
 * Python twin: build_history (app.py).
 */
export function buildHistory(
  messages: ChatMessage[],
  turns: number = DEFAULT_HISTORY_TURNS,
): HistoryMessage[] {
  if (turns <= 0) {
    return [];
  }
  const history: HistoryMessage[] = [];
  for (const message of messages.slice(-turns * 2)) {
    if (message.role === "user") {
      history.push({ role: "user", content: message.content });
    } else if (message.content) {
      let text = message.content;
      if (message.sql) {
        text += `\n\nSQL used:\n${message.sql}`;
      }
      history.push({ role: "assistant", content: text });
    }
  }
  return history;
}

/** Column names with duplicates removed, keeping the first (to_dataframe in app.py). */
export function uniqueColumns(columnNames: string[]): string[] {
  return Array.from(new Set(columnNames));
}

/** Column names for rows that came without a column list (sample rows). */
export function columnsFromRows(rows: Row[]): string[] {
  const names = new Set<string>();
  for (const row of rows) {
    Object.keys(row).forEach((key) => names.add(key));
  }
  return Array.from(names);
}

/** How a cell is shown in the grid and written to CSV. */
export function cellText(value: CellValue | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** A cell as pandas' to_csv writes it: booleans as True/False, blanks empty. */
function csvValue(value: CellValue | undefined): string {
  return typeof value === "boolean" ? (value ? "True" : "False") : cellText(value);
}

/**
 * A CSV file with a UTF-8 byte order mark, so Excel opens it with the right encoding
 * (the Streamlit app used frame.to_csv(...).encode("utf-8-sig") for the same reason).
 */
export function toCsv(rows: Row[], columnNames: string[]): string {
  const columns = uniqueColumns(columnNames);
  const lines = [columns.map(csvField).join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => csvField(csvValue(row[column]))).join(","));
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/**
 * Save text as a file through a temporary link.
 *
 * Returns false when the browser or host frame refused, so callers can offer
 * copy-to-clipboard instead.
 */
export function downloadText(fileName: string, text: string, mimeType: string): boolean {
  try {
    const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch {
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** A table name made safe for a file name: Reporting.My Table → Reporting_My_Table. */
export function safeFileStem(name: string): string {
  return name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "export";
}

/** Example questions from the manifest property: one per line, blank lines ignored. */
export function parseLines(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** A short random id for React keys and storage. */
export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Apply fn to the parts of some markdown that aren't code spans or fenced blocks. */
function outsideCode(markdown: string, fn: (text: string) => string): string {
  return markdown
    .split(/(```[\s\S]*?```|`[^`\n]*`)/)
    .map((part, i) => (i % 2 === 1 ? part : fn(part)))
    .join("");
}

/**
 * Escape underscores inside words (column names like other_product_name) so the
 * markdown renderer doesn't read them as italics. Code spans and fenced blocks
 * are left alone, since backslashes would show there.
 */
export function protectIdentifiers(markdown: string): string {
  return outsideCode(markdown, (text) =>
    text.replace(/(?<=[\p{L}\p{N}])_+(?=[\p{L}\p{N}])/gu, (run) => run.replace(/_/g, "\\_")),
  );
}

/** Private-use stand-ins for literal * and _. MarkdownText turns them back when it renders text. */
export const LITERAL_STAR = "";
export const LITERAL_UNDERSCORE = "";

/**
 * Keep * and _ with spaces on both sides (SELECT * FROM, 5 * 3) literal. CommonMark,
 * which Streamlit used, never reads those as emphasis, but markdown-to-jsx pairs
 * them with any other * in the text. Backslash escapes don't stop that, so they're
 * swapped for placeholders that restoreLiterals puts back. List bullets are kept.
 */
export function protectSpacedMarkers(markdown: string): string {
  return outsideCode(markdown, (text) =>
    text.replace(/(?<=[^\s*_][ \t]+)[*_]+(?=[ \t])/g, (run) =>
      run.replace(/\*/g, LITERAL_STAR).replace(/_/g, LITERAL_UNDERSCORE),
    ),
  );
}

export function restoreLiterals(text: string): string {
  return text.replace(//g, "*").replace(//g, "_");
}

/** Show each line break the user typed (Shift+Enter) instead of joining the lines. */
export function hardLineBreaks(markdown: string): string {
  return outsideCode(markdown, (text) => text.replace(/([^\n])[ \t]*\n(?=[^\n])/g, "$1  \n"));
}

/** "512 B", "4.2 KB", "1.0 MB", as Streamlit's file uploader shows sizes. */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) {
    return `${bytes} B`;
  }
  if (bytes < 1_000_000) {
    return `${(bytes / 1000).toFixed(1)} KB`;
  }
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
