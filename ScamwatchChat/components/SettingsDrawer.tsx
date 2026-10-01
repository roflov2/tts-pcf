/**
 * Replaces the Streamlit sidebar. Inline beside the chat when there's room,
 * an overlay on narrow screens (phones, small canvas controls).
 */

import * as React from "react";
import {
  Button,
  Divider,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  InlineDrawer,
  makeStyles,
  OverlayDrawer,
  tokens,
} from "@fluentui/react-components";
import { Dismiss20Regular } from "./icons";
import { useStrings } from "../utils/strings";

const useStyles = makeStyles({
  body: { display: "flex", flexDirection: "column", rowGap: tokens.spacingVerticalL, paddingBottom: tokens.spacingVerticalL },
  inline: { height: "100%" },
});

export interface SettingsDrawerProps {
  open: boolean;
  inline: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function SettingsDrawer({ open, inline, onClose, children }: SettingsDrawerProps) {
  const styles = useStyles();
  const t = useStrings();

  const content = (
    <>
      <DrawerHeader>
        <DrawerHeaderTitle
          action={
            <Button appearance="subtle" aria-label={t("ui_CloseSettings")} icon={<Dismiss20Regular />} onClick={onClose} />
          }
        >
          {t("ui_Settings")}
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        <div className={styles.body}>
          {React.Children.toArray(children).map((child, i) => (
            <React.Fragment key={i}>
              {i > 0 && <Divider />}
              {child}
            </React.Fragment>
          ))}
        </div>
      </DrawerBody>
    </>
  );

  if (inline) {
    return (
      <InlineDrawer open={open} position="end" separator className={styles.inline} size="small">
        {content}
      </InlineDrawer>
    );
  }
  return (
    <OverlayDrawer open={open} position="end" onOpenChange={(_, data) => !data.open && onClose()}>
      {content}
    </OverlayDrawer>
  );
}
