/** Starter questions shown before the first question (render_examples in app.py). */

import * as React from "react";
import { Body1, Button, makeStyles, MessageBar, MessageBarBody, tokens } from "@fluentui/react-components";
import { useStrings } from "../utils/strings";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", rowGap: tokens.spacingVerticalS, alignItems: "flex-start" },
  hint: { alignSelf: "stretch" },
  question: { textAlign: "left", height: "auto", minHeight: "32px", whiteSpace: "normal", fontWeight: tokens.fontWeightRegular },
});

export interface ExampleQuestionsProps {
  questions: string[];
  hasDictionary: boolean;
  disabled?: boolean;
  onPick: (question: string) => void;
}

export function ExampleQuestions({ questions, hasDictionary, disabled, onPick }: ExampleQuestionsProps) {
  const styles = useStyles();
  const t = useStrings();
  return (
    <div className={styles.root}>
      {!hasDictionary && (
        <MessageBar className={styles.hint} layout="multiline" intent="info">
          <MessageBarBody>{t("ui_ExamplesDictionaryHint")}</MessageBarBody>
        </MessageBar>
      )}
      <Body1>{t("ui_ExamplesIntro")}</Body1>
      {questions.map((question) => (
        <Button key={question} className={styles.question} disabled={disabled} onClick={() => onPick(question)}>
          {question}
        </Button>
      ))}
    </div>
  );
}
