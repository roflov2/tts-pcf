/**
 * The Connection section (render_connection_settings in app.py): SQL server,
 * database, table, Azure OpenAI endpoint, API version and model deployment.
 *
 * In Streamlit each user could edit these, because the app ran under their own
 * sign-in. Here the API runs the SQL under its own identity, so by default they're
 * shown read-only with Reconnect. When the app maker turns on
 * allowConnectionChange, they're an editable form with Connect, as in app.py, and
 * the API checks each value against its allowlist.
 */

import * as React from "react";
import {
  Button,
  Caption1,
  Field,
  Input,
  makeStyles,
  Spinner,
  Subtitle2,
  tokens,
  useId,
} from "@fluentui/react-components";
import { ArrowSync16Regular } from "./icons";
import type { ConnectionSettings, SchemaResponse } from "../types";
import { CONNECTION_FIELDS, type ConnectionField } from "../utils/connection";
import { type StringKey, useStrings } from "../utils/strings";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", rowGap: tokens.spacingVerticalS },
  note: { color: tokens.colorNeutralForeground3 },
  // Label above value: host names and table names are too long to sit beside a label in the drawer.
  list: { display: "flex", flexDirection: "column", rowGap: tokens.spacingVerticalS, margin: 0 },
  item: { display: "flex", flexDirection: "column" },
  term: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, lineHeight: tokens.lineHeightBase200 },
  value: { margin: 0, fontSize: tokens.fontSizeBase300, lineHeight: tokens.lineHeightBase300, overflowWrap: "anywhere" },
  form: { display: "flex", flexDirection: "column", rowGap: tokens.spacingVerticalS },
  actions: { display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: tokens.spacingHorizontalS, rowGap: tokens.spacingVerticalXS },
});

const LABELS: Record<ConnectionField, StringKey> = {
  server: "ui_ConnectionServer",
  database: "ui_ConnectionDatabase",
  table: "ui_ConnectionTable",
  openAiEndpoint: "ui_ConnectionEndpoint",
  openAiApiVersion: "ui_ConnectionApiVersion",
  model: "ui_ConnectionModel",
};

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
  /** Show the editable form (the allowConnectionChange property). */
  editable: boolean;
  /** The values the user connected with, or null for the app's settings. */
  connection: ConnectionSettings | null;
  onConnect: (values: ConnectionSettings) => void;
  /** Go back to the app's settings. */
  onReset: () => void;
}

interface ConnectionFormProps {
  initial: ConnectionSettings;
  busy: boolean;
  canReset: boolean;
  onConnect: (values: ConnectionSettings) => void;
  onReset: () => void;
}

/** The st.form in app.py: six text fields and a primary Connect button. */
function ConnectionForm({ initial, busy, canReset, onConnect, onReset }: ConnectionFormProps) {
  const styles = useStyles();
  const t = useStrings();
  const [values, setValues] = React.useState<ConnectionSettings>(initial);

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        onConnect(values);
      }}
    >
      {CONNECTION_FIELDS.map((field) => (
        <Field
          key={field}
          size="small"
          label={t(LABELS[field])}
          hint={field === "table" ? t("ui_ConnectionTableHint") : undefined}
        >
          <Input
            size="small"
            value={values[field] ?? ""}
            onChange={(_, data) => setValues((current) => ({ ...current, [field]: data.value }))}
          />
        </Field>
      ))}
      <div className={styles.actions}>
        <Button type="submit" size="small" appearance="primary" disabled={busy}>
          {t("ui_ConnectionConnect")}
        </Button>
        {canReset && (
          <Button size="small" appearance="subtle" disabled={busy} onClick={onReset}>
            {t("ui_ConnectionReset")}
          </Button>
        )}
        {busy && <Spinner size="extra-tiny" label={t("ui_ConnectionConnecting")} labelPosition="after" />}
      </div>
    </form>
  );
}

export function ConnectionSection(props: ConnectionSectionProps) {
  const { schema, status, busy, onReconnect, editable, connection, onConnect, onReset } = props;
  const styles = useStyles();
  const t = useStrings();
  const headingId = useId("scw-connection");
  const failed = status === "error" || status === "signin";

  // What the API reports it's connected to, with the user's own values on top while they apply.
  const current = React.useMemo<ConnectionSettings>(() => {
    const reported: ConnectionSettings = schema
      ? {
          server: schema.server,
          database: schema.database,
          table: schema.table,
          openAiEndpoint: schema.openAiEndpoint,
          openAiApiVersion: schema.openAiApiVersion,
          model: schema.model,
        }
      : {};
    return { ...reported, ...connection };
  }, [schema, connection]);

  if (editable) {
    return (
      <section className={styles.root} aria-labelledby={headingId}>
        <Subtitle2 id={headingId}>{t("ui_ConnectionHeading")}</Subtitle2>
        {failed && <Caption1>{t("ui_ConnectionFailed")}</Caption1>}
        {/* Keyed on the values so the form refills after each connect. */}
        <ConnectionForm
          key={JSON.stringify(current)}
          initial={current}
          busy={busy}
          canReset={connection !== null}
          onConnect={onConnect}
          onReset={onReset}
        />
        <Caption1 className={styles.note}>{t("ui_ConnectionEditCaption")}</Caption1>
      </section>
    );
  }

  const shown = CONNECTION_FIELDS.filter((field) => Boolean(current[field]));
  return (
    <section className={styles.root} aria-labelledby={headingId}>
      <Subtitle2 id={headingId}>{t("ui_ConnectionHeading")}</Subtitle2>
      {status === "ready" && shown.length > 0 && (
        <dl className={styles.list}>
          {shown.map((field) => (
            <div key={field} className={styles.item}>
              <dt className={styles.term}>{t(LABELS[field])}</dt>
              <dd className={styles.value}>{breakAfterDots(current[field] as string)}</dd>
            </div>
          ))}
        </dl>
      )}
      {failed && <Caption1>{t("ui_ConnectionFailed")}</Caption1>}
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
