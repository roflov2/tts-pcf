/** Title, caption and the Settings / Clear buttons (st.title and caption in app.py). */

import * as React from "react";
import { Badge, Button, Caption1, makeStyles, Subtitle1, tokens, Tooltip } from "@fluentui/react-components";
import { Delete20Regular, Settings20Regular } from "./icons";
import { useStrings } from "../utils/strings";

const useStyles = makeStyles({
  root: { display: "flex", alignItems: "flex-start", columnGap: tokens.spacingHorizontalM },
  text: { display: "flex", flexDirection: "column", rowGap: tokens.spacingVerticalXXS, flexGrow: 1, minWidth: 0 },
  titleRow: { display: "flex", alignItems: "center", columnGap: tokens.spacingHorizontalS },
  caption: { color: tokens.colorNeutralForeground3 },
  badge: { flexShrink: 0, whiteSpace: "nowrap" },
  actions: { display: "flex", columnGap: tokens.spacingHorizontalXS, flexShrink: 0 },
});

export interface HeaderProps {
  title: string;
  caption?: string;
  isMock: boolean;
  canClear: boolean;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  onClear: () => void;
}

export function Header({ title, caption, isMock, canClear, settingsOpen, onToggleSettings, onClear }: HeaderProps) {
  const styles = useStyles();
  const t = useStrings();
  return (
    <header className={styles.root}>
      <div className={styles.text}>
        <div className={styles.titleRow}>
          <Subtitle1 as="h2">{title}</Subtitle1>
          {isMock && (
            <Badge className={styles.badge} appearance="tint" color="warning" size="small">
              {t("ui_MockBadge")}
            </Badge>
          )}
        </div>
        {caption && <Caption1 className={styles.caption}>{caption}</Caption1>}
      </div>
      <div className={styles.actions}>
        <Tooltip content={t("ui_ClearConversation")} relationship="label">
          <Button appearance="subtle" icon={<Delete20Regular />} disabled={!canClear} onClick={onClear} />
        </Tooltip>
        <Tooltip content={t("ui_Settings")} relationship="label">
          <Button
            appearance={settingsOpen ? "secondary" : "subtle"}
            icon={<Settings20Regular />}
            aria-pressed={settingsOpen}
            onClick={onToggleSettings}
          />
        </Tooltip>
      </div>
    </header>
  );
}
