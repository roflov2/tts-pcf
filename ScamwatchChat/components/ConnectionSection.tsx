/**
 * What the assistant is connected to, and Reconnect (render_connection_settings in
 * app.py). In Streamlit each user could edit these, because the app ran under their
 * own sign-in. Here the API runs the SQL under its own identity, so the server,
 * table and model are the API's settings: they're shown, not edited.
 */

import * as React from "react";
import { Button, Caption1, makeStyles, Spinner, Subtitle2, tokens, useId } from "@fluentui/react-components";
import { ArrowSync16Regular } from "./icons";
import type { SchemaResponse } from "../types";
import { useStrings } from "../utils/strings";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", rowGap: tokens.spacingVerticalS },
  note: { color: tokens.colorNeutralForeground3 },
  // Label above value: host names and table names are too long to sit beside a label in the drawer.
  list: { display: "flex", flexDirection: "column", rowGap: tokens.spacingVerticalS, margin: 0 },
  item: { display: "flex", flexDirection: "column" },
  term: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, lineHeight: tokens.lineHeightBase200 },
  value: { margin: 0, fontSize: tokens.fontSizeBase300, lineHeight: tokens.lineHeightBase300, overflowWrap: "anywhere" },
  actions: { display: "flex", alignItems: "center", columnGap: tokens.spacingHorizontalS },
});

/** Let long names wrap after a dot (Reporting.<wbr>ScamWatchReportFiltered) rather than mid-word. */
function breakAfterDots(value: string): React.ReactNode {
  return value.split(".").map((part, i, parts) => (
    <React.Fragment key={i}>
      {part}
      {i < parts.length - 1 && (
        <>
          .<wbr />
        </>
      )}
    </React.Fragment>
  ));
}

export type ConnectionStatus = "loading" | "ready" | "error" | "signin";

export interface ConnectionSectionProps {
  /** The last schema read, kept while reconnecting. */
  schema: SchemaResponse | null;
  status: ConnectionStatus;
  /** True while the schema is being read again. */
  busy: boolean;
  onReconnect: () => void;
}

export function ConnectionSection({ schema, status, busy, onReconnect }: ConnectionSectionProps) {
  const styles = useStyles();
  const t = useStrings();
  const headingId = useId("scw-connection");

  const details: [string, string | undefined][] = schema
    ? [
        [t("ui_ConnectionServer"), schema.server],
        [t("ui_ConnectionDatabase"), schema.database],
        [t("ui_ConnectionTable"), schema.table],
        [t("ui_ConnectionModel"), schema.model],
      ]
    : [];
  const shown = details.filter((detail): detail is [string, string] => Boolean(detail[1]));

  return (
    <section className={styles.root} aria-labelledby={headingId}>
      <Subtitle2 id={headingId}>{t("ui_ConnectionHeading")}</Subtitle2>
      {status === "ready" && shown.length > 0 && (
        <dl className={styles.list}>
          {shown.map(([term, value]) => (
            <div key={term} className={styles.item}>
              <dt className={styles.term}>{term}</dt>
              <dd className={styles.value}>{breakAfterDots(value)}</dd>
            </div>
          ))}
        </dl>
      )}
      {(status === "error" || status === "signin") && <Caption1>{t("ui_ConnectionFailed")}</Caption1>}
      <div className={styles.actions}>
        <Button size="small" icon={<ArrowSync16Regular />} disabled={busy} onClick={onReconnect}>
          {t("ui_ConnectionReconnect")}
        </Button>
        {busy && <Spinner size="extra-tiny" label={t("ui_ConnectionConnecting")} labelPosition="after" />}
      </div>
      <Caption1 className={styles.note}>{t("ui_ConnectionCaption")}</Caption1>
    </section>
  );
}
