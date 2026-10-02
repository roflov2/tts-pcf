/**
 * The conversation: user and assistant turns, plus the "thinking" row (st.chat_message
 * loop in app.py). Questions render as markdown, as st.markdown showed them.
 */

import * as React from "react";
import { Avatar, Button, makeStyles, mergeClasses, shorthands, Spinner, tokens } from "@fluentui/react-components";
import { Bot20Regular, Person20Regular, Stop16Regular } from "./icons";
import type { ChatMessage } from "../types";
import { useStrings } from "../utils/strings";
import { AssistantMessage } from "./AssistantMessage";
import { MarkdownText } from "./MarkdownText";

const useStyles = makeStyles({
  list: { display: "flex", flexDirection: "column", rowGap: tokens.spacingVerticalL },
  turn: { display: "flex", columnGap: tokens.spacingHorizontalM, alignItems: "flex-start" },
  body: { flexGrow: 1, minWidth: 0, paddingTop: "4px" },
  user: {
    display: "inline-block",
    maxWidth: "100%",
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorNeutralForeground1,
    overflowWrap: "anywhere",
  },
  thinking: { display: "flex", alignItems: "center", columnGap: tokens.spacingHorizontalM },
});

export interface ChatTranscriptProps {
  messages: ChatMessage[];
  pending: boolean;
  onCancel: () => void;
}

export function ChatTranscript({ messages, pending, onCancel }: ChatTranscriptProps) {
  const styles = useStyles();
  const t = useStrings();

  return (
    <div className={styles.list} role="log" aria-live="polite" aria-relevant="additions">
      {messages.map((message, index) => (
        <div key={message.id} className={styles.turn}>
          {message.role === "user" ? (
            <>
              <Avatar size={28} icon={<Person20Regular />} color="neutral" aria-label={t("ui_You")} />
              <div className={styles.body}>
                <div className={styles.user}>
                  <MarkdownText text={message.content} keepLineBreaks />
                </div>
              </div>
            </>
          ) : (
            <>
              <Avatar size={28} icon={<Bot20Regular />} color="brand" aria-label={t("ui_Assistant")} />
              <div className={styles.body}>
                <AssistantMessage message={message} index={index} />
              </div>
            </>
          )}
        </div>
      ))}
      {pending && (
        <div className={styles.turn}>
          <Avatar size={28} icon={<Bot20Regular />} color="brand" aria-label={t("ui_Assistant")} />
          <div className={mergeClasses(styles.body, styles.thinking)}>
            <Spinner size="tiny" label={t("ui_Thinking")} />
            <Button size="small" appearance="subtle" icon={<Stop16Regular />} onClick={onCancel}>
              {t("ui_Cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
