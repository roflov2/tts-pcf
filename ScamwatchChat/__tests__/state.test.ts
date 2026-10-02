import { readFileSync } from "node:fs";
import { join } from "node:path";
import { columnKinds, filterRows, sortRows } from "../components/ResultsGrid";
import { ApiError } from "../services/apiClient";
import { compactForStorage, loadSettings, MAX_STORED_RESULT_CHARS, saveSettings, storageKeys } from "../state/storage";
import { activeDictionary, chatReducer, type ChatState, clampAttempts, clampPreviewRows, errorMessage, toAssistantMessage } from "../state/useChat";
import type { AssistantChatMessage, DataDictionary } from "../types";
import { DEFAULT_STRINGS } from "../utils/strings";

const initial: ChatState = {
  messages: [],
  pending: false,
  settings: { maxAttempts: 3, maxPreviewRows: 20, useHistory: true },
  uploaded: null,
};

const upload: DataDictionary = { name: "mine.txt", text: "my rules", truncated: false, source: "upload" };

describe("chatReducer", () => {
  it("adds the question and marks the chat pending, then adds the answer", () => {
    const asked = chatReducer(initial, { type: "ask", id: "1", question: "How many?" });
    expect(asked.pending).toBe(true);
    expect(asked.messages).toEqual([{ role: "user", id: "1", content: "How many?" }]);

    const answer = toAssistantMessage(
      { answer: "42", sql: "SELECT 42", attempts: [], columnNames: ["n"], rows: [{ n: 42 }], totalRows: 1, truncated: false },
      null,
    );
    const answered = chatReducer(asked, { type: "answer", message: answer });
    expect(answered.pending).toBe(false);
    expect(answered.messages).toHaveLength(2);
  });

  it("clears the conversation but keeps settings and the dictionary", () => {
    const state = { ...initial, uploaded: upload, messages: [{ role: "user" as const, id: "1", content: "q" }] };
    const cleared = chatReducer(state, { type: "clear" });
    expect(cleared.messages).toEqual([]);
    expect(cleared.uploaded).toBe(upload);
  });

  it("keeps attempts between 1 and 5 and preview rows between 5 and 200", () => {
    expect(chatReducer(initial, { type: "settings", settings: { maxAttempts: 9 } }).settings.maxAttempts).toBe(5);
    expect(chatReducer(initial, { type: "settings", settings: { useHistory: false } }).settings).toEqual({
      maxAttempts: 3,
      maxPreviewRows: 20,
      useHistory: false,
    });
    expect(clampAttempts(0)).toBe(1);
    expect(clampAttempts(null)).toBe(3);

    // Streamlit's number_input allowed 5–200.
    expect(chatReducer(initial, { type: "settings", settings: { maxPreviewRows: 250 } }).settings.maxPreviewRows).toBe(200);
    expect(chatReducer(initial, { type: "settings", settings: { maxPreviewRows: 3 } }).settings.maxPreviewRows).toBe(5);
    expect(clampPreviewRows(0)).toBe(5);
    expect(clampPreviewRows(null)).toBe(20);
    expect(clampPreviewRows(150)).toBe(150);
    expect(clampPreviewRows(7.4)).toBe(7);
  });
});

describe("activeDictionary", () => {
  const maker = { text: "Team rules\r\n\r\n\r\n", name: "Team dictionary" };

  it("prefers the user's upload over the app maker's dictionary", () => {
    expect(activeDictionary(upload, maker, true)).toBe(upload);
  });

  it("uses the maker's dictionary, tidied, when nothing is uploaded or uploads are off", () => {
    const expected = { name: "Team dictionary", text: "Team rules", truncated: false, source: "maker" };
    expect(activeDictionary(null, maker, true)).toEqual(expected);
    expect(activeDictionary(upload, maker, false)).toEqual(expected);
  });

  it("is null when there's nothing usable", () => {
    expect(activeDictionary(null, { text: "  \n ", name: "x" }, true)).toBeNull();
    expect(activeDictionary(upload, { text: null, name: null }, false)).toBeNull();
  });
});

describe("errorMessage", () => {
  it("explains a cancelled question without calling it a failure", () => {
    expect(errorMessage(new ApiError("aborted", "Cancelled.")).error).toMatch(/^Stopped before an answer/);
  });

  it("wraps other errors the way ask_agent did", () => {
    expect(errorMessage(new Error("boom")).error).toBe("The question couldn't be answered. boom");
  });
});

describe("compactForStorage", () => {
  it("drops result sets too large for session storage and marks the message", () => {
    const big: AssistantChatMessage = {
      ...toAssistantMessage(
        { answer: "a", sql: "s", attempts: [], columnNames: ["x"], rows: [{ x: "y".repeat(MAX_STORED_RESULT_CHARS) }], totalRows: 1, truncated: false },
        null,
      ),
    };
    const [stored] = compactForStorage([big]) as AssistantChatMessage[];
    expect(stored.rows).toBeNull();
    expect(stored.rowsDropped).toBe(true);
  });
});

describe("loadSettings", () => {
  it("returns the saved settings, dropping fields of the wrong type", () => {
    saveSettings("ns", { maxAttempts: 4, maxPreviewRows: 150, useHistory: false });
    expect(loadSettings("ns")).toEqual({ maxAttempts: 4, maxPreviewRows: 150, useHistory: false });

    window.sessionStorage.setItem(storageKeys("ns").settings, JSON.stringify({ maxAttempts: "9", useHistory: true }));
    expect(loadSettings("ns")).toEqual({ useHistory: true });
    expect(loadSettings("unused")).toEqual({});
  });
});

describe("sortRows", () => {
  const rows = [{ v: 10 }, { v: null }, { v: 2 }, { v: 33 }];

  it("sorts numbers numerically with blanks last in both directions", () => {
    expect(sortRows(rows, { column: "v", direction: "ascending" }).map((r) => r.v)).toEqual([2, 10, 33, null]);
    expect(sortRows(rows, { column: "v", direction: "descending" }).map((r) => r.v)).toEqual([33, 10, 2, null]);
  });

  it("sorts text naturally (item 2 before item 10)", () => {
    const text = [{ v: "item 10" }, { v: "Item 2" }, { v: "item 1" }];
    expect(sortRows(text, { column: "v", direction: "ascending" }).map((r) => r.v)).toEqual(["item 1", "Item 2", "item 10"]);
  });

  it("sorts booleans false first", () => {
    const flags = [{ v: true }, { v: false }, { v: null }, { v: true }];
    expect(sortRows(flags, { column: "v", direction: "ascending" }).map((r) => r.v)).toEqual([false, true, true, null]);
  });
});

describe("filterRows (dataframe search)", () => {
  const rows = [
    { name: "Gift cards", state: "NSW", amount: 120 },
    { name: "Puppy for sale", state: "VIC", amount: null },
    { name: null, state: "nsw", amount: 1200 },
  ];

  it("keeps rows where any cell contains the text, ignoring case", () => {
    expect(filterRows(rows, ["name", "state", "amount"], "  nsw ")).toEqual([rows[0], rows[2]]);
    expect(filterRows(rows, ["name", "state", "amount"], "120")).toEqual([rows[0], rows[2]]);
    expect(filterRows(rows, ["name"], "nsw")).toEqual([]);
  });

  it("returns every row for an empty search", () => {
    expect(filterRows(rows, ["name"], " ")).toBe(rows);
  });
});

describe("columnKinds", () => {
  it("marks all-number and all-boolean columns, ignoring blanks", () => {
    const rows = [
      { n: 1, b: true, t: "x", mixed: 1 },
      { n: null, b: false, t: null, mixed: "a" },
    ];
    expect(columnKinds(rows, ["n", "b", "t", "mixed", "absent"])).toEqual(["number", "boolean", "text", "text", "text"]);
  });
});

describe("resx", () => {
  it("has every UI string, so Power Apps shows the same text as the preview", () => {
    const resx = readFileSync(join(__dirname, "..", "strings", "ScamwatchChat.1033.resx"), "utf8");
    const missing = Object.keys(DEFAULT_STRINGS).filter((key) => !resx.includes(`<data name="${key}"`));
    expect(missing).toEqual([]);
  });

  it("has the same English text as the defaults, and no UI strings that are no longer used", () => {
    const resx = readFileSync(join(__dirname, "..", "strings", "ScamwatchChat.1033.resx"), "utf8");
    const unescape = (value: string) => value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    const entries = Object.fromEntries(
      Array.from(resx.matchAll(/<data name="(ui_[^"]+)"[^>]*>\s*<value>([\s\S]*?)<\/value>/g), (m) => [m[1], unescape(m[2])]),
    );
    expect(entries).toEqual(DEFAULT_STRINGS);
  });

  it("has a display name and description for every manifest property", () => {
    const manifest = readFileSync(join(__dirname, "..", "ControlManifest.Input.xml"), "utf8");
    const resx = readFileSync(join(__dirname, "..", "strings", "ScamwatchChat.1033.resx"), "utf8");
    const keys = Array.from(manifest.matchAll(/(?:display-name-key|description-key)="([^"]+)"/g), (m) => m[1]);
    expect(keys.filter((key) => !resx.includes(`<data name="${key}"`))).toEqual([]);
  });
});
