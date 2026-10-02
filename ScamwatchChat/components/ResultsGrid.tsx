/**
 * Virtualised results table (st.dataframe in app.py). Like st.dataframe it sorts by
 * column, resizes columns by dragging their edges, searches, opens full screen,
 * and shows booleans as checkboxes and missing values as a muted "None". Only
 * the rows on screen are rendered, so 50,000-row results scroll smoothly.
 */

import * as React from "react";
import { FixedSizeList, type ListChildComponentProps } from "react-window";
import {
  Button,
  Caption1,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
  makeStyles,
  mergeClasses,
  shorthands,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import {
  ArrowDownload16Regular,
  ArrowSortDown16Regular,
  ArrowSortUp16Regular,
  CheckboxChecked16Regular,
  CheckboxUnchecked16Regular,
  Dismiss20Regular,
  FullScreenMaximize16Regular,
  Search16Regular,
} from "./icons";
import type { CellValue, Row } from "../types";
import { cellText, downloadText, formatCount, toCsv, uniqueColumns } from "../utils/format";
import { useStrings } from "../utils/strings";

const ROW_HEIGHT = 30;
const HEADER_HEIGHT = 32;
const MIN_COL = 80;
const MAX_COL = 320;
/** Limits for a column the user resizes. */
export const MIN_RESIZED_COL = 48;
export const MAX_RESIZED_COL = 1200;
const RESIZE_STEP = 16;
const SEARCH_DELAY_MS = 150;

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", rowGap: tokens.spacingVerticalXS, minWidth: 0 },
  toolbar: { display: "flex", alignItems: "center", columnGap: tokens.spacingHorizontalS, minHeight: "24px" },
  search: { flexGrow: 1, maxWidth: "320px", minWidth: "120px" },
  note: { color: tokens.colorNeutralForeground3, whiteSpace: "nowrap" },
  toolbarButtons: { display: "flex", columnGap: tokens.spacingHorizontalXXS, marginLeft: "auto", flexShrink: 0 },
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
    position: "relative",
    display: "flex",
    boxSizing: "border-box",
    ...shorthands.borderRight("1px", "solid", tokens.colorNeutralStroke3),
  },
  sortButton: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalXXS,
    flexGrow: 1,
    minWidth: 0,
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
    ":hover": { backgroundColor: tokens.colorNeutralBackground3Hover },
    ":focus-visible": { outlineStyle: "solid", outlineWidth: "2px", outlineColor: tokens.colorStrokeFocus2 },
  },
  headerText: { overflow: "hidden", textOverflow: "ellipsis" },
  resizer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: "6px",
    zIndex: 2,
    cursor: "col-resize",
    touchAction: "none",
    ":hover": { backgroundColor: tokens.colorNeutralStroke1 },
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
  boolean: { textAlign: "center" },
  check: { display: "inline-flex", verticalAlign: "middle", fontSize: "16px", color: tokens.colorNeutralForeground2 },
  missing: { color: tokens.colorNeutralForeground4 },
  mark: { backgroundColor: tokens.colorPaletteYellowBackground3, color: "inherit" },
  empty: { ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS), color: tokens.colorNeutralForeground3 },
  dialogSurface: {
    width: "calc(100vw - 48px)",
    maxWidth: "calc(100vw - 48px)",
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
  },
  dialogContent: { display: "flex", flexDirection: "column", rowGap: tokens.spacingVerticalXS },
});

type SortDirection = "ascending" | "descending";
interface SortState {
  column: string;
  direction: SortDirection;
}

/** How a column's values are shown: numbers right-aligned, booleans as checkboxes. */
export type ColumnKind = "number" | "boolean" | "text";

function isMissing(value: CellValue | undefined): value is null | undefined {
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

/** Sort rows by a column; blanks always last. Exported for tests. */
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

/** Rows where any cell contains the query, ignoring case. Exported for tests. */
export function filterRows(rows: Row[], columns: string[], query: string): Row[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return rows;
  }
  return rows.filter((row) => columns.some((column) => cellText(row[column]).toLowerCase().includes(needle)));
}

/** Column widths from the header and the first rows' text. Exported for tests. */
export function columnWidths(rows: Row[], columns: string[]): number[] {
  const sample = rows.slice(0, 200);
  return columns.map((column) => {
    const longest = sample.reduce((max, row) => Math.max(max, cellText(row[column]).length), column.length + 2);
    return Math.min(MAX_COL, Math.max(MIN_COL, longest * 7.5 + 24));
  });
}

/** A column is numeric or boolean when every non-blank value in the first rows is. Exported for tests. */
export function columnKinds(rows: Row[], columns: string[]): ColumnKind[] {
  const sample = rows.slice(0, 200);
  return columns.map((column) => {
    const values = sample.map((row) => row[column]).filter((v) => !isMissing(v));
    if (values.length > 0 && values.every((v) => typeof v === "number")) return "number";
    if (values.length > 0 && values.every((v) => typeof v === "boolean")) return "boolean";
    return "text";
  });
}

/** Wrap each match of needle (already lower case) in <mark>. */
function highlight(text: string, needle: string, className: string): React.ReactNode {
  if (!needle) {
    return text;
  }
  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, from)) {
    parts.push(text.slice(from, at));
    parts.push(
      <mark key={at} className={className}>
        {text.slice(at, at + needle.length)}
      </mark>,
    );
    from = at + needle.length;
  }
  parts.push(text.slice(from));
  return parts;
}

interface GridData {
  rows: Row[];
  columns: string[];
  widths: number[];
  kinds: ColumnKind[];
  needle: string;
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
  const t = useStrings();
  const row = data.rows[index];
  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      className={mergeClasses(styles.row, index % 2 === 1 && styles.rowAlt)}
      style={{ ...style, top: Number(style.top ?? 0) + HEADER_HEIGHT, width: "auto", minWidth: "100%" }}
    >
      {data.columns.map((column, c) => {
        const value = row[column];
        const kind = data.kinds[c];
        let content: React.ReactNode;
        let title: string | undefined;
        if (isMissing(value)) {
          content = <span className={styles.missing}>{t("ui_NullCell")}</span>;
        } else if (typeof value === "boolean") {
          content = (
            <span role="img" aria-label={value ? t("ui_Yes") : t("ui_No")} className={styles.check}>
              {value ? <CheckboxChecked16Regular /> : <CheckboxUnchecked16Regular />}
            </span>
          );
        } else {
          const text = cellText(value);
          content = highlight(text, data.needle, styles.mark);
          title = text.length > 30 ? text : undefined;
        }
        return (
          <div
            key={column}
            role="cell"
            title={title}
            className={mergeClasses(styles.cell, kind === "number" && styles.numeric, kind === "boolean" && styles.boolean)}
            style={{ width: data.widths[c], flex: `0 0 ${data.widths[c]}px` }}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}

interface GridBodyProps extends GridData {
  sort: SortState | null;
  height: number;
  ariaLabel: string;
  /** True when there are rows but the search matched none of them. */
  noMatches: boolean;
  onSort: (column: string) => void;
  onResize: (column: string, width: number) => void;
}

function GridBody(props: GridBodyProps) {
  const { rows, columns, widths, kinds, sort, height, ariaLabel, noMatches, onSort, onResize } = props;
  const styles = useStyles();
  const t = useStrings();
  const totalWidth = widths.reduce((sum, w) => sum + w, 0);

  /** Drag a column's right edge. Pointer capture keeps the drag going outside the handle. */
  const startResize = (event: React.PointerEvent<HTMLDivElement>, column: string, width: number) => {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    const startX = event.clientX;
    handle.setPointerCapture?.(event.pointerId);
    const move = (e: PointerEvent) => onResize(column, width + e.clientX - startX);
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };

  const header = (
    <div role="row" aria-rowindex={1} className={styles.header} style={{ width: totalWidth, minWidth: "100%" }}>
      {columns.map((column, c) => {
        const direction = sort?.column === column ? sort.direction : undefined;
        const align = kinds[c] === "number" ? "flex-end" : kinds[c] === "boolean" ? "center" : "flex-start";
        return (
          <div
            key={column}
            role="columnheader"
            aria-sort={direction ?? "none"}
            className={styles.headerCell}
            style={{ width: widths[c], flex: `0 0 ${widths[c]}px` }}
          >
            <button
              type="button"
              className={styles.sortButton}
              style={{ justifyContent: align }}
              onClick={() => onSort(column)}
              title={column}
            >
              <span className={styles.headerText}>{column}</span>
              {direction === "ascending" && <ArrowSortUp16Regular aria-hidden />}
              {direction === "descending" && <ArrowSortDown16Regular aria-hidden />}
            </button>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={t("ui_GridResizeColumn", column)}
              aria-valuenow={Math.round(widths[c])}
              aria-valuemin={MIN_RESIZED_COL}
              aria-valuemax={MAX_RESIZED_COL}
              tabIndex={0}
              className={styles.resizer}
              onPointerDown={(event) => startResize(event, column, widths[c])}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  onResize(column, widths[c] + (event.key === "ArrowLeft" ? -RESIZE_STEP : RESIZE_STEP));
                }
              }}
            />
          </div>
        );
      })}
    </div>
  );

  if (rows.length === 0) {
    return (
      <div className={styles.frame} role="table" aria-label={ariaLabel} aria-rowcount={1}>
        <div style={{ overflowX: "auto" }}>{header}</div>
        <div className={styles.empty}>{noMatches ? t("ui_GridNoMatches") : t("ui_NoRows")}</div>
      </div>
    );
  }
  return (
    <div className={styles.frame} role="table" aria-label={ariaLabel} aria-rowcount={rows.length + 1}>
      <HeaderContext.Provider value={{ header, width: totalWidth }}>
        <FixedSizeList
          height={height}
          width="100%"
          itemCount={rows.length}
          itemSize={ROW_HEIGHT}
          itemData={props}
          innerElementType={Inner}
          overscanCount={8}
        >
          {GridRow}
        </FixedSizeList>
      </HeaderContext.Provider>
    </div>
  );
}

interface GridToolbarProps {
  searchOpen: boolean;
  query: string;
  /** Rows matching the search, or null when there's no search. */
  matches: number | null;
  total: number;
  onToggleSearch: () => void;
  onQuery: (query: string) => void;
  onDownload?: () => void;
  onFullScreen?: () => void;
}

/** Search, download and full screen: the toolbar st.dataframe shows above a table. */
function GridToolbar(props: GridToolbarProps) {
  const { searchOpen, query, matches, total, onToggleSearch, onQuery, onDownload, onFullScreen } = props;
  const styles = useStyles();
  const t = useStrings();
  const input = React.useRef<HTMLInputElement>(null);
  const focusWhenOpen = React.useRef(false);

  React.useEffect(() => {
    if (searchOpen && focusWhenOpen.current) {
      focusWhenOpen.current = false;
      input.current?.focus();
    }
  }, [searchOpen]);

  return (
    <div className={styles.toolbar}>
      {searchOpen && (
        <Input
          ref={input}
          size="small"
          className={styles.search}
          value={query}
          placeholder={t("ui_GridSearchPlaceholder")}
          aria-label={t("ui_GridSearch")}
          contentBefore={<Search16Regular />}
          onChange={(_, data) => onQuery(data.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              onToggleSearch();
            }
          }}
        />
      )}
      {matches !== null && (
        <Caption1 className={styles.note} aria-live="polite">
          {t("ui_GridMatches", formatCount(matches), formatCount(total))}
        </Caption1>
      )}
      <div className={styles.toolbarButtons}>
        <Tooltip content={t("ui_GridSearch")} relationship="label">
          <Button
            size="small"
            appearance={searchOpen ? "secondary" : "subtle"}
            icon={<Search16Regular />}
            aria-pressed={searchOpen}
            onClick={() => {
              focusWhenOpen.current = !searchOpen;
              onToggleSearch();
            }}
          />
        </Tooltip>
        {onDownload && (
          <Tooltip content={t("ui_DownloadCsv")} relationship="label">
            <Button size="small" appearance="subtle" icon={<ArrowDownload16Regular />} onClick={onDownload} />
          </Tooltip>
        )}
        {onFullScreen && (
          <Tooltip content={t("ui_GridFullScreen")} relationship="label">
            <Button size="small" appearance="subtle" icon={<FullScreenMaximize16Regular />} onClick={onFullScreen} />
          </Tooltip>
        )}
      </div>
    </div>
  );
}

function useWindowHeight(active: boolean): number {
  const [height, setHeight] = React.useState(() => window.innerHeight);
  React.useEffect(() => {
    if (!active) return;
    const update = () => setHeight(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [active]);
  return height;
}

export interface ResultsGridProps {
  rows: Row[];
  columnNames: string[];
  /** Maximum height in pixels; shorter results shrink to fit. */
  maxHeight?: number;
  ariaLabel: string;
  /** Adds a Download CSV button to the toolbar that saves the whole table under this name. */
  csvFileName?: string;
}

export function ResultsGrid({ rows, columnNames, maxHeight = 360, ariaLabel, csvFileName }: ResultsGridProps) {
  const styles = useStyles();
  const t = useStrings();
  const [sort, setSort] = React.useState<SortState | null>(null);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [needle, setNeedle] = React.useState("");
  const [resized, setResized] = React.useState<Record<string, number>>({});
  const [fullScreen, setFullScreen] = React.useState(false);
  const windowHeight = useWindowHeight(fullScreen);

  // Searching 50,000 rows on every key press would lag, so wait for a pause in typing.
  React.useEffect(() => {
    const timer = setTimeout(() => setNeedle(query.trim().toLowerCase()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const columns = React.useMemo(() => uniqueColumns(columnNames), [columnNames]);
  const autoWidths = React.useMemo(() => columnWidths(rows, columns), [rows, columns]);
  const widths = React.useMemo(() => columns.map((c, i) => resized[c] ?? autoWidths[i]), [columns, autoWidths, resized]);
  const kinds = React.useMemo(() => columnKinds(rows, columns), [rows, columns]);
  const filtered = React.useMemo(() => filterRows(rows, columns, needle), [rows, columns, needle]);
  const sorted = React.useMemo(() => sortRows(filtered, sort), [filtered, sort]);

  const toggleSort = React.useCallback(
    (column: string) =>
      setSort((current) => {
        if (!current || current.column !== column) return { column, direction: "ascending" };
        if (current.direction === "ascending") return { column, direction: "descending" };
        return null;
      }),
    [],
  );
  const resize = React.useCallback(
    (column: string, width: number) =>
      setResized((current) => ({
        ...current,
        [column]: Math.min(MAX_RESIZED_COL, Math.max(MIN_RESIZED_COL, Math.round(width))),
      })),
    [],
  );
  const toggleSearch = () => {
    if (searchOpen) {
      setQuery("");
      setNeedle("");
    }
    setSearchOpen(!searchOpen);
  };
  const download = csvFileName ? () => downloadText(csvFileName, toCsv(rows, columns), "text/csv") : undefined;

  const toolbarProps: GridToolbarProps = {
    searchOpen,
    query,
    matches: needle ? sorted.length : null,
    total: rows.length,
    onToggleSearch: toggleSearch,
    onQuery: setQuery,
    onDownload: download,
  };
  const bodyProps = {
    rows: sorted,
    columns,
    widths,
    kinds,
    needle,
    sort,
    ariaLabel,
    noMatches: rows.length > 0 && sorted.length === 0,
    onSort: toggleSort,
    onResize: resize,
  };
  const fullHeight = HEADER_HEIGHT + Math.max(1, sorted.length) * ROW_HEIGHT + 2;

  return (
    <div className={styles.root}>
      <GridToolbar {...toolbarProps} onFullScreen={() => setFullScreen(true)} />
      <GridBody {...bodyProps} height={Math.min(maxHeight, fullHeight)} />
      {fullScreen && (
        <Dialog open onOpenChange={(_, data) => setFullScreen(data.open)}>
          <DialogSurface className={styles.dialogSurface}>
            <DialogBody>
              <DialogTitle
                action={
                  <Button
                    appearance="subtle"
                    aria-label={t("ui_GridCloseFullScreen")}
                    icon={<Dismiss20Regular />}
                    onClick={() => setFullScreen(false)}
                  />
                }
              >
                {ariaLabel}
              </DialogTitle>
              <DialogContent className={styles.dialogContent}>
                <GridToolbar {...toolbarProps} />
                <GridBody {...bodyProps} height={Math.min(fullHeight, Math.max(200, windowHeight - 200))} />
              </DialogContent>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      )}
    </div>
  );
}
