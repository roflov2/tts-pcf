import {
  arrangeColumns,
  autoWidth,
  clampCell,
  DEFAULT_LAYOUT,
  inBounds,
  MAX_COL,
  MAX_RESIZED_COL,
  MIN_COL,
  moveColumn,
  selectionBounds,
  selectionToTsv,
} from "../utils/grid";

describe("arrangeColumns (st.dataframe column order, pinning and hiding)", () => {
  const columns = ["a", "b", "c", "d"];

  it("keeps the query's order by default", () => {
    expect(arrangeColumns(columns, DEFAULT_LAYOUT)).toEqual(columns);
  });

  it("puts pinned columns first in pin order and leaves hidden ones out", () => {
    expect(arrangeColumns(columns, { order: null, hidden: ["b"], pinned: ["d", "c"] })).toEqual(["d", "c", "a"]);
  });

  it("follows a dragged order, dropping gone columns and appending new ones", () => {
    expect(arrangeColumns(["a", "b", "c", "e"], { order: ["c", "x", "a", "b"], hidden: [], pinned: [] })).toEqual([
      "c",
      "a",
      "b",
      "e",
    ]);
  });

  it("ignores pins on hidden columns", () => {
    expect(arrangeColumns(columns, { order: null, hidden: ["a"], pinned: ["a"] })).toEqual(["b", "c", "d"]);
  });
});

describe("moveColumn", () => {
  it("moves a column before another, or to the end", () => {
    expect(moveColumn(["a", "b", "c", "d"], "d", "b")).toEqual(["a", "d", "b", "c"]);
    expect(moveColumn(["a", "b", "c"], "a", "c")).toEqual(["b", "a", "c"]);
    expect(moveColumn(["a", "b", "c"], "a", null)).toEqual(["b", "c", "a"]);
    expect(moveColumn(["a", "b"], "a", "a")).toEqual(["a", "b"]);
  });
});

describe("autoWidth", () => {
  const rows = [{ short: "x", long: "y".repeat(100) }];

  it("fits the text, within limits that autosize can go past", () => {
    expect(autoWidth(rows, "short")).toBe(MIN_COL);
    expect(autoWidth(rows, "long")).toBe(MAX_COL);
    expect(autoWidth(rows, "long", MAX_RESIZED_COL)).toBe(Math.round(100 * 7.5 + 24));
  });
});

describe("cell selection", () => {
  const rows = [
    { name: "Gift cards", amount: 120, note: "tab\there", flag: true },
    { name: 'Say "hi"', amount: null, note: "two\nlines", flag: false },
    { name: "Puppy", amount: 3, note: "", flag: null },
  ];
  const columns = ["name", "amount", "note", "flag"];

  it("works out the block between the anchor and the active cell in any direction", () => {
    const bounds = selectionBounds({ anchor: { row: 2, col: 3 }, focus: { row: 0, col: 1 } });
    expect(bounds).toEqual({ top: 0, bottom: 2, left: 1, right: 3 });
    expect(inBounds(bounds, 1, 2)).toBe(true);
    expect(inBounds(bounds, 1, 0)).toBe(false);
    expect(inBounds(null, 0, 0)).toBe(false);
  });

  it("keeps the active cell inside the table", () => {
    expect(clampCell({ row: -1, col: 9 }, 3, 4)).toEqual({ row: 0, col: 3 });
    expect(clampCell({ row: 5, col: -2 }, 3, 4)).toEqual({ row: 2, col: 0 });
  });

  it("copies as tab-separated text that spreadsheets paste as cells", () => {
    expect(selectionToTsv(rows, columns, { top: 0, bottom: 1, left: 0, right: 1 })).toBe('Gift cards\t120\n"Say ""hi"""\t');
    expect(selectionToTsv(rows, columns, { top: 0, bottom: 2, left: 2, right: 3 })).toBe(
      '"tab\there"\ttrue\n"two\nlines"\tfalse\n\t',
    );
  });
});
