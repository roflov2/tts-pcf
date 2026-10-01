/** Upload, inspect and remove a data dictionary (render_dictionary_settings in app.py). */

import * as React from "react";
import {
  Button,
  Caption1,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle2,
  tokens,
  useId,
} from "@fluentui/react-components";
import { ArrowDownload16Regular, ArrowUpload16Regular, Dismiss16Regular } from "./icons";
import type { ColumnInfo, DataDictionary } from "../types";
import { dictionaryTemplate, readDictionary, templateFileName } from "../utils/dictionary";
import { downloadText, formatCount } from "../utils/format";
import { useStrings } from "../utils/strings";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", rowGap: tokens.spacingVerticalS },
  note: { color: tokens.colorNeutralForeground3 },
  buttons: { display: "flex", flexWrap: "wrap", columnGap: tokens.spacingHorizontalS, rowGap: tokens.spacingVerticalXS },
  hidden: { display: "none" },
});

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

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // so picking the same file again still fires
    if (!file) {
      return;
    }
    setReading(file.name);
    setProblem(null);
    try {
      const raw = new Uint8Array(await file.arrayBuffer());
      const result = readDictionary(file.name, raw, maxChars);
      if (result.problem !== undefined) {
        setProblem(result.problem);
      } else {
        onUpload(result.dictionary);
      }
    } catch (error) {
      setProblem(`${file.name} couldn't be read. ${error instanceof Error ? error.message : ""}`.trim());
    } finally {
      setReading(null);
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
        <div className={styles.buttons}>
          <input
            ref={input}
            className={styles.hidden}
            type="file"
            accept=".txt,text/plain"
            onChange={onFile}
            aria-hidden
            tabIndex={-1}
          />
          <Button
            size="small"
            icon={<ArrowUpload16Regular />}
            disabled={reading !== null}
            onClick={() => input.current?.click()}
          >
            {active?.source === "upload" ? t("ui_DictionaryReplace") : t("ui_DictionaryUpload")}
          </Button>
          {active?.source === "upload" && (
            <Button size="small" appearance="subtle" icon={<Dismiss16Regular />} onClick={() => onUpload(null)}>
              {t("ui_DictionaryRemove")}
            </Button>
          )}
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
        <Button
          size="small"
          appearance="secondary"
          icon={<ArrowDownload16Regular />}
          title={t("ui_DictionaryTemplateHelp")}
          disabled={columns.length === 0}
          onClick={() => downloadText(templateFileName(table), dictionaryTemplate(table, columns), "text/plain")}
        >
          {t("ui_DictionaryTemplate")}
        </Button>
      </div>
    </section>
  );
}
