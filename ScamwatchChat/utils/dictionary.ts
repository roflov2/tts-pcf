/**
 * Data dictionary helpers, ported from the Streamlit app (app.py) and the agent
 * (text_to_sql_agent.py). Keep them behaviour-identical to their Python twins:
 * the server runs prepare_data_dictionary again, and users should see the same
 * counts and warnings they saw in Streamlit.
 */

import type { ColumnInfo, DataDictionary } from "../types";

/** MAX_DICTIONARY_CHARS in text_to_sql_agent.py. The server's /schema limits win when present. */
export const DEFAULT_MAX_DICTIONARY_CHARS = 40_000;
/** MAX_DICTIONARY_UPLOAD_BYTES in app.py. */
export const MAX_DICTIONARY_UPLOAD_BYTES = 1_000_000;

/** cp1252 characters for bytes 0x80–0x9F; null where cp1252 leaves the byte undefined. */
const CP1252_HIGH: (number | null)[] = [
  0x20ac, null, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, null, 0x017d, null,
  null, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, null, 0x017e, 0x0178,
];

/**
 * Python's cp1252 decode, falling back to latin-1 for the whole text when a byte
 * is undefined in cp1252 (as decode_text does). Done by table because Node's
 * TextDecoder treats windows-1252 as latin-1, unlike browsers.
 */
function decodeSingleByte(raw: Uint8Array): string {
  const isCp1252 = raw.every((b) => b < 0x80 || b > 0x9f || CP1252_HIGH[b - 0x80] !== null);
  let out = "";
  for (let i = 0; i < raw.length; i += 0x2000) {
    const chunk = Array.from(raw.subarray(i, i + 0x2000), (b) =>
      isCp1252 && b >= 0x80 && b <= 0x9f ? (CP1252_HIGH[b - 0x80] as number) : b,
    );
    out += String.fromCharCode(...chunk);
  }
  return out;
}

/**
 * Decode an uploaded text file, allowing for the encodings Windows tools save in.
 * Python twin: decode_text (app.py).
 */
export function decodeText(raw: Uint8Array): string {
  if (raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(raw); // Notepad's "Unicode" option
  }
  if (raw.length >= 2 && raw[0] === 0xfe && raw[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(raw);
  }
  try {
    // Fatal mode fails on invalid UTF-8; a leading BOM is dropped, as with Python's utf-8-sig.
    return new TextDecoder("utf-8", { fatal: true }).decode(raw);
  } catch {
    return decodeSingleByte(raw);
  }
}

export interface PreparedDictionary {
  text: string;
  truncated: boolean;
}

/**
 * Tidy a data dictionary for the prompt and cap its length.
 *
 * Line endings are normalised, trailing spaces and runs of blank lines are
 * dropped, and anything past maxChars is cut at the last line break so no entry
 * is left half-written. Running it twice gives the same result. Lengths count
 * code points, like Python's len().
 * Python twin: prepare_data_dictionary (text_to_sql_agent.py).
 */
export function prepareDataDictionary(
  text: string,
  maxChars: number = DEFAULT_MAX_DICTIONARY_CHARS,
): PreparedDictionary {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const tidy = lines
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const chars = Array.from(tidy);
  if (chars.length <= maxChars) {
    return { text: tidy, truncated: false };
  }
  const cut = chars.slice(0, maxChars + 1).lastIndexOf("\n");
  return { text: chars.slice(0, cut > 0 ? cut : maxChars).join("").trimEnd(), truncated: true };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Return the column names that appear in text as whole words, ignoring case.
 * Python twin: columns_mentioned (app.py).
 */
export function columnsMentioned(text: string, columnNames: Iterable<string>): Set<string> {
  const found = new Set<string>();
  for (const name of columnNames) {
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(name)}(?![\\p{L}\\p{N}_])`, "iu");
    if (pattern.test(text)) {
      found.add(name);
    }
  }
  return found;
}

export type ReadDictionaryResult =
  | { dictionary: DataDictionary; problem?: undefined }
  | { dictionary?: undefined; problem: string };

/**
 * Turn an uploaded file into a DataDictionary, or explain why it can't be used.
 * Python twin: read_dictionary (app.py).
 */
export function readDictionary(
  fileName: string,
  raw: Uint8Array,
  maxChars: number = DEFAULT_MAX_DICTIONARY_CHARS,
): ReadDictionaryResult {
  if (raw.length > MAX_DICTIONARY_UPLOAD_BYTES) {
    const limitMb = MAX_DICTIONARY_UPLOAD_BYTES / 1_000_000;
    return {
      problem: `${fileName} is ${(raw.length / 1_000_000).toFixed(1)} MB. Upload a text file under ${limitMb} MB.`,
    };
  }
  const { text, truncated } = prepareDataDictionary(decodeText(raw), maxChars);
  if (!text) {
    return { problem: `${fileName} is empty. Add descriptions of the columns and upload it again.` };
  }
  return { dictionary: { name: fileName, text, truncated, source: "upload" } };
}

/**
 * A starter data dictionary that already lists every column in the table.
 * Python twin: dictionary_template (app.py).
 */
export function dictionaryTemplate(table: string, columns: ColumnInfo[]): string {
  const lines = [
    `Data dictionary for ${table}`,
    "",
    "Everything in this file is sent to the assistant with each question. Write what a new",
    "analyst would need to know to query this table correctly. Any layout works. Delete these",
    "notes and any section you don't need.",
    "",
    "== About the table ==",
    "One row represents:",
    "Rows to leave out unless someone asks for them (test data, duplicates, withdrawn records):",
    "",
    "== Columns ==",
    "After each column, add what it means, its units, what its codes stand for, and how to",
    "read blanks or NULLs. Columns you leave blank are fine to keep or delete.",
    "",
    ...columns.map(({ name, type }) => `${name} (${type}):`),
    "",
    "== Terms ==",
    'How everyday terms map to the data, for example: "a loss report is one where <column> > 0".',
    "",
    "== Example questions and the SQL that answers them ==",
    "Q:",
    "SQL:",
  ];
  return lines.join("\n") + "\n";
}

/** Python twin: template_file_name (app.py). */
export function templateFileName(table: string): string {
  return "data_dictionary_" + table.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "") + ".txt";
}
