/** Attempts slider, follow-up switch and Clear (render_answering_settings in app.py). */

import * as React from "react";
import { Button, Caption1, Label, makeStyles, Slider, Subtitle2, Switch, tokens, useId } from "@fluentui/react-components";
import { Delete16Regular } from "./icons";
import { MAX_ATTEMPTS, MIN_ATTEMPTS } from "../state/useChat";
import type { AnswerSettings } from "../types";
import { useStrings } from "../utils/strings";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", rowGap: tokens.spacingVerticalS },
  field: { display: "flex", flexDirection: "column", rowGap: tokens.spacingVerticalXXS },
  note: { color: tokens.colorNeutralForeground3 },
});

export interface AnsweringSectionProps {
  settings: AnswerSettings;
  canClear: boolean;
  onChange: (settings: Partial<AnswerSettings>) => void;
  onClear: () => void;
}

export function AnsweringSection({ settings, canClear, onChange, onClear }: AnsweringSectionProps) {
  const styles = useStyles();
  const t = useStrings();
  const headingId = useId("scw-answering");
  const sliderId = useId("scw-attempts");
  return (
    <section className={styles.root} aria-labelledby={headingId}>
      <Subtitle2 id={headingId}>{t("ui_AnsweringHeading")}</Subtitle2>
      <div className={styles.field}>
        <Label htmlFor={sliderId}>{t("ui_Attempts", settings.maxAttempts)}</Label>
        <Slider
          id={sliderId}
          min={MIN_ATTEMPTS}
          max={MAX_ATTEMPTS}
          step={1}
          value={settings.maxAttempts}
          onChange={(_, data) => onChange({ maxAttempts: data.value })}
        />
        <Caption1 className={styles.note}>{t("ui_AttemptsHelp")}</Caption1>
      </div>
      <div className={styles.field}>
        <Switch
          label={t("ui_FollowUps")}
          checked={settings.useHistory}
          onChange={(_, data) => onChange({ useHistory: data.checked })}
        />
        <Caption1 className={styles.note}>{t("ui_FollowUpsHelp")}</Caption1>
      </div>
      <div>
        <Button size="small" icon={<Delete16Regular />} disabled={!canClear} onClick={onClear}>
          {t("ui_ClearConversation")}
        </Button>
      </div>
    </section>
  );
}
