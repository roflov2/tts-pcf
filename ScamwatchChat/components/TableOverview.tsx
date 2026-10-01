/**
 * The table's columns and sample rows, plus the active data dictionary
 * (render_table_overview in app.py).
 */

import * as React from "react";
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Caption1,
  makeStyles,
  shorthands,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  tokens,
} from "@fluentui/react-components";
import { Checkmark16Regular } from "./icons";
import type { DataDictionary, SchemaResponse } from "../types";
import { columnsFromRows } from "../utils/format";
import { useStrings } from "../utils/strings";
import { ResultsGrid } from "./ResultsGrid";
import { SqlBlock } from "./SqlBlock";

const useStyles = makeStyles({
  panel: { display: "flex", flexDirection: "column", rowGap: tokens.spacingVerticalS, paddingBottom: tokens.spacingVerticalS },
  columns: {
    maxHeight: "280px",
    overflowY: "auto",
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
  },
  note: { color: tokens.colorNeutralForeground3 },
  viewer: { maxHeight: "360px", overflowY: "auto" },
});

export interface TableOverviewProps {
  schema: SchemaResponse;
  dictionary: DataDictionary | null;
  /** Column names the dictionary mentions (columnsMentioned). */
  mentioned: Set<string>;
}

export function TableOverview({ schema, dictionary, mentioned }: TableOverviewProps) {
  const styles = useStyles();
  const t = useStrings();
  const missing = schema.columns.length - mentioned.size;

  return (
    <Accordion collapsible multiple>
      <AccordionItem value="columns">
        <AccordionHeader size="small">{t("ui_ColumnsIn", schema.table, schema.columns.length)}</AccordionHeader>
        <AccordionPanel>
          <div className={styles.panel}>
            <div className={styles.columns}>
              <Table size="extra-small" aria-label={t("ui_ColumnsIn", schema.table, schema.columns.length)}>
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>{t("ui_Column")}</TableHeaderCell>
                    <TableHeaderCell>{t("ui_Type")}</TableHeaderCell>
                    {dictionary && <TableHeaderCell>{t("ui_InDictionary")}</TableHeaderCell>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schema.columns.map((column) => (
                    <TableRow key={column.name}>
                      <TableCell>{column.name}</TableCell>
                      <TableCell>{column.type}</TableCell>
                      {dictionary && (
                        <TableCell aria-label={mentioned.has(column.name) ? "yes" : "no"}>
                          {mentioned.has(column.name) ? <Checkmark16Regular /> : null}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {dictionary && missing > 0 && <Caption1 className={styles.note}>{t("ui_NotInDictionary", missing)}</Caption1>}
            {schema.sampleRows.length > 0 && (
              <>
                <Caption1 className={styles.note}>{t("ui_SampleRows")}</Caption1>
                <ResultsGrid
                  rows={schema.sampleRows}
                  columnNames={columnsFromRows(schema.sampleRows)}
                  maxHeight={140}
                  ariaLabel={t("ui_SampleRows")}
                />
              </>
            )}
          </div>
        </AccordionPanel>
      </AccordionItem>

      {dictionary && (
        <AccordionItem value="dictionary">
          <AccordionHeader size="small">{t("ui_DictionaryViewer", dictionary.name)}</AccordionHeader>
          <AccordionPanel>
            <div className={styles.panel}>
              <Caption1 className={styles.note}>{t("ui_DictionaryViewerCaption")}</Caption1>
              <SqlBlock code={dictionary.text} copyable={false} className={styles.viewer} />
            </div>
          </AccordionPanel>
        </AccordionItem>
      )}
    </Accordion>
  );
}
