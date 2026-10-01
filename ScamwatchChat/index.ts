/**
 * PCF entry point. Reads the manifest properties, builds the API client once per
 * connection setting, and renders <ChatApp>. Outputs (last question, answer, SQL…)
 * are pushed back to the hosting app through notifyOutputChanged.
 */

import * as React from "react";
import type { Theme } from "@fluentui/react-components";
import { ChatApp, type ChatAppProps } from "./components/ChatApp";
import { HttpChatApi, MisconfiguredChatApi } from "./services/apiClient";
import { defaultRedirectUri, MsalTokenProvider } from "./services/auth";
import { MockChatApi } from "./services/mockApi";
import { DEFAULT_EXAMPLE_QUESTIONS, DEFAULT_PLACEHOLDER, DEFAULT_TITLE } from "./defaults";
import type { ChatApi, ControlOutputs } from "./types";
import { DEFAULT_HISTORY_TURNS, parseLines } from "./utils/format";
import { createTranslator, type Translate } from "./utils/strings";
import type { IInputs, IOutputs } from "./generated/ManifestTypes";

function text(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export class ScamwatchChat implements ComponentFramework.ReactControl<IInputs, IOutputs> {
  private notifyOutputChanged: () => void;
  private outputs: ControlOutputs = {};
  private api: ChatApi;
  private apiKey = "";
  private tokens?: MsalTokenProvider;
  private translate: Translate;

  public init(
    context: ComponentFramework.Context<IInputs>,
    notifyOutputChanged: () => void,
  ): void {
    this.notifyOutputChanged = notifyOutputChanged;
    context.mode.trackContainerResize(true);
    this.translate = createTranslator((key) => context.resources.getString(key));
  }

  public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
    const p = context.parameters;
    const useMock = p.useMockApi?.raw === true;
    const apiBaseUrl = text(p.apiBaseUrl?.raw);
    const redirectUri = text(p.redirectUri?.raw) || defaultRedirectUri();
    this.ensureApi(useMock, apiBaseUrl, text(p.apiScope?.raw), text(p.clientId?.raw), text(p.tenantId?.raw), redirectUri, context);

    const examples = parseLines(p.exampleQuestions?.raw);
    const { allocatedHeight, allocatedWidth } = context.mode;
    const props: ChatAppProps = {
      api: this.api,
      title: text(p.title?.raw) || DEFAULT_TITLE,
      placeholder: text(p.placeholder?.raw) || DEFAULT_PLACEHOLDER,
      exampleQuestions: examples.length ? examples : DEFAULT_EXAMPLE_QUESTIONS,
      showTableOverview: p.showTableOverview?.raw !== false,
      defaultMaxAttempts: p.defaultMaxAttempts?.raw ?? 3,
      allowFollowUps: p.allowFollowUps?.raw !== false,
      historyTurns: p.historyTurns?.raw ?? DEFAULT_HISTORY_TURNS,
      makerDictionary: p.dataDictionary?.raw ?? null,
      makerDictionaryName: text(p.dataDictionaryName?.raw) || null,
      allowDictionaryUpload: p.allowDictionaryUpload?.raw !== false,
      storageNamespace: `${useMock ? "mock" : apiBaseUrl}|${text(p.title?.raw)}`,
      isMock: useMock,
      height: allocatedHeight > 0 ? allocatedHeight : undefined,
      width: allocatedWidth > 0 ? allocatedWidth : undefined,
      theme: context.fluentDesignLanguage?.tokenTheme as Theme | undefined,
      translate: this.translate,
      signIn: this.tokens ? this.signIn : undefined,
      redirectUri: useMock ? undefined : redirectUri,
      onOutputs: this.onOutputs,
    };
    return React.createElement(ChatApp, props);
  }

  public getOutputs(): IOutputs {
    return {
      lastQuestion: this.outputs.lastQuestion,
      lastAnswer: this.outputs.lastAnswer,
      lastSql: this.outputs.lastSql,
      lastRowCount: this.outputs.lastRowCount,
      lastError: this.outputs.lastError,
      activeDictionaryName: this.outputs.activeDictionaryName,
    };
  }

  public destroy(): void {
    // React unmounts the tree; useChat aborts any question still in flight.
  }

  /** Rebuild the client only when connection settings change, so the schema isn't refetched on every render. */
  private ensureApi(
    useMock: boolean,
    baseUrl: string,
    scope: string,
    clientId: string,
    tenantId: string,
    redirectUri: string,
    context: ComponentFramework.Context<IInputs>,
  ): void {
    const key = JSON.stringify([useMock, baseUrl, scope, clientId, tenantId, redirectUri]);
    if (key === this.apiKey && this.api) {
      return;
    }
    this.apiKey = key;
    if (useMock) {
      this.tokens = undefined;
      this.api = new MockChatApi();
      return;
    }
    const missing = Object.entries({ apiBaseUrl: baseUrl, apiScope: scope, clientId })
      .filter(([, value]) => !value)
      .map(([name]) => name);
    if (missing.length) {
      this.tokens = undefined;
      this.api = new MisconfiguredChatApi(missing);
      return;
    }
    const userName = context.userSettings?.userName ?? "";
    this.tokens = new MsalTokenProvider({
      clientId,
      tenantId,
      scope,
      redirectUri,
      loginHint: userName.includes("@") ? userName : undefined,
    });
    this.api = new HttpChatApi(baseUrl, this.tokens);
  }

  private signIn = async (): Promise<void> => {
    await this.tokens?.getToken({ interactive: true });
  };

  private onOutputs = (outputs: ControlOutputs): void => {
    const next = { ...this.outputs, ...outputs };
    const changed = (Object.keys(outputs) as (keyof ControlOutputs)[]).some((key) => this.outputs[key] !== next[key]);
    if (changed) {
      this.outputs = next;
      this.notifyOutputChanged();
    }
  };
}
