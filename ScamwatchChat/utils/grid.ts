/**
 * The table logic behind ResultsGrid (st.dataframe in app.py): sorting, search,
 * column widths and kinds, column order, pinning and hiding, and cell selection
 * with copy. Pure functions, so they're tested without rendering.
 */

import type { CellValue, Row } from "../types";
import { cellText } from "./format";

/** Automatic widths stay within these, so one long value doesn't swamp the table. */
export const MIN_COL = 80;
export const MAX_COL = 320;
/** Limits for a column the user resizes or autosizes. */
export const MIN_RESIZED_COL = 48;
export const MAX_RESIZED_COL = 1200;

export type SortDirection = "ascending" | "descending";
export interface SortState {
  column: string;
  direction: SortDirection;
}

/** How a column's values are shown: numbers right-aligned, booleans as checkboxes. */
export type ColumnKind = "number" | "boolean" | "text";

export function isMissing(value: CellValue | undefined): value is null | undefined {
  return value === null || value === undefined;
}

function compareValues(a: CellValue | undefined, b: CellValue | undefined): number {
  if (isMissing(a) || isMissing(b)) {
    return isMissing(a) === isMissing(b) ? 0 : isMissing(a) ? 1 : -1; // blanks last
  }
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  if (typeof a === "boolean" && typeof b === "boolean") {
    return Number(a) - Number(b);
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

/** Sort rows by a column; blanks always last. */
export function sortRows(rows: Row[], sort: SortState | null): Row[] {
  if (!sort) {
    return rows;
  }
  const sign = sort.direction === "ascending" ? 1 : -1;
  return [...rows].sort((x, y) => {
    const result = compareValues(x[sort.column], y[sort.column]);
    const blank = isMissing(x[sort.column]) || isMissing(y[sort.column]);
    return blank ? result : result * sign;
  });
}

/** Rows where any cell contains the query, ignoring case. */
export function filterRows(rows: Row[], columns: string[], query: string): Row[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return rows;
  }
  return rows.filter((row) => columns.some((column) => cellText(row[column]).toLowerCase().includes(needle)));
}

/** The width that fits a column's header and its first rows' text, up to max. */
export function autoWidth(rows: Row[], column: string, max: number = MAX_COL): number {
  const longest = rows
    .slice(0, 200)
    .reduce((widest, row) => Math.max(widest, cellText(row[column]).length), column.length + 2);
  return Math.min(max, Math.max(MIN_COL, Math.round(longest * 7.5 + 24)));
}

export function columnWidths(rows: Row[], columns: string[]): number[] {
  return columns.map((column) => autoWidth(rows, column));
}

/** A column is numeric or boolean when every non-blank value in the first rows is. */
export function columnKinds(rows: Row[], columns: string[]): ColumnKind[] {
  const sample = rows.slice(0, 200);
  return columns.map((column) => {
    const values = sample.map((row) => row[column]).filter((v) => !isMissing(v));
    if (values.length > 0 && values.every((v) => typeof v === "number")) return "number";
    if (values.length > 0 && values.every((v) => typeof v === "boolean")) return "boolean";
    return "text";
  });
}

// ------------------------------------------------------------ column layout

/** The user's changes to the columns: dragged order, hidden and pinned columns. */
export interface ColumnLayout {
  /** Column order after dragging, or null for the query's order. */
  order: string[] | null;
  hidden: string[];
  /** Pinned columns, shown first, in the order they were pinned. */
  pinned: string[];
}

export const DEFAULT_LAYOUT: ColumnLayout = { order: null, hidden: [], pinned: [] };

/** The columns to show, in order: pinned ones first, hidden ones left out. */
export function arrangeColumns(columns: string[], layout: ColumnLayout): string[] {
  const ordered = layout.order
    ? [...layout.order.filter((c) => columns.includes(c)), ...columns.filter((c) => !layout.order?.includes(c))]
    : columns;
  const visible = ordered.filter((c) => !layout.hidden.includes(c));
  const pinned = layout.pinned.filter((c) => visible.includes(c));
  return [...pinned, ...visible.filter((c) => !pinned.includes(c))];
}

/** Move a column to just before another one, or to the end when before is null. */
export function moveColumn(order: string[], column: string, before: string | null): string[] {
  if (column === before) {
    return order;
  }
  const rest = order.filter((c) => c !== column);
  const at = before === null ? -1 : rest.indexOf(before);
  return at === -1 ? [...rest, column] : [...rest.slice(0, at), column, ...rest.slice(at)];
}

// ------------------------------------------------------------- selection

export interface GridCell {
  row: number;
  col: number;
}

/** A block of cells, from where the selection started (anchor) to the active cell (focus). */
export interface GridSelection {
  anchor: GridCell;
  focus: GridCell;
}

export interface SelectionBounds {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export function selectionBounds(selection: GridSelection): SelectionBounds {
  const { anchor, focus } = selection;
  return {
    top: Math.min(anchor.row, focus.row),
    bottom: Math.max(anchor.row, focus.row),
    left: Math.min(anchor.col, focus.col),
    right: Math.max(anchor.col, focus.col),
  };
}

export function inBounds(bounds: SelectionBounds | null, row: number, col: number): boolean {
  return bounds !== null && row >= bounds.top && row <= bounds.bottom && col >= bounds.left && col <= bounds.right;
}

/** Keep a cell inside a rows × cols table. */
export function clampCell(cell: GridCell, rows: number, cols: number): GridCell {
  return {
    row: Math.min(Math.max(0, cell.row), Math.max(0, rows - 1)),
    col: Math.min(Math.max(0, cell.col), Math.max(0, cols - 1)),
  };
}

function tsvField(text: string): string {
  return /[\t\r\n"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The selected cells as tab-separated text, which Excel and Sheets paste as cells
 * (what st.dataframe puts on the clipboard). Blanks copy as empty cells.
 */
export function selectionToTsv(rows: Row[], columns: string[], bounds: SelectionBounds): string {
  const lines: string[] = [];
  for (let r = bounds.top; r <= bounds.bottom && r < rows.length; r++) {
    const cells: string[] = [];
    for (let c = bounds.left; c <= bounds.right && c < columns.length; c++) {
      cells.push(tsvField(cellText(rows[r][columns[c]])));
    }
    lines.push(cells.join("\t"));
  }
  return lines.join("\n");
}
