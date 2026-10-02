/**
 * The table's columns and sample rows, plus the active data dictionary
 * (render_table_overview in app.py). Both tables are st.dataframe-style grids.
 */

import * as React from "react";
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Caption1,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import type { DataDictionary, Row, SchemaResponse } from "../types";
import { columnsFromRows, safeFileStem } from "../utils/format";
import { useStrings } from "../utils/strings";
import { ResultsGrid } from "./ResultsGrid";
import { SqlBlock } from "./SqlBlock";

const useStyles = makeStyles({
  panel: { display: "flex", flexDirection: "column", rowGap: tokens.spacingVerticalS, paddingBottom: tokens.spacingVerticalS },
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
  const title = t("ui_ColumnsIn", schema.table, schema.columns.length);
  const stem = safeFileStem(schema.table);

  // The columns as a frame, like the DataFrame app.py built, with the In dictionary checkboxes.
  const { columnNames, columnRows } = React.useMemo(() => {
    const names = [t("ui_Column"), t("ui_Type"), ...(dictionary ? [t("ui_InDictionary")] : [])];
    const rows: Row[] = schema.columns.map((column) => ({
      [names[0]]: column.name,
      [names[1]]: column.type,
      ...(dictionary ? { [names[2]]: mentioned.has(column.name) } : {}),
    }));
    return { columnNames: names, columnRows: rows };
  }, [schema.columns, dictionary, mentioned, t]);
  const sampleColumns = React.useMemo(() => columnsFromRows(schema.sampleRows), [schema.sampleRows]);

  return (
    <Accordion collapsible multiple>
      <AccordionItem value="columns">
        <AccordionHeader size="small">{title}</AccordionHeader>
        <AccordionPanel>
          <div className={styles.panel}>
            <ResultsGrid
              rows={columnRows}
              columnNames={columnNames}
              maxHeight={280}
              ariaLabel={title}
              csvFileName={`columns_${stem}.csv`}
            />
            {dictionary && missing > 0 && <Caption1 className={styles.note}>{t("ui_NotInDictionary", missing)}</Caption1>}
            {schema.sampleRows.length > 0 && (
              <>
                <Caption1 className={styles.note}>{t("ui_SampleRows")}</Caption1>
                <ResultsGrid
                  rows={schema.sampleRows}
                  columnNames={sampleColumns}
                  maxHeight={140}
                  ariaLabel={t("ui_SampleRows")}
                  csvFileName={`sample_rows_${stem}.csv`}
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
              <SqlBlock code={dictionary.text} language="text" className={styles.viewer} />
            </div>
          </AccordionPanel>
        </AccordionItem>
      )}
    </Accordion>
  );
}
