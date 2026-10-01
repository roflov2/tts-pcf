/** A read-only SQL listing with a copy button (st.code in app.py). */

import * as React from "react";
import { Button, makeStyles, mergeClasses, shorthands, tokens, Tooltip } from "@fluentui/react-components";
import { Checkmark16Regular, Copy16Regular } from "./icons";
import { copyText } from "../utils/format";
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
});

export interface SqlBlockProps {
  code: string;
  /** Show the copy button (off for long reference text such as the dictionary viewer). */
  copyable?: boolean;
  className?: string;
}

export function SqlBlock({ code, copyable = true, className }: SqlBlockProps) {
  const styles = useStyles();
  const t = useStrings();
  const [copied, setCopied] = React.useState(false);

  const onCopy = async () => {
    if (await copyText(code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className={styles.wrap}>
      <pre className={mergeClasses(styles.pre, className)}>
        <code>{code}</code>
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
