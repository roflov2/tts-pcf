/** Markdown for answers and questions (st.markdown in app.py). Raw HTML is never rendered. */

import * as React from "react";
import Markdown, { type MarkdownToJSX, RuleType } from "markdown-to-jsx";
import { makeStyles, mergeClasses, shorthands, tokens } from "@fluentui/react-components";
import { hardLineBreaks, protectIdentifiers, protectSpacedMarkers, restoreLiterals } from "../utils/format";

const useStyles = makeStyles({
  root: {
    lineHeight: tokens.lineHeightBase400,
    overflowWrap: "anywhere",
    "& p": { ...shorthands.margin(0, 0, tokens.spacingVerticalS, 0) },
    "& p:last-child": { marginBottom: 0 },
    "& ul, & ol": { ...shorthands.margin(0, 0, tokens.spacingVerticalS, 0), paddingLeft: "20px" },
    "& code": {
      fontFamily: tokens.fontFamilyMonospace,
      fontSize: tokens.fontSizeBase200,
      backgroundColor: tokens.colorNeutralBackground3,
      ...shorthands.padding("1px", "4px"),
      ...shorthands.borderRadius(tokens.borderRadiusSmall),
    },
    "& pre": {
      backgroundColor: tokens.colorNeutralBackground3,
      ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
      ...shorthands.borderRadius(tokens.borderRadiusMedium),
      overflowX: "auto",
    },
    "& pre code": { backgroundColor: "transparent", ...shorthands.padding(0) },
    "& table": { borderCollapse: "collapse", marginBottom: tokens.spacingVerticalS },
    "& th, & td": {
      ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
      ...shorthands.padding("4px", "8px"),
      textAlign: "left",
    },
  },
});

const OPTIONS: MarkdownToJSX.Options = {
  disableParsingRawHTML: true,
  forceBlock: true,
  overrides: { a: { props: { target: "_blank", rel: "noopener noreferrer" } } },
  renderRule: (next, node) => (node.type === RuleType.text ? restoreLiterals(node.text) : next()),
};

export interface MarkdownTextProps {
  text: string;
  /** Keep single line breaks, for text the user typed. Answers follow normal markdown rules. */
  keepLineBreaks?: boolean;
  className?: string;
}

export function MarkdownText({ text, keepLineBreaks, className }: MarkdownTextProps) {
  const styles = useStyles();
  const prepared = React.useMemo(() => {
    const safe = protectSpacedMarkers(protectIdentifiers(text));
    return keepLineBreaks ? hardLineBreaks(safe) : safe;
  }, [text, keepLineBreaks]);
  return (
    <div className={mergeClasses(styles.root, className)}>
      <Markdown options={OPTIONS}>{prepared}</Markdown>
    </div>
  );
}
