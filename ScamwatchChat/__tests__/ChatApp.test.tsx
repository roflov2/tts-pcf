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

  it("adjusts the records shown to the model in settings", async () => {
    renderApp();
    await screen.findByText(/runs it against/);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByText("Records shown to the model: 20")).toBeInTheDocument();
  });

  it("uploads a dictionary from the settings drawer", async () => {
    renderApp();
    await screen.findByText(/runs it against/);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const drawer = await screen.findByRole("dialog");

    const file = new File(["report_id (int): unique id\nstate: where the person lives\n"], "dictionary.txt", { type: "text/plain" });
    if (!("arrayBuffer" in file)) {
      // jsdom's File lacks arrayBuffer(); Blob in browsers has it.
      Object.defineProperty(file, "arrayBuffer", {
        value: () => Promise.resolve(new TextEncoder().encode("report_id (int): unique id\nstate: where the person lives\n").buffer),
      });
    }
    const input = drawer.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(await within(drawer).findByText(/dictionary\.txt is used for new questions\. Names 2 of 9 columns/)).toBeInTheDocument();
  });
});
