/**
 * Virtualised results table (st.dataframe in app.py). Like st.dataframe it sorts by
 * column, resizes, autosizes, reorders, pins and hides columns, searches, opens
 * full screen, selects cells (click, Shift+click, drag or the arrow keys) and
 * copies them with Ctrl+C as tab-separated text, and shows booleans as checkboxes
 * and missing values as a muted "None". Only the rows on screen are rendered, so
 * 50,000-row results scroll smoothly. The table logic is in utils/grid.ts.
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
  Menu,
  MenuDivider,
  MenuItem,
  MenuItemCheckbox,
  MenuList,
  MenuPopover,
  MenuTrigger,
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
  Eye16Regular,
  EyeOff16Regular,
  FullScreenMaximize16Regular,
  MoreVertical16Regular,
  Pin12Regular,
  Pin16Regular,
  PinOff16Regular,
  Search16Regular,
} from "./icons";
import type { Row } from "../types";
import { cellText, downloadText, formatCount, toCsv, uniqueColumns } from "../utils/format";
import {
  arrangeColumns,
  autoWidth,
  clampCell,
  type ColumnKind,
  columnKinds,
  type ColumnLayout,
  DEFAULT_LAYOUT,
  filterRows,
  type GridCell,
  type GridSelection,
  inBounds,
  isMissing,
  MAX_RESIZED_COL,
  MIN_RESIZED_COL,
  moveColumn,
  selectionBounds,
  type SelectionBounds,
  selectionToTsv,
  sortRows,
  type SortState,
} from "../utils/grid";
import { useStrings } from "../utils/strings";

const ROW_HEIGHT = 30;
const HEADER_HEIGHT = 32;
const RESIZE_STEP = 16;
const PAGE_ROWS = 10;
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
    ":focus-visible": { outlineStyle: "solid", outlineWidth: "2px", outlineColor: tokens.colorStrokeFocus2 },
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 3,
    display: "flex",
    height: `${HEADER_HEIGHT}px`,
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2),
  },
  headerCell: {
    position: "relative",
    display: "flex",
    boxSizing: "border-box",
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRight("1px", "solid", tokens.colorNeutralStroke3),
    // The column menu button shows on hover or keyboard focus, as in st.dataframe.
    ":hover [data-col-menu]": { opacity: 1 },
    ":focus-within [data-col-menu]": { opacity: 1 },
  },
  dropTarget: { boxShadow: `inset 3px 0 0 ${tokens.colorBrandStroke1}` },
  sortButton: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalXXS,
    flexGrow: 1,
    minWidth: 0,
    ...shorthands.padding(0, 0, 0, tokens.spacingHorizontalS),
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
  pinIcon: { flexShrink: 0, color: tokens.colorNeutralForeground3 },
  menuButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: "22px",
    marginRight: "6px",
    ...shorthands.padding(0),
    ...shorthands.border(0),
    backgroundColor: "transparent",
    color: tokens.colorNeutralForeground2,
    cursor: "pointer",
    opacity: 0,
    ":hover": { backgroundColor: tokens.colorNeutralBackground3Hover },
    ":focus-visible": { opacity: 1, outlineStyle: "solid", outlineWidth: "2px", outlineColor: tokens.colorStrokeFocus2 },
    // No hover on touch screens, so always show it there.
    "@media (hover: none)": { opacity: 1 },
  },
  menuOpen: { opacity: 1 },
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
    backgroundColor: tokens.colorNeutralBackground1,
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
    cursor: "cell",
    userSelect: "none",
  },
  // Pinned columns stay put while the rest scroll sideways.
  pinned: { position: "sticky", zIndex: 1, backgroundColor: "inherit" },
  pinnedHeader: { position: "sticky", zIndex: 2 },
  lastPinned: { ...shorthands.borderRight("1px", "solid", tokens.colorNeutralStroke1) },
  selected: { backgroundColor: tokens.colorBrandBackground2 },
  active: { outlineStyle: "solid", outlineWidth: "2px", outlineColor: tokens.colorBrandStroke1, outlineOffset: "-2px" },
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

/** What the rows need to render: the displayed columns and the selection. */
interface GridData {
  rows: Row[];
  columns: string[];
  widths: number[];
  kinds: ColumnKind[];
  /** Left offset of each pinned column, null for columns that scroll. */
  pinnedLeft: (number | null)[];
  needle: string;
  bounds: SelectionBounds | null;
  focus: GridCell | null;
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
  const lastPinned = data.pinnedLeft.filter((left) => left !== null).length - 1;
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
        const left = data.pinnedLeft[c];
        const selected = inBounds(data.bounds, index, c);
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
            role="gridcell"
            aria-selected={selected}
            data-cell=""
            data-row={index}
            data-col={c}
            title={title}
            className={mergeClasses(
              styles.cell,
              kind === "number" && styles.numeric,
              kind === "boolean" && styles.boolean,
              left !== null && styles.pinned,
              c === lastPinned && styles.lastPinned,
              selected && styles.selected,
              data.focus?.row === index && data.focus.col === c && styles.active,
            )}
            style={{ width: data.widths[c], flex: `0 0 ${data.widths[c]}px`, left: left ?? undefined }}
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
  selection: GridSelection | null;
  /** The column whose menu is open. */
  menuColumn: string | null;
  onSort: (column: string) => void;
  onResize: (column: string, width: number) => void;
  onAutosize: (column: string) => void;
  onMove: (column: string, before: string) => void;
  onMenu: (column: string, target: HTMLElement) => void;
  onSelect: (selection: GridSelection | null) => void;
}

function GridBody(props: GridBodyProps) {
  const { rows, columns, widths, kinds, pinnedLeft, sort, height, ariaLabel, noMatches, menuColumn, selection } = props;
  const { onSort, onResize, onAutosize, onMove, onMenu, onSelect } = props;
  const styles = useStyles();
  const t = useStrings();
  const totalWidth = widths.reduce((sum, w) => sum + w, 0);
  const lastPinned = pinnedLeft.filter((left) => left !== null).length - 1;
  const listRef = React.useRef<FixedSizeList>(null);
  const outerRef = React.useRef<HTMLDivElement>(null);
  const resizing = React.useRef(false);
  const draggedColumn = React.useRef<string | null>(null);
  const dragSelecting = React.useRef(false);
  const [dropTarget, setDropTarget] = React.useState<string | null>(null);

  // A drag-selection ends wherever the mouse is released.
  React.useEffect(() => {
    const stop = () => {
      dragSelecting.current = false;
    };
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  /** Drag a column's right edge. Pointer capture keeps the drag going outside the handle. */
  const startResize = (event: React.PointerEvent<HTMLDivElement>, column: string, width: number) => {
    event.preventDefault();
    event.stopPropagation();
    resizing.current = true;
    const handle = event.currentTarget;
    const startX = event.clientX;
    handle.setPointerCapture?.(event.pointerId);
    const move = (e: PointerEvent) => onResize(column, width + e.clientX - startX);
    const end = () => {
      resizing.current = false;
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };

  /** Scroll so a cell is in view, allowing for the pinned columns on the left. */
  const reveal = (cell: GridCell) => {
    listRef.current?.scrollToItem(cell.row);
    const outer = outerRef.current;
    if (!outer || pinnedLeft[cell.col] !== null) return;
    const pinnedWidth = widths.reduce((sum, w, i) => sum + (pinnedLeft[i] !== null ? w : 0), 0);
    const left = widths.slice(0, cell.col).reduce((sum, w) => sum + w, 0);
    const right = left + widths[cell.col];
    if (left - pinnedWidth < outer.scrollLeft) {
      outer.scrollLeft = left - pinnedWidth;
    } else if (right > outer.scrollLeft + outer.clientWidth) {
      outer.scrollLeft = right - outer.clientWidth;
    }
  };

  const cellAt = (target: EventTarget | null): GridCell | null => {
    const element = target instanceof Element ? (target.closest("[data-cell]") as HTMLElement | null) : null;
    return element ? { row: Number(element.dataset.row), col: Number(element.dataset.col) } : null;
  };

  const onMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const cell = cellAt(event.target);
    if (!cell || event.button !== 0) return;
    event.preventDefault(); // no text selection; the grid takes focus instead
    event.currentTarget.focus({ preventScroll: true });
    onSelect(event.shiftKey && selection ? { anchor: selection.anchor, focus: cell } : { anchor: cell, focus: cell });
    dragSelecting.current = true;
  };

  const onMouseOver = (event: React.MouseEvent<HTMLDivElement>) => {
    const cell = dragSelecting.current ? cellAt(event.target) : null;
    if (cell && selection) {
      onSelect({ anchor: selection.anchor, focus: cell });
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Keys pressed on the header's buttons and resize handles are theirs.
    if (event.target !== event.currentTarget || rows.length === 0) return;
    const ctrl = event.ctrlKey || event.metaKey;
    const last: GridCell = { row: rows.length - 1, col: columns.length - 1 };
    if (ctrl && event.key.toLowerCase() === "a") {
      event.preventDefault();
      onSelect({ anchor: { row: 0, col: 0 }, focus: last });
      return;
    }
    if (event.key === "Escape" && selection) {
      event.preventDefault();
      event.stopPropagation(); // clears the selection before closing full screen
      onSelect(null);
      return;
    }
    const at = selection?.focus ?? { row: 0, col: 0 };
    const moves: Record<string, GridCell> = {
      ArrowUp: { row: at.row - 1, col: at.col },
      ArrowDown: { row: at.row + 1, col: at.col },
      ArrowLeft: { row: at.row, col: at.col - 1 },
      ArrowRight: { row: at.row, col: at.col + 1 },
      PageUp: { row: at.row - PAGE_ROWS, col: at.col },
      PageDown: { row: at.row + PAGE_ROWS, col: at.col },
      Home: ctrl ? { row: 0, col: 0 } : { row: at.row, col: 0 },
      End: ctrl ? last : { row: at.row, col: last.col },
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    // The first key press just selects the top-left cell.
    const next = selection ? clampCell(moves[event.key], rows.length, columns.length) : { row: 0, col: 0 };
    onSelect(event.shiftKey && selection ? { anchor: selection.anchor, focus: next } : { anchor: next, focus: next });
    reveal(next);
  };

  /** Ctrl+C / Cmd+C: the selected cells as tab-separated text, as st.dataframe copies them. */
  const onCopy = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (!props.bounds || event.target !== event.currentTarget) return;
    event.preventDefault();
    event.clipboardData.setData("text/plain", selectionToTsv(rows, columns, props.bounds));
  };

  const header = (
    <div role="row" aria-rowindex={1} className={styles.header} style={{ width: totalWidth, minWidth: "100%" }}>
      {columns.map((column, c) => {
        const direction = sort?.column === column ? sort.direction : undefined;
        const align = kinds[c] === "number" ? "flex-end" : kinds[c] === "boolean" ? "center" : "flex-start";
        const left = pinnedLeft[c];
        return (
          <div
            key={column}
            role="columnheader"
            aria-sort={direction ?? "none"}
            draggable
            className={mergeClasses(
              styles.headerCell,
              left !== null && styles.pinnedHeader,
              c === lastPinned && styles.lastPinned,
              dropTarget === column && styles.dropTarget,
            )}
            style={{ width: widths[c], flex: `0 0 ${widths[c]}px`, left: left ?? undefined }}
            // Drag a header onto another to move it there (st.dataframe column reordering).
            onDragStart={(event) => {
              if (resizing.current) {
                event.preventDefault();
                return;
              }
              draggedColumn.current = column;
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", column);
            }}
            onDragOver={(event) => {
              if (draggedColumn.current === null) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDropTarget(column);
            }}
            onDragLeave={() => setDropTarget((current) => (current === column ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              const dragged = draggedColumn.current;
              draggedColumn.current = null;
              setDropTarget(null);
              if (dragged && dragged !== column) onMove(dragged, column);
            }}
            onDragEnd={() => {
              draggedColumn.current = null;
              setDropTarget(null);
            }}
          >
            <button
              type="button"
              className={styles.sortButton}
              style={{ justifyContent: align }}
              onClick={() => onSort(column)}
              title={column}
            >
              {left !== null && <Pin12Regular className={styles.pinIcon} aria-hidden />}
              <span className={styles.headerText}>{column}</span>
              {direction === "ascending" && <ArrowSortUp16Regular aria-hidden />}
              {direction === "descending" && <ArrowSortDown16Regular aria-hidden />}
            </button>
            <button
              type="button"
              data-col-menu=""
              aria-label={t("ui_GridColumnMenu", column)}
              aria-haspopup="menu"
              aria-expanded={menuColumn === column}
              className={mergeClasses(styles.menuButton, menuColumn === column && styles.menuOpen)}
              onClick={(event) => onMenu(column, event.currentTarget)}
            >
              <MoreVertical16Regular />
            </button>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={t("ui_GridResizeColumn", column)}
              aria-valuenow={Math.round(widths[c])}
              aria-valuemin={MIN_RESIZED_COL}
              aria-valuemax={MAX_RESIZED_COL}
              tabIndex={0}
              draggable={false}
              className={styles.resizer}
              onPointerDown={(event) => startResize(event, column, widths[c])}
              onDoubleClick={() => onAutosize(column)}
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

  const frameProps = {
    className: styles.frame,
    role: "grid",
    "aria-label": ariaLabel,
    "aria-multiselectable": true,
    tabIndex: 0,
    onMouseDown,
    onMouseOver,
    onKeyDown,
    onCopy,
  };
  if (rows.length === 0) {
    return (
      <div {...frameProps} aria-rowcount={1}>
        <div style={{ overflowX: "auto" }}>{header}</div>
        <div className={styles.empty}>{noMatches ? t("ui_GridNoMatches") : t("ui_NoRows")}</div>
      </div>
    );
  }
  return (
    <div {...frameProps} aria-rowcount={rows.length + 1}>
      <HeaderContext.Provider value={{ header, width: totalWidth }}>
        <FixedSizeList
          ref={listRef}
          outerRef={outerRef}
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
  /** All columns, and the ones shown, for the show/hide menu. */
  columns: string[];
  visible: string[];
  onVisibleChange: (visible: string[]) => void;
  onToggleSearch: () => void;
  onQuery: (query: string) => void;
  onDownload?: () => void;
  onFullScreen?: () => void;
}

/** Show/hide columns, search, download and full screen: the toolbar st.dataframe shows above a table. */
function GridToolbar(props: GridToolbarProps) {
  const { searchOpen, query, matches, total, columns, visible, onVisibleChange, onToggleSearch, onQuery } = props;
  const { onDownload, onFullScreen } = props;
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
        <Menu
          checkedValues={{ visible }}
          onCheckedValueChange={(_, data) => {
            // At least one column stays, as in st.dataframe.
            if (data.checkedItems.length > 0) onVisibleChange(data.checkedItems);
          }}
        >
          <MenuTrigger disableButtonEnhancement>
            <Tooltip content={t("ui_GridColumns")} relationship="label">
              <Button size="small" appearance="subtle" icon={<Eye16Regular />} />
            </Tooltip>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              {columns.map((column) => (
                <MenuItemCheckbox key={column} name="visible" value={column}>
                  {column}
                </MenuItemCheckbox>
              ))}
            </MenuList>
          </MenuPopover>
        </Menu>
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

interface ColumnMenuProps {
  target: HTMLElement;
  pinned: boolean;
  canHide: boolean;
  onClose: () => void;
  onSort: (direction: "ascending" | "descending") => void;
  onAutosize: () => void;
  onTogglePin: () => void;
  onHide: () => void;
}

/** The menu on a column header: sort, autosize, pin and hide (st.dataframe's column menu). */
function ColumnMenu({ target, pinned, canHide, onClose, onSort, onAutosize, onTogglePin, onHide }: ColumnMenuProps) {
  const t = useStrings();
  return (
    <Menu open positioning={{ target, position: "below", align: "end" }} onOpenChange={(_, data) => !data.open && onClose()}>
      <MenuPopover>
        <MenuList>
          <MenuItem icon={<ArrowSortUp16Regular />} onClick={() => onSort("ascending")}>
            {t("ui_GridSortAscending")}
          </MenuItem>
          <MenuItem icon={<ArrowSortDown16Regular />} onClick={() => onSort("descending")}>
            {t("ui_GridSortDescending")}
          </MenuItem>
          <MenuDivider />
          <MenuItem onClick={onAutosize}>{t("ui_GridAutosize")}</MenuItem>
          <MenuItem icon={pinned ? <PinOff16Regular /> : <Pin16Regular />} onClick={onTogglePin}>
            {pinned ? t("ui_GridUnpin") : t("ui_GridPin")}
          </MenuItem>
          <MenuItem icon={<EyeOff16Regular />} disabled={!canHide} onClick={onHide}>
            {t("ui_GridHide")}
          </MenuItem>
        </MenuList>
      </MenuPopover>
    </Menu>
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
  const [layout, setLayout] = React.useState<ColumnLayout>(DEFAULT_LAYOUT);
  const [selection, setSelection] = React.useState<GridSelection | null>(null);
  const [menu, setMenu] = React.useState<{ column: string; target: HTMLElement } | null>(null);
  const [fullScreen, setFullScreen] = React.useState(false);
  const windowHeight = useWindowHeight(fullScreen);

  // Searching 50,000 rows on every key press would lag, so wait for a pause in typing.
  React.useEffect(() => {
    const timer = setTimeout(() => setNeedle(query.trim().toLowerCase()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const columns = React.useMemo(() => uniqueColumns(columnNames), [columnNames]);
  const display = React.useMemo(() => arrangeColumns(columns, layout), [columns, layout]);
  const kindOf = React.useMemo(() => {
    const kinds = columnKinds(rows, columns);
    return Object.fromEntries(columns.map((column, i) => [column, kinds[i]]));
  }, [rows, columns]);
  const widths = React.useMemo(() => display.map((c) => resized[c] ?? autoWidth(rows, c)), [display, resized, rows]);
  const kinds = React.useMemo(() => display.map((c) => kindOf[c]), [display, kindOf]);
  const pinnedLeft = React.useMemo(() => {
    let left = 0;
    return display.map((column, i) => {
      if (!layout.pinned.includes(column)) return null;
      const offset = left;
      left += widths[i];
      return offset;
    });
  }, [display, layout.pinned, widths]);
  const filtered = React.useMemo(() => filterRows(rows, display, needle), [rows, display, needle]);
  const sorted = React.useMemo(() => sortRows(filtered, sort), [filtered, sort]);

  // A selection points at rows and columns by position, so it ends when they change.
  React.useEffect(() => setSelection(null), [sorted, display]);

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
  const autosize = (column: string) => resize(column, autoWidth(rows, column, MAX_RESIZED_COL));
  const move = (column: string, before: string) =>
    setLayout((current) =>
      current.pinned.includes(column) && current.pinned.includes(before)
        ? { ...current, pinned: moveColumn(current.pinned, column, before) }
        : { ...current, order: moveColumn(current.order ?? columns, column, before) },
    );
  const togglePin = (column: string) =>
    setLayout((current) => ({
      ...current,
      pinned: current.pinned.includes(column) ? current.pinned.filter((c) => c !== column) : [...current.pinned, column],
    }));
  const toggleSearch = () => {
    if (searchOpen) {
      setQuery("");
      setNeedle("");
    }
    setSearchOpen(!searchOpen);
  };
  const download = csvFileName ? () => downloadText(csvFileName, toCsv(rows, columns), "text/csv") : undefined;
  const bounds = selection ? selectionBounds(selection) : null;

  const toolbarProps: GridToolbarProps = {
    searchOpen,
    query,
    matches: needle ? sorted.length : null,
    total: rows.length,
    columns,
    visible: columns.filter((c) => !layout.hidden.includes(c)),
    onVisibleChange: (visible) => setLayout((current) => ({ ...current, hidden: columns.filter((c) => !visible.includes(c)) })),
    onToggleSearch: toggleSearch,
    onQuery: setQuery,
    onDownload: download,
  };
  const bodyProps = {
    rows: sorted,
    columns: display,
    widths,
    kinds,
    pinnedLeft,
    needle,
    bounds,
    focus: selection?.focus ?? null,
    selection,
    sort,
    ariaLabel,
    noMatches: rows.length > 0 && sorted.length === 0,
    menuColumn: menu?.column ?? null,
    onSort: toggleSort,
    onResize: resize,
    onAutosize: autosize,
    onMove: move,
    onMenu: (column: string, target: HTMLElement) => setMenu({ column, target }),
    onSelect: setSelection,
  };
  const fullHeight = HEADER_HEIGHT + Math.max(1, sorted.length) * ROW_HEIGHT + 2;
  // Rendered inside whichever view opened it, so it works within the full-screen dialog too.
  const columnMenu = menu && (
    <ColumnMenu
      target={menu.target}
      pinned={layout.pinned.includes(menu.column)}
      canHide={display.length > 1}
      onClose={() => setMenu(null)}
      onSort={(direction) => setSort({ column: menu.column, direction })}
      onAutosize={() => autosize(menu.column)}
      onTogglePin={() => togglePin(menu.column)}
      onHide={() => setLayout((current) => ({ ...current, hidden: [...current.hidden, menu.column] }))}
    />
  );

  return (
    <div className={styles.root}>
      <GridToolbar {...toolbarProps} onFullScreen={() => setFullScreen(true)} />
      <GridBody {...bodyProps} height={Math.min(maxHeight, fullHeight)} />
      {!fullScreen && columnMenu}
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
                {columnMenu}
              </DialogContent>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      )}
    </div>
  );
}
