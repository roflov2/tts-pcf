import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sortRows } from "../components/ResultsGrid";
import { ApiError } from "../services/apiClient";
import { compactForStorage, MAX_STORED_RESULT_CHARS } from "../state/storage";
import { activeDictionary, chatReducer, type ChatState, clampAttempts, errorMessage, toAssistantMessage } from "../state/useChat";
import type { AssistantChatMessage, DataDictionary } from "../types";
import { DEFAULT_STRINGS } from "../utils/strings";

const initial: ChatState = {
  messages: [],
  pending: false,
  settings: { maxAttempts: 3, useHistory: true },
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

  it("keeps attempts between 1 and 5", () => {
    expect(chatReducer(initial, { type: "settings", settings: { maxAttempts: 9 } }).settings.maxAttempts).toBe(5);
    expect(chatReducer(initial, { type: "settings", settings: { useHistory: false } }).settings).toEqual({
      maxAttempts: 3,
      useHistory: false,
    });
    expect(clampAttempts(0)).toBe(1);
    expect(clampAttempts(null)).toBe(3);
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
});

describe("resx", () => {
  it("has every UI string, so Power Apps shows the same text as the preview", () => {
    const resx = readFileSync(join(__dirname, "..", "strings", "ScamwatchChat.1033.resx"), "utf8");
    const missing = Object.keys(DEFAULT_STRINGS).filter((key) => !resx.includes(`<data name="${key}"`));
    expect(missing).toEqual([]);
  });

  it("has a display name and description for every manifest property", () => {
    const manifest = readFileSync(join(__dirname, "..", "ControlManifest.Input.xml"), "utf8");
    const resx = readFileSync(join(__dirname, "..", "strings", "ScamwatchChat.1033.resx"), "utf8");
    const keys = Array.from(manifest.matchAll(/(?:display-name-key|description-key)="([^"]+)"/g), (m) => m[1]);
    expect(keys.filter((key) => !resx.includes(`<data name="${key}"`))).toEqual([]);
  });
});
