/** The question box (st.chat_input in app.py). Enter sends, Shift+Enter adds a line. */

import * as React from "react";
import { Button, makeStyles, Textarea, tokens, Tooltip } from "@fluentui/react-components";
import { Send20Filled, Stop20Regular } from "./icons";
import { useStrings } from "../utils/strings";

const useStyles = makeStyles({
  root: { display: "flex", columnGap: tokens.spacingHorizontalS, alignItems: "flex-end" },
  input: { flexGrow: 1 },
});

export interface ComposerProps {
  placeholder: string;
  pending: boolean;
  disabled?: boolean;
  onSend: (question: string) => void;
  onCancel: () => void;
}

export function Composer({ placeholder, pending, disabled, onSend, onCancel }: ComposerProps) {
  const styles = useStyles();
  const t = useStrings();
  const [value, setValue] = React.useState("");

  const submit = () => {
    if (!value.trim() || pending || disabled) {
      return;
    }
    onSend(value);
    setValue("");
  };

  return (
    <div className={styles.root}>
      <Textarea
        className={styles.input}
        value={value}
        placeholder={placeholder}
        aria-label={t("ui_ComposerLabel")}
        title={t("ui_ComposerHint")}
        resize="vertical"
        disabled={disabled}
        onChange={(_, data) => setValue(data.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            submit();
          }
        }}
      />
      {pending ? (
        <Tooltip content={t("ui_Cancel")} relationship="label">
          <Button icon={<Stop20Regular />} onClick={onCancel} />
        </Tooltip>
      ) : (
        <Tooltip content={t("ui_Send")} relationship="label">
          <Button appearance="primary" icon={<Send20Filled />} onClick={submit} disabled={disabled || !value.trim()} />
        </Tooltip>
      )}
    </div>
  );
}
