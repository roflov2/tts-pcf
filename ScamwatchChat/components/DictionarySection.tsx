/**
 * Upload, inspect and remove a data dictionary (render_dictionary_settings in app.py).
 * Like st.file_uploader, it takes a dropped file or one picked with Browse files,
 * accepts only .txt, and lists the uploaded file with its size and a remove button.
 */

import * as React from "react";
import {
  Body1,
  Button,
  Caption1,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  shorthands,
  Spinner,
  Subtitle2,
  tokens,
  Tooltip,
  useId,
} from "@fluentui/react-components";
import { ArrowDownload16Regular, ArrowUpload20Regular, Dismiss16Regular, DocumentText20Regular } from "./icons";
import type { ColumnInfo, DataDictionary } from "../types";
import { dictionaryTemplate, MAX_DICTIONARY_UPLOAD_BYTES, readDictionary, templateFileName } from "../utils/dictionary";
import { downloadText, formatBytes, formatCount } from "../utils/format";
import { useStrings } from "../utils/strings";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", rowGap: tokens.spacingVerticalS, overflowWrap: "anywhere" },
  note: { color: tokens.colorNeutralForeground3 },
  buttons: { display: "flex", flexWrap: "wrap", columnGap: tokens.spacingHorizontalS, rowGap: tokens.spacingVerticalXS },
  hidden: { display: "none" },
  dropZone: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalM,
    rowGap: tokens.spacingVerticalS,
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    ...shorthands.border("1px", "dashed", tokens.colorNeutralStroke1),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground2,
  },
  dropZoneActive: {
    ...shorthands.borderColor(tokens.colorBrandStroke1),
    backgroundColor: tokens.colorBrandBackground2,
  },
  // Icon and text stay together; the button wraps below them when the drawer is narrow.
  dropLabel: { display: "flex", alignItems: "flex-start", columnGap: tokens.spacingHorizontalS, flexGrow: 1, minWidth: "160px" },
  dropIcon: { fontSize: "20px", color: tokens.colorNeutralForeground3, flexShrink: 0, marginTop: "1px" },
  dropText: { display: "flex", flexDirection: "column", minWidth: 0 },
  file: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalS,
    ...shorthands.padding(tokens.spacingVerticalXS, 0, tokens.spacingVerticalXS, tokens.spacingHorizontalS),
  },
  fileIcon: { fontSize: "20px", color: tokens.colorNeutralForeground3, flexShrink: 0 },
  fileText: { display: "flex", flexDirection: "column", flexGrow: 1, minWidth: 0 },
  fileName: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  fileSize: { color: tokens.colorNeutralForeground3 },
});

/** st.file_uploader(type=["txt"]) checks the extension, for dropped files too. */
export function isTextFileName(name: string): boolean {
  return /\.txt$/i.test(name);
}

function hasFiles(event: React.DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

export interface DictionarySectionProps {
  table: string;
  columns: ColumnInfo[];
  /** The dictionary sent with new questions (upload or the app maker's). */
  active: DataDictionary | null;
  /** Name of the maker's dictionary, when the app provides one. */
  makerName: string | null;
  mentionedCount: number;
  allowUpload: boolean;
  maxChars: number;
  onUpload: (dictionary: DataDictionary | null) => void;
}

export function DictionarySection(props: DictionarySectionProps) {
  const { table, columns, active, makerName, mentionedCount, allowUpload, maxChars, onUpload } = props;
  const styles = useStyles();
  const t = useStrings();
  const headingId = useId("scw-dictionary");
  const input = React.useRef<HTMLInputElement>(null);
  const [reading, setReading] = React.useState<string | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const readFile = async (file: File) => {
    setProblem(null);
    if (!isTextFileName(file.name)) {
      setProblem(t("ui_DictionaryWrongType", file.name));
      return;
    }
    setReading(file.name);
    try {
      const raw = new Uint8Array(await file.arrayBuffer());
      const result = readDictionary(file.name, raw, maxChars);
      if (result.problem !== undefined) {
        setProblem(result.problem);
      } else {
        onUpload({ ...result.dictionary, bytes: raw.length });
      }
    } catch (error) {
      setProblem(t("ui_DictionaryReadFailed", file.name, error instanceof Error ? error.message : "").trim());
    } finally {
      setReading(null);
    }
  };

  const onPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // so picking the same file again still fires
    if (file) {
      void readFile(file);
    }
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event) || reading !== null) {
      return;
    }
    event.preventDefault(); // allows the drop
    event.dataTransfer.dropEffect = "copy";
    setDragging(true);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && reading === null) {
      void readFile(file);
    }
  };

  const status =
    active &&
    t(
      active.source === "maker" ? "ui_DictionaryMakerStatus" : "ui_DictionaryStatus",
      active.name,
      mentionedCount,
      columns.length,
      table,
    );

  return (
    <section className={styles.root} aria-labelledby={headingId}>
      <Subtitle2 id={headingId}>{t("ui_DictionaryHeading")}</Subtitle2>
      <Caption1 className={styles.note}>{t("ui_DictionaryCaption")}</Caption1>

      {allowUpload && (
        <div
          role="group"
          aria-label={t("ui_DictionaryDrop")}
          className={mergeClasses(styles.dropZone, dragging && styles.dropZoneActive)}
          onDragEnter={onDragOver}
          onDragOver={onDragOver}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setDragging(false);
            }
          }}
          onDrop={onDrop}
        >
          <div className={styles.dropLabel}>
            <ArrowUpload20Regular className={styles.dropIcon} />
            <div className={styles.dropText}>
              <Body1>{t("ui_DictionaryDrop")}</Body1>
              <Caption1 className={styles.note}>{t("ui_DictionaryLimit", MAX_DICTIONARY_UPLOAD_BYTES / 1_000_000)}</Caption1>
            </div>
          </div>
          <input
            ref={input}
            className={styles.hidden}
            type="file"
            accept=".txt,text/plain"
            onChange={onPick}
            aria-hidden
            tabIndex={-1}
          />
          <Button size="small" disabled={reading !== null} onClick={() => input.current?.click()}>
            {t("ui_DictionaryBrowse")}
          </Button>
        </div>
      )}

      {allowUpload && active?.source === "upload" && (
        <div className={styles.file}>
          <DocumentText20Regular className={styles.fileIcon} />
          <div className={styles.fileText}>
            <Body1 className={styles.fileName} title={active.name}>
              {active.name}
            </Body1>
            {active.bytes !== undefined && <Caption1 className={styles.fileSize}>{formatBytes(active.bytes)}</Caption1>}
          </div>
          <Tooltip content={t("ui_DictionaryRemove", active.name)} relationship="label">
            <Button size="small" appearance="subtle" icon={<Dismiss16Regular />} onClick={() => onUpload(null)} />
          </Tooltip>
        </div>
      )}

      {reading && <Spinner size="extra-tiny" label={t("ui_DictionaryReading", reading)} labelPosition="after" />}
      {problem && (
        <MessageBar layout="multiline" intent="error">
          <MessageBarBody>{problem}</MessageBarBody>
        </MessageBar>
      )}
      {status && <Caption1>{status}</Caption1>}
      {active?.source === "upload" && makerName && (
        <Caption1 className={styles.note}>{t("ui_DictionaryMakerFallback", makerName)}</Caption1>
      )}
      {active?.truncated && (
        <MessageBar layout="multiline" intent="warning">
          <MessageBarBody>{t("ui_DictionaryTruncated", formatCount(maxChars))}</MessageBarBody>
        </MessageBar>
      )}

      <div className={styles.buttons}>
        <Tooltip content={t("ui_DictionaryTemplateHelp")} relationship="description">
          <Button
            size="small"
            appearance="secondary"
            icon={<ArrowDownload16Regular />}
            disabled={columns.length === 0}
            onClick={() => downloadText(templateFileName(table), dictionaryTemplate(table, columns), "text/plain")}
          >
            {t("ui_DictionaryTemplate")}
          </Button>
        </Tooltip>
      </div>
    </section>
  );
}
