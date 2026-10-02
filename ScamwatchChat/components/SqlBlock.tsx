/**
 * A read-only code listing with a copy button (st.code in app.py). SQL is syntax
 * highlighted, as st.code(sql, language="sql") showed it.
 */

import * as React from "react";
import { Button, makeStyles, mergeClasses, shorthands, tokens, Tooltip } from "@fluentui/react-components";
import { Checkmark16Regular, Copy16Regular } from "./icons";
import { copyText } from "../utils/format";
import { type SqlTokenKind, tokenizeSql } from "../utils/sql";
import { useStrings } from "../utils/strings";

const useStyles = makeStyles({
  wrap: { position: "relative" },
  pre: {
    ...shorthands.margin(0),
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    paddingRight: "40px",
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground3,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase300,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    overflowX: "auto",
  },
  copy: { position: "absolute", top: tokens.spacingVerticalXS, right: tokens.spacingHorizontalXS },
  keyword: { color: tokens.colorPaletteBlueForeground2 },
  function: { color: tokens.colorPaletteBerryForeground1 },
  string: { color: tokens.colorPaletteGreenForeground1 },
  number: { color: tokens.colorPaletteDarkOrangeForeground1 },
  comment: { color: tokens.colorNeutralForeground3, fontStyle: "italic" },
});

export interface SqlBlockProps {
  code: string;
  /** "sql" highlights the code; "text" shows it as is (the dictionary viewer). */
  language?: "sql" | "text";
  /** Show the copy button. st.code always had one. */
  copyable?: boolean;
  className?: string;
}

export function SqlBlock({ code, language = "sql", copyable = true, className }: SqlBlockProps) {
  const styles = useStyles();
  const t = useStrings();
  const [copied, setCopied] = React.useState(false);
  const highlighted = React.useMemo(() => {
    if (language !== "sql") {
      return code;
    }
    const classes: Record<Exclude<SqlTokenKind, "plain">, string> = styles;
    return tokenizeSql(code).map((token, i) =>
      token.kind === "plain" ? token.text : (
        <span key={i} className={classes[token.kind]}>
          {token.text}
        </span>
      ),
    );
  }, [code, language, styles]);

  const onCopy = async () => {
    if (await copyText(code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className={styles.wrap}>
      <pre className={mergeClasses(styles.pre, className)}>
        <code>{highlighted}</code>
      </pre>
      {copyable && (
        <Tooltip content={copied ? t("ui_Copied") : t("ui_Copy")} relationship="label">
          <Button
            className={styles.copy}
            size="small"
            appearance="subtle"
            icon={copied ? <Checkmark16Regular /> : <Copy16Regular />}
            onClick={onCopy}
          />
        </Tooltip>
      )}
    </div>
  );
}
