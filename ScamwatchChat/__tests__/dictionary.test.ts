/**
 * Expected values were produced by running the Python originals (app.py and
 * text_to_sql_agent.py) on the same inputs, so these tests pin parity.
 */

import {
  columnsMentioned,
  decodeText,
  dictionaryTemplate,
  MAX_DICTIONARY_UPLOAD_BYTES,
  prepareDataDictionary,
  readDictionary,
  templateFileName,
} from "../utils/dictionary";

const bytes = (...values: number[]) => new Uint8Array(values);
const utf8 = (text: string) => new TextEncoder().encode(text);

describe("decodeText (decode_text)", () => {
  it("reads UTF-16 LE with a BOM (Notepad's 'Unicode')", () => {
    expect(decodeText(bytes(0xff, 0xfe, 0xe9, 0x00, 0x20, 0x00, 0x6f, 0x00, 0x6b, 0x00))).toBe("é ok");
  });

  it("reads UTF-16 BE with a BOM", () => {
    expect(decodeText(bytes(0xfe, 0xff, 0x00, 0x68, 0x00, 0x69))).toBe("hi");
  });

  it("reads UTF-8 with and without a BOM, dropping the BOM", () => {
    expect(decodeText(bytes(0xef, 0xbb, 0xbf, ...utf8("café")))).toBe("café");
    expect(decodeText(utf8("café"))).toBe("café");
  });

  it("falls back to Windows-1252 for smart quotes and dashes", () => {
    expect(decodeText(bytes(0x93, ...utf8("quoted"), 0x94, 0x20, 0x96, ...utf8(" dash")))).toBe("“quoted” – dash");
  });

  it("maps bytes undefined in cp1252 like latin-1 does", () => {
    expect(decodeText(bytes(0x61, 0x81, 0x62))).toBe("a\u0081b");
  });
});

describe("prepareDataDictionary (prepare_data_dictionary)", () => {
  it("normalises line endings, trailing spaces and blank-line runs", () => {
    expect(prepareDataDictionary("  a  \r\nb\t\r\n\r\n\r\n\r\nc\rd  \n\n\n")).toEqual({ text: "a\nb\n\nc\nd", truncated: false });
  });

  it("cuts at the last line break within the limit", () => {
    expect(prepareDataDictionary("line one\nline two\nline three", 15)).toEqual({ text: "line one", truncated: true });
    expect(prepareDataDictionary("ab\ncd\nef", 5)).toEqual({ text: "ab\ncd", truncated: true });
  });

  it("cuts mid-line when there's no line break to cut at", () => {
    expect(prepareDataDictionary("abcdefghij", 4)).toEqual({ text: "abcd", truncated: true });
    expect(prepareDataDictionary("\nabcdefghij", 4)).toEqual({ text: "abcd", truncated: true });
  });

  it("counts code points like Python's len()", () => {
    expect(prepareDataDictionary("x😀y\nz", 3)).toEqual({ text: "x😀y", truncated: true });
  });

  it("is idempotent", () => {
    const once = prepareDataDictionary("a  \n\n\n\nb\r\nc\n".repeat(50), 120).text;
    expect(prepareDataDictionary(once, 120).text).toBe(once);
  });
});

describe("columnsMentioned (columns_mentioned)", () => {
  const sorted = (set: Set<string>) => Array.from(set).sort();

  it("matches whole words, ignoring case", () => {
    const text = "REPORT_ID is the key. scam_type: category. amount_lost.";
    expect(sorted(columnsMentioned(text, ["report_id", "scam_type", "amount_lost", "report", "state"]))).toEqual([
      "amount_lost",
      "report_id",
      "scam_type",
    ]);
  });

  it("doesn't match inside longer identifiers", () => {
    expect(sorted(columnsMentioned("see report_id2 and _state and state_x", ["report_id", "state"]))).toEqual([]);
  });

  it("escapes regex characters in column names", () => {
    expect(sorted(columnsMentioned("cost (aud) means dollars; a.b is odd", ["cost (aud)", "a.b", "ab"]))).toEqual([
      "a.b",
      "cost (aud)",
    ]);
  });

  it("treats accented letters as word characters, like Python's Unicode \\w", () => {
    expect(sorted(columnsMentioned("Île column naïve_col", ["naïve_col", "le"]))).toEqual(["naïve_col"]);
  });
});

describe("readDictionary (read_dictionary)", () => {
  it("rejects files over 1 MB", () => {
    const raw = new Uint8Array(MAX_DICTIONARY_UPLOAD_BYTES + 1);
    expect(readDictionary("big.txt", raw).problem).toBe("big.txt is 1.0 MB. Upload a text file under 1 MB.");
  });

  it("rejects files that are empty after tidying", () => {
    expect(readDictionary("blank.txt", utf8(" \r\n\n  \n")).problem).toBe(
      "blank.txt is empty. Add descriptions of the columns and upload it again.",
    );
  });

  it("returns a tidied, possibly truncated dictionary", () => {
    const result = readDictionary("dict.txt", utf8("a\nb\nc"), 3);
    expect(result.dictionary).toEqual({ name: "dict.txt", text: "a\nb", truncated: true, source: "upload" });
  });
});

describe("dictionaryTemplate and templateFileName", () => {
  it("lists every column under the Columns heading", () => {
    const text = dictionaryTemplate("Reporting.T", [
      { name: "report_id", type: "int" },
      { name: "state", type: "nvarchar" },
    ]);
    expect(text.startsWith("Data dictionary for Reporting.T\n\n")).toBe(true);
    expect(text).toContain("== Columns ==");
    expect(text).toContain("\nreport_id (int):\nstate (nvarchar):\n\n== Terms ==");
    expect(text.endsWith("Q:\nSQL:\n")).toBe(true);
  });

  it("makes a safe file name from the table name", () => {
    expect(templateFileName("Reporting.ScamWatchReportFiltered")).toBe("data_dictionary_Reporting_ScamWatchReportFiltered.txt");
    expect(templateFileName("[dbo].[My Table]")).toBe("data_dictionary_dbo_My_Table.txt");
  });
});

describe("decodeText fallback parity", () => {
  it("decodes the whole file as latin-1 when any byte is undefined in cp1252, like Python", () => {
    // Python: b"\x93hi\x81".decode("cp1252") fails, so latin-1 maps 0x93 to U+0093 too.
    expect(decodeText(new Uint8Array([0x93, 0x68, 0x69, 0x81]))).toBe("\u0093hi\u0081");
  });
});
