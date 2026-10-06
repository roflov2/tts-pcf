import type { AssistantChatMessage, ChatMessage } from "../types";
import {
  buildHistory,
  formatBytes,
  hardLineBreaks,
  LITERAL_STAR,
  LITERAL_UNDERSCORE,
  parseLines,
  protectIdentifiers,
  protectSpacedMarkers,
  restoreLiterals,
  rowLabel,
  toCsv,
  uniqueColumns,
} from "../utils/format";
import { createTranslator, DEFAULT_STRINGS, format } from "../utils/strings";

const assistant = (content: string, sql?: string | null): AssistantChatMessage => ({
  role: "assistant",
  id: Math.random().toString(),
  content,
  sql,
  attempts: [],
  columnNames: [],
  rows: null,
  totalRows: 0,
  truncated: false,
});
const user = (content: string): ChatMessage => ({ role: "user", id: Math.random().toString(), content });

describe("rowLabel (row_label)", () => {
  it.each([
    [0, false, "0 rows"],
    [1, false, "1 row"],
    [1, true, "1+ rows"],
    [12345, false, "12,345 rows"],
    [50000, true, "50,000+ rows"],
  ])("%d rows, truncated=%s → %s", (total, truncated, expected) => {
    expect(rowLabel(total, truncated)).toBe(expected);
  });
});

describe("buildHistory (build_history)", () => {
  it("appends the SQL each answer used", () => {
    expect(buildHistory([user("How many?"), assistant("42 reports.", "SELECT COUNT(*) FROM t")])).toEqual([
      { role: "user", content: "How many?" },
      { role: "assistant", content: "42 reports.\n\nSQL used:\nSELECT COUNT(*) FROM t" },
    ]);
  });

  it("keeps only the last N question/answer pairs", () => {
    const messages: ChatMessage[] = [];
    for (let i = 1; i <= 5; i++) {
      messages.push(user(`q${i}`), assistant(`a${i}`));
    }
    const history = buildHistory(messages, 3);
    expect(history).toHaveLength(6);
    expect(history[0]).toEqual({ role: "user", content: "q3" });
  });

  it("skips assistant turns with no text (errors)", () => {
    expect(buildHistory([user("q"), assistant("")])).toEqual([{ role: "user", content: "q" }]);
  });

  it("sends nothing when turns is 0", () => {
    expect(buildHistory([user("q"), assistant("a")], 0)).toEqual([]);
  });
});

describe("toCsv", () => {
  it("writes a BOM, a header and quoted fields where needed, with booleans as pandas writes them", () => {
    const csv = toCsv(
      [
        { name: 'Say "hi"', amount: 1200.5, note: "a,b", empty: null, flag: true },
        { name: "two\nlines", amount: 0, note: "", empty: null, flag: false },
      ],
      ["name", "amount", "note", "empty", "flag"],
    );
    expect(csv).toBe(
      '﻿name,amount,note,empty,flag\r\n"Say ""hi""",1200.5,"a,b",,True\r\n"two\nlines",0,,,False\r\n',
    );
  });

  it("drops duplicate column names", () => {
    expect(uniqueColumns(["a", "b", "a"])).toEqual(["a", "b"]);
    expect(toCsv([{ a: 1, b: 2 }], ["a", "b", "a"])).toBe("﻿a,b\r\n1,2\r\n");
  });
});

describe("parseLines", () => {
  it("splits example questions by line and drops blanks", () => {
    expect(parseLines("  one \r\n\ntwo\n")).toEqual(["one", "two"]);
    expect(parseLines(null)).toEqual([]);
  });
});

describe("strings", () => {
  it("fills numbered placeholders", () => {
    expect(format("{0} of {1}, {0} again, {2} missing", ["a", 2])).toBe("a of 2, a again, {2} missing");
  });

  it("uses the host's text when it has the key, and the default otherwise", () => {
    const t = createTranslator((key) => (key === "ui_Send" ? "Envoyer" : key));
    expect(t("ui_Send")).toBe("Envoyer");
    expect(t("ui_Cancel")).toBe(DEFAULT_STRINGS.ui_Cancel);
  });
});

describe("protectIdentifiers", () => {
  it("escapes underscores inside words but not italics or code", () => {
    expect(protectIdentifiers("**other_product_name** and _italic_ and snake__case")).toBe(
      "**other\\_product\\_name** and _italic_ and snake\\_\\_case",
    );
    expect(protectIdentifiers("use `report_id` or\n```sql\nSELECT a_b\n```\nthen amount_lost")).toBe(
      "use `report_id` or\n```sql\nSELECT a_b\n```\nthen amount\\_lost",
    );
  });
});

describe("protectSpacedMarkers", () => {
  it("keeps * and _ with spaces on both sides literal, as CommonMark does", () => {
    const S = LITERAL_STAR;
    expect(protectSpacedMarkers("count(*) and SELECT * FROM t")).toBe(`count(*) and SELECT ${S} FROM t`);
    expect(protectSpacedMarkers("5 * 3 ** 2 and x _ y")).toBe(`5 ${S} 3 ${S}${S} 2 and x ${LITERAL_UNDERSCORE} y`);
    expect(restoreLiterals(protectSpacedMarkers("5 * 3 _ 2"))).toBe("5 * 3 _ 2");
  });

  it("leaves emphasis, list bullets and code alone", () => {
    const text = "*rate* and **bold**\n* item\n  * nested\n`a * b`\n```\nSELECT * FROM t\n```";
    expect(protectSpacedMarkers(text)).toBe(text);
  });
});

describe("hardLineBreaks", () => {
  it("turns single line breaks into markdown line breaks outside code", () => {
    expect(hardLineBreaks("one\ntwo\n\nthree")).toBe("one  \ntwo\n\nthree");
    expect(hardLineBreaks("```\na\nb\n```")).toBe("```\na\nb\n```");
  });
});

describe("formatBytes", () => {
  it.each([
    [512, "512 B"],
    [4200, "4.2 KB"],
    [1_000_000, "1.0 MB"],
  ])("%d → %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});
