import { tokenizeSql } from "../utils/sql";

const kinds = (sql: string) => tokenizeSql(sql).filter((t) => t.kind !== "plain").map((t) => `${t.kind}:${t.text}`);

describe("tokenizeSql", () => {
  it("gives back the input exactly when the tokens are joined", () => {
    const sql = "SELECT TOP 10 ISNULL(name, N'(blank)') AS [my col] -- note\nFROM t /* c */ WHERE x = 'it''s' AND y >= 1.5e3;";
    expect(tokenizeSql(sql).map((t) => t.text).join("")).toBe(sql);
  });

  it("finds keywords, functions, strings, numbers and comments", () => {
    expect(kinds("select top 10 COUNT(*) AS n FROM t WHERE a = 'x' -- why")).toEqual([
      "keyword:select",
      "keyword:top",
      "number:10",
      "function:COUNT",
      "keyword:AS",
      "keyword:FROM",
      "keyword:WHERE",
      "string:'x'",
      "comment:-- why",
    ]);
  });

  it("leaves identifiers plain, even quoted ones that look like keywords", () => {
    expect(kinds("SELECT [select], \"from\", report_id, t1 FROM x")).toEqual(["keyword:SELECT", "keyword:FROM"]);
  });

  it("reads escaped quotes, N'' strings and unterminated text to the end", () => {
    expect(kinds("N'it''s' 'open")).toEqual(["string:N'it''s'", "string:'open"]);
    expect(kinds("/* never closed\nSELECT")).toEqual(["comment:/* never closed\nSELECT"]);
  });
});
