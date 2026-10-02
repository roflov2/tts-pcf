import * as React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { answerTabs } from "../components/AssistantMessage";
import { ChatApp, type ChatAppProps } from "../components/ChatApp";
import { DEFAULT_EXAMPLE_QUESTIONS } from "../defaults";
import { ApiError, MisconfiguredChatApi } from "../services/apiClient";
import { MockChatApi } from "../services/mockApi";
import type { AssistantChatMessage, ChatApi, QueryRequest } from "../types";
import { createTranslator } from "../utils/strings";

const t = createTranslator();

function renderApp(overrides: Partial<ChatAppProps> = {}) {
  const props: ChatAppProps = {
    api: new MockChatApi(0),
    title: "Scamwatch SQL assistant",
    placeholder: "Ask about the scam reports…",
    exampleQuestions: DEFAULT_EXAMPLE_QUESTIONS,
    showTableOverview: true,
    defaultMaxAttempts: 3,
    defaultPreviewRows: 20,
    allowFollowUps: true,
    historyTurns: 3,
    allowDictionaryUpload: true,
    storageNamespace: `test-${Math.random()}`,
    isMock: true,
    ...overrides,
  };
  return render(<ChatApp {...props} />);
}

beforeEach(() => window.sessionStorage.clear());

/** A File with arrayBuffer(), which jsdom's File lacks. */
function textFile(content: string, name: string): File {
  const file = new File([content], name, { type: "text/plain" });
  if (!("arrayBuffer" in file)) {
    Object.defineProperty(file, "arrayBuffer", { value: () => Promise.resolve(new TextEncoder().encode(content).buffer) });
  }
  return file;
}

describe("answerTabs (render_answer tab rules)", () => {
  const base: AssistantChatMessage = {
    role: "assistant",
    id: "1",
    content: "x",
    attempts: [],
    columnNames: [],
    rows: null,
    totalRows: 0,
    truncated: false,
  };

  it("shows no tabs for a plain answer", () => {
    expect(answerTabs(base, t)).toEqual([]);
  });

  it("shows results, SQL and failed attempts when each has content", () => {
    const message = {
      ...base,
      rows: [{ a: 1 }],
      totalRows: 50000,
      truncated: true,
      sql: "SELECT 1",
      attempts: [
        { query: "DELETE", success: false, error: "no" },
        { query: "SELECT 1", success: true },
      ],
    };
    expect(answerTabs(message, t).map((tab) => tab.label)).toEqual([
      "Results (50,000+ rows)",
      "SQL",
      "Failed attempts (1)",
    ]);
  });
});

describe("ChatApp with the mock API", () => {
  it("loads the schema, shows the examples and the dictionary hint", async () => {
    renderApp();
    expect(await screen.findByText(/runs it against Reporting\.ScamWatchReportFiltered in NASC_ODS/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: DEFAULT_EXAMPLE_QUESTIONS[1] })).toBeInTheDocument();
    expect(screen.getByText(/Answers improve when the assistant knows what the columns mean/)).toBeInTheDocument();
  });

  it("answers an example question and reports outputs", async () => {
    const onOutputs = jest.fn();
    renderApp({ onOutputs });
    fireEvent.click(await screen.findByRole("button", { name: DEFAULT_EXAMPLE_QUESTIONS[1] }));

    expect(await screen.findByText(/reports in the table/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Results (1 row)" })).toBeInTheDocument();
    await waitFor(() =>
      expect(onOutputs).toHaveBeenCalledWith(
        expect.objectContaining({ lastQuestion: DEFAULT_EXAMPLE_QUESTIONS[1], lastRowCount: 1, lastError: "" }),
      ),
    );
    // Examples disappear once the conversation starts.
    expect(screen.queryByRole("button", { name: DEFAULT_EXAMPLE_QUESTIONS[0] })).not.toBeInTheDocument();
  });

  it("sends the maker's dictionary and history with follow-up questions", async () => {
    const api = new MockChatApi(0);
    const spy = jest.spyOn(api, "query");
    renderApp({ api, makerDictionary: "report_id: the key", makerDictionaryName: "Team rules" });

    const box = await screen.findByRole("textbox", { name: "Your question" });
    await waitFor(() => expect(box).not.toBeDisabled());
    fireEvent.change(box, { target: { value: "How many reports?" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await screen.findByText(/reports in the table/);

    fireEvent.change(box, { target: { value: "now by month" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await screen.findByText(/Reports by month/);

    const second = spy.mock.calls[1][0] as QueryRequest;
    expect(second.dataDictionary).toBe("report_id: the key");
    expect(second.history.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(second.history[1].content).toContain("SQL used:\nSELECT COUNT(*)");
    // The hint is gone because a dictionary is active.
    expect(screen.queryByText(/Answers improve/)).not.toBeInTheDocument();
  });

  it("shows failed attempts and an inline error without breaking the chat", async () => {
    renderApp();
    const box = await screen.findByRole("textbox", { name: "Your question" });
    await waitFor(() => expect(box).not.toBeDisabled());

    fireEvent.change(box, { target: { value: "delete old rows" } });
    fireEvent.keyDown(box, { key: "Enter" });
    const failedTab = await screen.findByRole("tab", { name: "Failed attempts (2)" });
    fireEvent.click(failedTab);
    expect(await screen.findByText("'DELETE' is not allowed in a read-only query.")).toBeInTheDocument();

    fireEvent.change(box, { target: { value: "cause an error" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(await screen.findByText(/RateLimitError/)).toBeInTheDocument();
  });

  it("explains which properties are missing when the control isn't configured", async () => {
    renderApp({ api: new MisconfiguredChatApi(["apiBaseUrl", "clientId"]), isMock: false });
    const alert = await screen.findByText(/Set these control properties: apiBaseUrl, clientId/);
    expect(alert).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("asks the user to sign in when silent sign-in fails", async () => {
    const api: ChatApi = {
      getSchema: () => Promise.reject(new ApiError("signin", "Sign in.")),
      query: () => Promise.reject(new Error("unused")),
    };
    const signIn = jest.fn().mockResolvedValue(undefined);
    renderApp({ api, signIn, isMock: false, redirectUri: "https://apps.powerapps.com" });
    const button = await screen.findByRole("button", { name: "Sign in" });
    expect(screen.getByText(/Redirect URI to register for this app: https:\/\/apps\.powerapps\.com/)).toBeInTheDocument();
    fireEvent.click(button);
    await waitFor(() => expect(signIn).toHaveBeenCalled());
  });

  it("uploads a dictionary from the settings drawer", async () => {
    renderApp();
    await screen.findByText(/runs it against/);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const drawer = await screen.findByRole("dialog");

    const input = drawer.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [textFile("report_id (int): unique id\nstate: where the person lives\n", "dictionary.txt")] } });

    expect(await within(drawer).findByText(/dictionary\.txt is used for new questions\. Names 2 of 9 columns/)).toBeInTheDocument();
  });

  it("takes a dictionary dropped on the upload area, like st.file_uploader, and only .txt files", async () => {
    renderApp();
    await screen.findByText(/runs it against/);
    fireEvent.click(screen.getByLabelText("Settings"));
    const drawer = await screen.findByRole("dialog", { hidden: true });
    const zone = within(drawer).getByRole("group", { name: "Drag and drop a .txt file here", hidden: true });

    fireEvent.drop(zone, { dataTransfer: { files: [textFile("x", "notes.pdf")], types: ["Files"] } });
    expect(await within(drawer).findByText(/notes\.pdf isn't a \.txt file/)).toBeInTheDocument();

    const text = "report_id (int): unique id\n";
    fireEvent.drop(zone, { dataTransfer: { files: [textFile(text, "dictionary.txt")], types: ["Files"] } });
    expect(await within(drawer).findByText(/dictionary\.txt is used for new questions\. Names 1 of 9 columns/)).toBeInTheDocument();
    expect(within(drawer).getByText(`${new TextEncoder().encode(text).length} B`)).toBeInTheDocument();
    expect(within(drawer).queryByText(/isn't a \.txt file/)).not.toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole("button", { name: "Remove dictionary.txt", hidden: true }));
    await waitFor(() => expect(within(drawer).queryByText(/dictionary\.txt is used/)).not.toBeInTheDocument());
  });

  it("shows the connection and the rows the model reads, and reconnects without losing the chat", async () => {
    const api = new MockChatApi(0);
    const getSchema = jest.spyOn(api, "getSchema");
    const query = jest.spyOn(api, "query");
    renderApp({ api });
    const box = await screen.findByLabelText("Your question");
    await waitFor(() => expect(box).not.toBeDisabled());

    fireEvent.click(screen.getByLabelText("Settings"));
    const drawer = await screen.findByRole("dialog", { hidden: true });
    expect(within(drawer).getByText("sqlserver.example.com")).toBeInTheDocument();
    expect(within(drawer).getByText("Reporting.ScamWatchReportFiltered")).toBeInTheDocument();
    expect(within(drawer).getByText("gpt-4o")).toBeInTheDocument();

    const rows = within(drawer).getByLabelText("Rows the model reads per result");
    expect(rows).toHaveValue("20");
    fireEvent.change(rows, { target: { value: "150" } });
    fireEvent.blur(rows);
    await waitFor(() => expect(rows).toHaveValue("150"));

    fireEvent.change(box, { target: { value: "How many reports?" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await screen.findByText(/reports in the table/);
    expect((query.mock.calls[0][0] as QueryRequest).maxPreviewRows).toBe(150);

    const reconnect = within(drawer).getByText("Reconnect").closest("button") as HTMLButtonElement;
    fireEvent.click(reconnect);
    await waitFor(() => expect(getSchema).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(reconnect).not.toBeDisabled());
    expect(screen.getByText(/reports in the table/)).toBeInTheDocument();
  });

  it("renders questions as markdown and searches and expands results like st.dataframe", async () => {
    renderApp();
    const box = await screen.findByLabelText("Your question");
    await waitFor(() => expect(box).not.toBeDisabled());
    fireEvent.change(box, { target: { value: "How many reports, **in total**?" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await screen.findByText("Results (1 row)");
    expect(screen.getByText("in total", { selector: "strong" })).toBeInTheDocument();

    // Label queries: role queries compute styles for every element, which is slow in jsdom.
    fireEvent.click(screen.getByLabelText("Search", { selector: "button" }));
    const search = screen.getByLabelText("Search", { selector: "input" });
    fireEvent.change(search, { target: { value: "4000" } });
    expect(await screen.findByText("1 of 1 rows match")).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "no such value" } });
    expect(await screen.findByText("No rows match the search.")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Full screen"));
    const dialog = await screen.findByRole("dialog", { hidden: true });
    expect(dialog.querySelector('[role="table"][aria-label="Results (1 row)"]')).not.toBeNull();
  });

  it("keeps the user's answering settings when the control is shown again", async () => {
    const storageNamespace = "settings-test";
    const first = renderApp({ storageNamespace });
    await screen.findByText(/runs it against/);
    fireEvent.click(screen.getByLabelText("Settings"));
    const drawer = await screen.findByRole("dialog", { hidden: true });
    const followUps = within(drawer).getByRole("switch", { name: "Allow follow-up questions", hidden: true });
    fireEvent.click(followUps);
    await waitFor(() => expect(followUps).not.toBeChecked());
    first.unmount();

    renderApp({ storageNamespace });
    await screen.findByText(/runs it against/);
    fireEvent.click(screen.getByLabelText("Settings"));
    expect(within(await screen.findByRole("dialog", { hidden: true })).getByRole("switch", { name: "Allow follow-up questions", hidden: true })).not.toBeChecked();
  });
});
