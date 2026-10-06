/**
 * UI text. English defaults live here so the preview page and tests work without
 * a PCF context; in Power Apps the same keys are read from
 * strings/ScamwatchChat.1033.resx (a test checks the two stay in sync).
 * Placeholders are {0}, {1}, …
 */

import * as React from "react";

export const DEFAULT_STRINGS = {
  ui_Caption:
    "Ask a question in plain English. The assistant writes T-SQL, runs it against {0} in {1}, and explains what it found.",
  ui_Settings: "Settings",
  ui_CloseSettings: "Close settings",
  ui_ClearConversation: "Clear conversation",
  ui_Connecting: "Connecting to the assistant and reading the table schema…",
  ui_ConnectFailed: "Couldn't connect to the assistant.",
  ui_ConnectFailedTo: "Couldn't connect to {0} on {1}.",
  ui_ConnectHelp: "To fix this, check that:",
  ui_ConnectCheckAccount: "you're signed in with a work account that can use the assistant",
  ui_ConnectCheckNetwork: "your network can reach the assistant's API",
  ui_ConnectCheckSite: "the API allows this site",
  ui_ConnectThenRetry: "Then select Try again.",
  ui_ConnectThenSettings: "Then update the connection in Settings if needed and select Connect.",
  ui_ConnectOpenSettings: "Open Settings",
  ui_Retry: "Try again",
  ui_SignInTitle: "Sign in to use the assistant",
  ui_SignInBody: "The assistant needs your work account to run queries for you.",
  ui_SignIn: "Sign in",
  ui_SignInRedirect: "Redirect URI to register for this app: {0}",
  ui_MockBadge: "Mock data",
  ui_Thinking: "Writing and running SQL…",
  ui_Cancel: "Stop",
  ui_Send: "Send",
  ui_ComposerLabel: "Your question",
  ui_ComposerHint: "Enter to send, Shift+Enter for a new line",
  ui_ExamplesIntro: "Ask anything about the table, or start with one of these:",
  ui_ExamplesDictionaryHint:
    "Answers improve when the assistant knows what the columns mean. Upload a data dictionary in Settings, or download the template there to write one.",
  ui_You: "You",
  ui_Assistant: "Assistant",
  ui_DataNoteSuffix: "The full result is in the table below.",
  ui_TabResults: "Results ({0})",
  ui_TabSql: "SQL",
  ui_TabFailed: "Failed attempts ({0})",
  ui_DownloadCsv: "Download CSV",
  ui_CopyCsv: "Copy as CSV",
  ui_Copy: "Copy",
  ui_Copied: "Copied",
  ui_DownloadBlocked: "The download was blocked here. Use Copy as CSV instead.",
  ui_RowsDropped: "This result was too large to keep after the page reloaded. Ask the question again to see it.",
  ui_NoQuery: "(no query)",
  ui_NoErrorMessage: "No error message returned.",
  ui_NoRows: "No rows.",
  ui_NullCell: "None",
  ui_Yes: "Yes",
  ui_No: "No",
  ui_GridSearch: "Search",
  ui_GridSearchPlaceholder: "Search this table",
  ui_GridMatches: "{0} of {1} rows match",
  ui_GridNoMatches: "No rows match the search.",
  ui_GridFullScreen: "Full screen",
  ui_GridCloseFullScreen: "Close full screen",
  ui_GridResizeColumn: "Resize column {0}",
  ui_GridColumns: "Show or hide columns",
  ui_GridColumnMenu: "Column options for {0}",
  ui_GridSortAscending: "Sort ascending",
  ui_GridSortDescending: "Sort descending",
  ui_GridAutosize: "Autosize",
  ui_GridPin: "Pin column",
  ui_GridUnpin: "Unpin column",
  ui_GridHide: "Hide column",
  ui_WrittenWithDictionary: "Written with the data dictionary {0}.",
  ui_ColumnsIn: "Columns in {0} ({1})",
  ui_Column: "Column",
  ui_Type: "Type",
  ui_InDictionary: "In dictionary",
  ui_NotInDictionary:
    "Not named in the dictionary: {0}. For these the assistant goes on the column name, type and sample rows alone.",
  ui_SampleRows: "Sample rows",
  ui_DictionaryViewer: "Data dictionary: {0}",
  ui_DictionaryViewerCaption: "This text is sent to the assistant with each question.",
  ui_ConnectionHeading: "Connection",
  ui_ConnectionServer: "SQL server",
  ui_ConnectionDatabase: "Database",
  ui_ConnectionTable: "Table",
  ui_ConnectionEndpoint: "Azure OpenAI endpoint",
  ui_ConnectionApiVersion: "API version",
  ui_ConnectionModel: "Model deployment",
  ui_ConnectionTableHint: "Schema-qualified, e.g. Reporting.ScamWatchReportFiltered",
  ui_ConnectionConnect: "Connect",
  ui_ConnectionReset: "Use the app's settings",
  ui_ConnectionEditCaption:
    "Blank fields use the API's own setting. The API only connects to the servers, tables and models it allows.",
  ui_ConnectionReconnect: "Reconnect",
  ui_ConnectionConnecting: "Connecting…",
  ui_ConnectionFailed: "Not connected. Fix the problem shown, then reconnect.",
  ui_ConnectionCaption:
    "Set by the assistant's API, which the app points to. Reconnect to reload the table's columns and sample rows.",
  ui_DictionaryHeading: "Data dictionary",
  ui_DictionaryCaption:
    "Optional. A .txt file explaining what the columns mean, what codes stand for, and which rows or definitions your team uses. It's sent with every question to steer the SQL.",
  ui_DictionaryDrop: "Drag and drop a .txt file here",
  ui_DictionaryLimit: "Limit {0} MB per file • TXT",
  ui_DictionaryBrowse: "Browse files",
  ui_DictionaryRemove: "Remove {0}",
  ui_DictionaryReading: "Reading {0}…",
  ui_DictionaryWrongType: "{0} isn't a .txt file. Save it as plain text (.txt) and upload it again.",
  ui_DictionaryReadFailed: "{0} couldn't be read. {1}",
  ui_DictionaryStatus: "{0} is used for new questions. Names {1} of {2} columns in {3}.",
  ui_DictionaryMakerStatus: "{0} (set by the app) is used for new questions. Names {1} of {2} columns in {3}.",
  ui_DictionaryMakerFallback: "Remove your file to go back to {0}, which the app provides.",
  ui_DictionaryTruncated:
    "Only the first {0} characters are sent. Cut the file down to what matters for querying so nothing important is lost.",
  ui_DictionaryTemplate: "Download a template for this table",
  ui_DictionaryTemplateHelp: "A .txt file listing every column, ready for you to add descriptions.",
  ui_AnsweringHeading: "Answering",
  ui_Attempts: "SQL attempts per question: {0}",
  ui_AttemptsHelp: "How many times the model may rewrite a query that fails.",
  ui_PreviewRows: "Rows the model reads per result",
  ui_PreviewRowsHelp: "Only limits what's sent to the model. The full result always appears in the table.",
  ui_FollowUps: "Allow follow-up questions",
  ui_FollowUpsHelp:
    "Sends your last few questions and answers with each new one, so you can ask things like “now break that down by month”.",
} as const;

export type StringKey = keyof typeof DEFAULT_STRINGS;
export type Translate = (key: StringKey, ...args: (string | number)[]) => string;

export function format(template: string, args: (string | number)[]): string {
  return template.replace(/\{(\d+)\}/g, (match, index: string) => {
    const value = args[Number(index)];
    return value === undefined ? match : String(value);
  });
}

/** Build a translator. lookup is context.resources.getString inside Power Apps. */
export function createTranslator(lookup?: (key: string) => string): Translate {
  return (key, ...args) => {
    let template: string = DEFAULT_STRINGS[key];
    if (lookup) {
      try {
        const found = lookup(key);
        if (found && found !== key) {
          template = found;
        }
      } catch {
        // Fall back to the built-in English text.
      }
    }
    return format(template, args);
  };
}

export const StringsContext = React.createContext<Translate>(createTranslator());

export function useStrings(): Translate {
  return React.useContext(StringsContext);
}
