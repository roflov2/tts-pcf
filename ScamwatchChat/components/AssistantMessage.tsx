/**
 * One assistant answer: error, answer text, data note, then tabs for the
 * results, the SQL and any failed attempts (render_answer in app.py).
 */

import * as React from "react";
import {
  Button,
  Caption1,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Tab,
  TabList,
  tokens,
} from "@fluentui/react-components";
import { ArrowDownload16Regular, Copy16Regular } from "./icons";
import type { AssistantChatMessage } from "../types";
import { copyText, downloadText, rowLabel, toCsv } from "../utils/format";
import { type Translate, useStrings } from "../utils/strings";
import { MarkdownText } from "./MarkdownText";
import { ResultsGrid } from "./ResultsGrid";
import { SqlBlock } from "./SqlBlock";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", rowGap: tokens.spacingVerticalS, minWidth: 0 },
  note: { color: tokens.colorNeutralForeground3 },
  panel: { display: "flex", flexDirection: "column", rowGap: tokens.spacingVerticalS, paddingTop: tokens.spacingVerticalS },
  actions: { display: "flex", flexWrap: "wrap", columnGap: tokens.spacingHorizontalS, rowGap: tokens.spacingVerticalXS },
  attempt: { display: "flex", flexDirection: "column", rowGap: tokens.spacingVerticalXXS },
});

export type AnswerTab = "results" | "sql" | "failed";

/** Which tabs an answer shows, with their labels. Exported for tests. */
export function answerTabs(message: AssistantChatMessage, t: Translate): { value: AnswerTab; label: string }[] {
  const tabs: { value: AnswerTab; label: string }[] = [];
  const failed = message.attempts.filter((a) => !a.success);
  if (message.rows !== null || message.rowsDropped) {
    tabs.push({ value: "results", label: t("ui_TabResults", rowLabel(message.totalRows, message.truncated)) });
  }
  if (message.sql) {
    tabs.push({ value: "sql", label: t("ui_TabSql") });
  }
  if (failed.length) {
    tabs.push({ value: "failed", label: t("ui_TabFailed", failed.length) });
  }
  return tabs;
}

export interface AssistantMessageProps {
  message: AssistantChatMessage;
  /** Position in the conversation, used in the CSV file name (query_results_{n}.csv). */
  index: number;
}

export function AssistantMessage({ message, index }: AssistantMessageProps) {
  const styles = useStyles();
  const t = useStrings();
  const tabs = answerTabs(message, t);
  const [selected, setSelected] = React.useState<AnswerTab | undefined>(tabs[0]?.value);
  const [downloadBlocked, setDownloadBlocked] = React.useState(false);
  const active = tabs.some((tab) => tab.value === selected) ? selected : tabs[0]?.value;
  const failed = message.attempts.filter((a) => !a.success);

  const csv = React.useCallback(
    () => (message.rows ? toCsv(message.rows, message.columnNames) : ""),
    [message.rows, message.columnNames],
  );
  const onDownload = () => {
    if (!downloadText(`query_results_${index}.csv`, csv(), "text/csv")) {
      setDownloadBlocked(true);
    }
  };

  return (
    <div className={styles.root}>
      {message.error && (
        <MessageBar layout="multiline" intent="error">
          <MessageBarBody>{message.error}</MessageBarBody>
        </MessageBar>
      )}
      {message.content && <MarkdownText text={message.content} />}
      {message.dataNote && (
        <Caption1 className={styles.note}>
          {message.dataNote} {t("ui_DataNoteSuffix")}
        </Caption1>
      )}

      {tabs.length > 0 && (
        <div>
          <TabList
            size="small"
            selectedValue={active}
            onTabSelect={(_, data) => setSelected(data.value as AnswerTab)}
          >
            {tabs.map((tab) => (
              <Tab key={tab.value} value={tab.value}>
                {tab.label}
              </Tab>
            ))}
          </TabList>

          {active === "results" && (
            <div className={styles.panel} role="tabpanel">
              {message.rows ? (
                <>
                  <ResultsGrid rows={message.rows} columnNames={message.columnNames} ariaLabel={tabs[0].label} />
                  <div className={styles.actions}>
                    <Button size="small" icon={<ArrowDownload16Regular />} onClick={onDownload}>
                      {t("ui_DownloadCsv")}
                    </Button>
                    <Button size="small" appearance="subtle" icon={<Copy16Regular />} onClick={() => copyText(csv())}>
                      {t("ui_CopyCsv")}
                    </Button>
                  </div>
                  {downloadBlocked && <Caption1 className={styles.note}>{t("ui_DownloadBlocked")}</Caption1>}
                </>
              ) : (
                <Caption1 className={styles.note}>{t("ui_RowsDropped")}</Caption1>
              )}
            </div>
          )}

          {active === "sql" && message.sql && (
            <div className={styles.panel} role="tabpanel">
              <SqlBlock code={message.sql} />
              {message.dictionaryName && (
                <Caption1 className={styles.note}>{t("ui_WrittenWithDictionary", message.dictionaryName)}</Caption1>
              )}
            </div>
          )}

          {active === "failed" && (
            <div className={styles.panel} role="tabpanel">
              {failed.map((attempt, i) => (
                <div key={i} className={styles.attempt}>
                  {attempt.query ? (
                    <SqlBlock code={attempt.query} />
                  ) : (
                    <SqlBlock code={t("ui_NoQuery")} language="text" copyable={false} />
                  )}
                  <Caption1 className={styles.note}>{attempt.error || t("ui_NoErrorMessage")}</Caption1>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
