/**
 * Virtualised, sortable results table (st.dataframe in app.py). Only the rows on
 * screen are rendered, so 50,000-row results scroll smoothly.
 */

import * as React from "react";
import { FixedSizeList, type ListChildComponentProps } from "react-window";
import { makeStyles, mergeClasses, shorthands, tokens } from "@fluentui/react-components";
import { ArrowSortDown16Regular, ArrowSortUp16Regular } from "./icons";
import type { CellValue, Row } from "../types";
import { cellText, uniqueColumns } from "../utils/format";

const ROW_HEIGHT = 30;
const HEADER_HEIGHT = 32;
const MIN_COL = 80;
const MAX_COL = 320;

const useStyles = makeStyles({
  frame: {
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: "hidden",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 1,
    display: "flex",
    height: `${HEADER_HEIGHT}px`,
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2),
  },
  headerCell: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalXXS,
    boxSizing: "border-box",
    ...shorthands.padding(0, tokens.spacingHorizontalS),
    ...shorthands.border(0),
    backgroundColor: "transparent",
    color: tokens.colorNeutralForeground1,
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    textAlign: "left",
    cursor: "pointer",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    ":hover": { backgroundColor: tokens.colorNeutralBackground3Hover },
    ":focus-visible": { outlineStyle: "solid", outlineWidth: "2px", outlineColor: tokens.colorStrokeFocus2 },
  },
  row: {
    display: "flex",
    boxSizing: "border-box",
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke3),
  },
  rowAlt: { backgroundColor: tokens.colorNeutralBackground2 },
  cell: {
    boxSizing: "border-box",
    ...shorthands.padding(0, tokens.spacingHorizontalS),
    lineHeight: `${ROW_HEIGHT - 1}px`,
    fontSize: tokens.fontSizeBase200,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  numeric: { textAlign: "right", fontVariantNumeric: "tabular-nums" },
  empty: { ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS), color: tokens.colorNeutralForeground3 },
});

type SortDirection = "ascending" | "descending";
interface SortState {
  column: string;
  direction: SortDirection;
}

function compareValues(a: CellValue | undefined, b: CellValue | undefined): number {
  const aMissing = a === null || a === undefined;
  const bMissing = b === null || b === undefined;
  if (aMissing || bMissing) {
    return aMissing === bMissing ? 0 : aMissing ? 1 : -1; // blanks last
  }
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

/** Sort rows by a column; blanks always last. Exported for tests. */
export function sortRows(rows: Row[], sort: SortState | null): Row[] {
  if (!sort) {
    return rows;
  }
  const sign = sort.direction === "ascending" ? 1 : -1;
  return [...rows].sort((x, y) => {
    const result = compareValues(x[sort.column], y[sort.column]);
    const blank = [x[sort.column], y[sort.column]].some((v) => v === null || v === undefined);
    return blank ? result : result * sign;
  });
}

/** Column widths from the header and the first rows' text. Exported for tests. */
export function columnWidths(rows: Row[], columns: string[]): number[] {
  const sample = rows.slice(0, 200);
  return columns.map((column) => {
    const longest = sample.reduce((max, row) => Math.max(max, cellText(row[column]).length), column.length + 2);
    return Math.min(MAX_COL, Math.max(MIN_COL, longest * 7.5 + 24));
  });
}

interface GridData {
  rows: Row[];
  columns: string[];
  widths: number[];
  numeric: boolean[];
}

const HeaderContext = React.createContext<{ header: React.ReactNode; width: number }>({ header: null, width: 0 });

/** The list's inner element, with a sticky header above the absolutely positioned rows. */
const Inner = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function Inner(
  { children, style, ...rest },
  ref,
) {
  const { header, width } = React.useContext(HeaderContext);
  const height = Number(style?.height ?? 0) + HEADER_HEIGHT;
  return (
    <div ref={ref} {...rest} role="rowgroup" style={{ ...style, position: "relative", height, width, minWidth: "100%" }}>
      {header}
      {children}
    </div>
  );
});

function GridRow({ index, style, data }: ListChildComponentProps<GridData>) {
  const styles = useStyles();
  const row = data.rows[index];
  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      className={mergeClasses(styles.row, index % 2 === 1 && styles.rowAlt)}
      style={{ ...style, top: Number(style.top ?? 0) + HEADER_HEIGHT, width: "auto", minWidth: "100%" }}
    >
      {data.columns.map((column, c) => {
        const text = cellText(row[column]);
        return (
          <div
            key={column}
            role="cell"
            title={text.length > 30 ? text : undefined}
            className={mergeClasses(styles.cell, data.numeric[c] && styles.numeric)}
            style={{ width: data.widths[c], flex: `0 0 ${data.widths[c]}px` }}
          >
            {text}
          </div>
        );
      })}
    </div>
  );
}

export interface ResultsGridProps {
  rows: Row[];
  columnNames: string[];
  /** Maximum height in pixels; shorter results shrink to fit. */
  maxHeight?: number;
  ariaLabel: string;
}

export function ResultsGrid({ rows, columnNames, maxHeight = 360, ariaLabel }: ResultsGridProps) {
  const styles = useStyles();
  const [sort, setSort] = React.useState<SortState | null>(null);
  const columns = React.useMemo(() => uniqueColumns(columnNames), [columnNames]);
  const widths = React.useMemo(() => columnWidths(rows, columns), [rows, columns]);
  const numeric = React.useMemo(
    () =>
      columns.map((column) => {
        const values = rows.slice(0, 200).map((row) => row[column]).filter((v) => v !== null && v !== undefined);
        return values.length > 0 && values.every((v) => typeof v === "number");
      }),
    [rows, columns],
  );
  const sorted = React.useMemo(() => sortRows(rows, sort), [rows, sort]);
  const totalWidth = widths.reduce((sum, w) => sum + w, 0);

  const toggleSort = (column: string) =>
    setSort((current) => {
      if (!current || current.column !== column) return { column, direction: "ascending" };
      if (current.direction === "ascending") return { column, direction: "descending" };
      return null;
    });

  const header = (
    <div role="row" aria-rowindex={1} className={styles.header} style={{ width: totalWidth, minWidth: "100%" }}>
      {columns.map((column, c) => {
        const direction = sort?.column === column ? sort.direction : undefined;
        return (
          <button
            key={column}
            type="button"
            role="columnheader"
            aria-sort={direction ?? "none"}
            className={mergeClasses(styles.headerCell)}
            style={{ width: widths[c], flex: `0 0 ${widths[c]}px`, justifyContent: numeric[c] ? "flex-end" : "flex-start" }}
            onClick={() => toggleSort(column)}
            title={column}
          >
            {column}
            {direction === "ascending" && <ArrowSortUp16Regular aria-hidden />}
            {direction === "descending" && <ArrowSortDown16Regular aria-hidden />}
          </button>
        );
      })}
    </div>
  );

  const height = Math.min(maxHeight, HEADER_HEIGHT + Math.max(1, sorted.length) * ROW_HEIGHT + 2);
  const data: GridData = { rows: sorted, columns, widths, numeric };

  return (
    <div className={styles.frame} role="table" aria-label={ariaLabel} aria-rowcount={sorted.length + 1}>
      {sorted.length === 0 ? (
        <>
          <div style={{ overflowX: "auto" }}>{header}</div>
          <div className={styles.empty}>No rows.</div>
        </>
      ) : (
        <HeaderContext.Provider value={{ header, width: totalWidth }}>
          <FixedSizeList
            height={height}
            width="100%"
            itemCount={sorted.length}
            itemSize={ROW_HEIGHT}
            itemData={data}
            innerElementType={Inner}
            overscanCount={8}
          >
            {GridRow}
          </FixedSizeList>
        </HeaderContext.Provider>
      )}
    </div>
  );
}
