/**
 * Preview page for the control, backed by the mock API. Use the toolbar to try
 * the property combinations a maker can set, and watch the outputs the hosting
 * app would receive. URL parameters set the starting state, for screenshots:
 *   ?width=narrow  ?theme=dark  ?dictionary=maker  ?uploads=off  ?connection=edit  ?ask=How%20many%20reports
 */

import * as React from "react";
import * as ReactDOM from "react-dom";
import { webDarkTheme, webLightTheme } from "@fluentui/react-components";
import { ChatApp } from "../ScamwatchChat/components/ChatApp";
import { DEFAULT_EXAMPLE_QUESTIONS } from "../ScamwatchChat/defaults";
import { MockChatApi } from "../ScamwatchChat/services/mockApi";
import type { ControlOutputs } from "../ScamwatchChat/types";

const MAKER_DICTIONARY = `Data dictionary for Reporting.ScamWatchReportFiltered

== About the table ==
One row represents: one scam report made to Scamwatch.
Rows to leave out unless someone asks for them: reports marked as withdrawn.

== Columns ==
report_id (int): unique id of the report.
date_reported (date): the day the report was submitted, not when the scam happened.
amount_lost (decimal): dollars lost, 0 when nothing was lost.
is_loss (bit): 1 when amount_lost > 0.
other_product_name (nvarchar): free text naming the product or service involved. Often blank.
`;

const params = new URLSearchParams(window.location.search);

function Preview() {
  const [narrow, setNarrow] = React.useState(params.get("width") === "narrow");
  const [dark, setDark] = React.useState(params.get("theme") === "dark");
  const [maker, setMaker] = React.useState(params.get("dictionary") === "maker");
  const [uploads, setUploads] = React.useState(params.get("uploads") !== "off");
  const [editConnection, setEditConnection] = React.useState(params.get("connection") === "edit");
  const [outputs, setOutputs] = React.useState<ControlOutputs>({});
  const api = React.useMemo(() => new MockChatApi(), []);
  const onOutputs = React.useCallback((next: ControlOutputs) => setOutputs((o) => ({ ...o, ...next })), []);

  React.useEffect(() => {
    const ask = params.get("ask");
    if (!ask) return;
    // Click an example or type into the box: the simplest way is to reuse the composer.
    const timer = setInterval(() => {
      const box = document.querySelector("textarea");
      if (box && !box.disabled) {
        clearInterval(timer);
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
        setter?.call(box, ask);
        box.dispatchEvent(new Event("input", { bubbles: true }));
        box.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      }
    }, 200);
    return () => clearInterval(timer);
  }, []);

  const bar: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 16,
    alignItems: "center",
    padding: "8px 16px",
    background: "#201f1e",
    color: "#fff",
    fontSize: 13,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={bar}>
        <strong>ScamwatchChat preview (mock API)</strong>
        <label><input type="checkbox" checked={narrow} onChange={(e) => setNarrow(e.target.checked)} /> Phone width</label>
        <label><input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} /> Dark theme</label>
        <label><input type="checkbox" checked={maker} onChange={(e) => setMaker(e.target.checked)} /> Maker dictionary</label>
        <label><input type="checkbox" checked={uploads} onChange={(e) => setUploads(e.target.checked)} /> Allow upload</label>
        <label><input type="checkbox" checked={editConnection} onChange={(e) => setEditConnection(e.target.checked)} /> Allow connection change</label>
        <span style={{ opacity: 0.8 }}>
          Try: “show everything”, “delete old rows”, “now by month”, “cause an error”
        </span>
      </div>
      <div style={{ display: "flex", flex: 1, minHeight: 0, gap: 16, padding: 16 }}>
        <div
          style={{
            flex: narrow ? "0 0 390px" : 1,
            minWidth: 0,
            boxShadow: "0 2px 8px rgba(0,0,0,.15)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <ChatApp
            api={api}
            title="Scamwatch SQL assistant"
            placeholder="Ask about the scam reports…"
            exampleQuestions={DEFAULT_EXAMPLE_QUESTIONS}
            showTableOverview
            defaultMaxAttempts={3}
            defaultPreviewRows={20}
            allowFollowUps
            historyTurns={3}
            makerDictionary={maker ? MAKER_DICTIONARY : null}
            makerDictionaryName="Team dictionary"
            allowDictionaryUpload={uploads}
            allowConnectionChange={editConnection}
            storageNamespace="preview"
            isMock
            theme={dark ? webDarkTheme : webLightTheme}
            onOutputs={onOutputs}
          />
        </div>
        <aside style={{ flex: "0 0 280px", fontSize: 12, overflow: "auto" }}>
          <h3 style={{ marginTop: 0 }}>Output properties</h3>
          {Object.entries(outputs).map(([key, value]) => (
            <div key={key} style={{ marginBottom: 8 }}>
              <code>{key}</code>
              <pre style={{ whiteSpace: "pre-wrap", margin: "2px 0 0", background: "#fff", padding: 4 }}>
                {String(value ?? "")}
              </pre>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

ReactDOM.render(<Preview />, document.getElementById("root"));
