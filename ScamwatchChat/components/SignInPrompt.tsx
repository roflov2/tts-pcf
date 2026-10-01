/** Shown when silent sign-in failed and a popup (which needs a click) is the only way left. */

import * as React from "react";
import { Body1, Button, Caption1, makeStyles, MessageBar, MessageBarBody, Subtitle2, tokens } from "@fluentui/react-components";
import { PersonKey20Regular } from "./icons";
import { useStrings } from "../utils/strings";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    rowGap: tokens.spacingVerticalM,
    maxWidth: "520px",
  },
  note: { color: tokens.colorNeutralForeground3, wordBreak: "break-all" },
});

export interface SignInPromptProps {
  redirectUri?: string;
  error?: string | null;
  onSignIn: () => void;
}

export function SignInPrompt({ redirectUri, error, onSignIn }: SignInPromptProps) {
  const styles = useStyles();
  const t = useStrings();
  return (
    <div className={styles.root}>
      <Subtitle2>{t("ui_SignInTitle")}</Subtitle2>
      <Body1>{t("ui_SignInBody")}</Body1>
      {error && (
        <MessageBar layout="multiline" intent="warning">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      <Button appearance="primary" icon={<PersonKey20Regular />} onClick={onSignIn}>
        {t("ui_SignIn")}
      </Button>
      {redirectUri && <Caption1 className={styles.note}>{t("ui_SignInRedirect", redirectUri)}</Caption1>}
    </div>
  );
}
