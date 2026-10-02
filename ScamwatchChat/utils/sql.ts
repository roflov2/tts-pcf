/**
 * A small T-SQL tokenizer for syntax highlighting (st.code(sql, language="sql") in
 * app.py). It only colours text: joining the tokens gives back the input exactly.
 */

export type SqlTokenKind = "keyword" | "function" | "string" | "number" | "comment" | "plain";

export interface SqlToken {
  kind: SqlTokenKind;
  text: string;
}

const KEYWORDS = new Set(
  `ADD ALL ALTER AND ANY APPLY AS ASC BETWEEN BIGINT BIT BY CASE CHAR CREATE CROSS CURRENT DATE DATETIME
  DATETIME2 DECIMAL DECLARE DELETE DENY DESC DISTINCT DROP ELSE END ESCAPE EXCEPT EXEC EXECUTE EXISTS FETCH
  FIRST FLOAT FOLLOWING FOR FROM FULL GRANT GROUP HAVING IN INNER INSERT INT INTERSECT INTO IS JOIN LEFT LIKE
  MERGE NCHAR NEXT NOLOCK NOT NULL NUMERIC NVARCHAR OFFSET ON ONLY OR ORDER OUTER OVER PARTITION PERCENT PIVOT
  PRECEDING RANGE REVOKE RIGHT ROW ROWS SELECT SET SMALLINT TABLE TABLESAMPLE THEN TIES TIME TINYINT TOP
  TRUNCATE UNBOUNDED UNION UNPIVOT UPDATE VALUES VARCHAR VIEW WHEN WHERE WITH`
    .split(/\s+/)
    .filter(Boolean),
);

// Comments, strings, [bracketed] and "quoted" identifiers, numbers, then words.
// Unterminated strings and comments run to the end, as SQL Server reads them.
const TOKEN =
  /(--[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|(N?'(?:[^']|'')*(?:'|$))|(\[[^\]\n]*\]?|"[^"\n]*"?)|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|([A-Za-z_@#][\w@#$]*)/g;

const CALL = /\s*\(/y;

/** A word followed by "(" is a function call: COUNT(, ISNULL(, FORMAT(. */
function isCall(sql: string, end: number): boolean {
  CALL.lastIndex = end;
  return CALL.test(sql);
}

export function tokenizeSql(sql: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  const push = (kind: SqlTokenKind, text: string) => {
    const last = tokens[tokens.length - 1];
    if (last && last.kind === kind && kind === "plain") {
      last.text += text;
    } else if (text) {
      tokens.push({ kind, text });
    }
  };

  let index = 0;
  for (const match of sql.matchAll(TOKEN)) {
    const start = match.index ?? 0;
    push("plain", sql.slice(index, start));
    const [text, comment, string, identifier, number, word] = match;
    if (comment) {
      push("comment", text);
    } else if (string) {
      push("string", text);
    } else if (identifier) {
      push("plain", text);
    } else if (number) {
      push("number", text);
    } else if (word && KEYWORDS.has(word.toUpperCase())) {
      push("keyword", text);
    } else if (word && isCall(sql, start + text.length)) {
      push("function", text);
    } else {
      push("plain", text);
    }
    index = start + text.length;
  }
  push("plain", sql.slice(index));
  return tokens;
}
