/**
 * Root of the control (main() in app.py): loads the table schema, then shows the
 * header, table overview, conversation and question box, with settings in a drawer.
 */

import * as React from "react";
import {
  Body1,
  Button,
  FluentProvider,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  shorthands,
  Spinner,
  type Theme,
  tokens,
  webLightTheme,
} from "@fluentui/react-components";
import { DEFAULT_MAKER_DICTIONARY_NAME } from "../defaults";
import { ApiError } from "../services/apiClient";
import { useChat } from "../state/useChat";
import type { ChatApi, ControlOutputs, SchemaResponse } from "../types";
import { columnsMentioned, DEFAULT_MAX_DICTIONARY_CHARS } from "../utils/dictionary";
import { createTranslator, StringsContext, type Translate } from "../utils/strings";
import { AnsweringSection } from "./AnsweringSection";
import { ChatTranscript } from "./ChatTranscript";
import { Composer } from "./Composer";
import { DictionarySection } from "./DictionarySection";
import { ExampleQuestions } from "./ExampleQuestions";
import { Header } from "./Header";
import { SettingsDrawer } from "./SettingsDrawer";
import { SignInPrompt } from "./SignInPrompt";
import { TableOverview } from "./TableOverview";

/** Below this width the settings open as an overlay instead of beside the chat. */
export const INLINE_DRAWER_MIN_WIDTH = 900;
const MIN_HEIGHT = 520;

const useStyles = makeStyles({
  root: {
    display: "flex",
    height: "100%",
    width: "100%",
    maxWidth: "100%",
    minHeight: `${MIN_HEIGHT}px`,
    boxSizing: "border-box",
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    fontFamily: tokens.fontFamilyBase,
    overflow: "hidden",
  },
  main: { display: "flex", flexDirection: "column", flexGrow: 1, minWidth: 0 },
  header: { ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalL, tokens.spacingVerticalS) },
  scroll: {
    flexGrow: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalL,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalL, tokens.spacingVerticalL),
  },
  composer: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalL, tokens.spacingVerticalM),
    ...shorthands.borderTop("1px", "solid", tokens.colorNeutralStroke2),
  },
  centered: { display: "flex", flexDirection: "column", rowGap: tokens.spacingVerticalM, alignItems: "flex-start" },
});

export interface ChatAppProps {
  api: ChatApi;
  title: string;
  placeholder: string;
  exampleQuestions: string[];
  showTableOverview: boolean;
  defaultMaxAttempts: number;
  allowFollowUps: boolean;
  historyTurns: number;
  /** The app maker's dictionary text (dataDictionary property). */
  makerDictionary?: string | null;
  makerDictionaryName?: string | null;
  allowDictionaryUpload: boolean;
  /** Keys session storage; give each control instance its own. */
  storageNamespace: string;
  isMock: boolean;
  /** Pixel size allocated by the host; the control fills its container when unset. */
  height?: number;
  width?: number;
  theme?: Theme;
  translate?: Translate;
  /** Interactive sign-in (opens the popup). Only provided when the real API is used. */
  signIn?: () => Promise<void>;
  redirectUri?: string;
  onOutputs?: (outputs: ControlOutputs) => void;
}

type SchemaState =
  | { status: "loading" }
  | { status: "ready"; schema: SchemaResponse }
  | { status: "signin"; error?: string | null }
  | { status: "error"; error: string };

function useElementWidth(ref: React.RefObject<HTMLElement>): number {
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

export function ChatApp(props: ChatAppProps) {
  const t = React.useMemo(() => props.translate ?? createTranslator(), [props.translate]);
  return (
    <StringsContext.Provider value={t}>
      <FluentProvider theme={props.theme ?? webLightTheme} style={{ height: "100%", background: "transparent" }}>
        <ChatAppBody {...props} t={t} />
      </FluentProvider>
    </StringsContext.Provider>
  );
}

function ChatAppBody(props: ChatAppProps & { t: Translate }) {
  const { api, t, onOutputs } = props;
  const styles = useStyles();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const width = useElementWidth(rootRef);
  const inline = width >= INLINE_DRAWER_MIN_WIDTH;
  const [settingsChoice, setSettingsChoice] = React.useState<boolean | null>(null);
  const settingsOpen = settingsChoice ?? inline;

  const [schemaState, setSchemaState] = React.useState<SchemaState>({ status: "loading" });
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    const abort = new AbortController();
    setSchemaState({ status: "loading" });
    api.getSchema(abort.signal).then(
      (schema) => setSchemaState({ status: "ready", schema }),
      (error: unknown) => {
        if (abort.signal.aborted) return;
        if (error instanceof ApiError && error.kind === "signin") {
          setSchemaState({ status: "signin" });
        } else {
          setSchemaState({ status: "error", error: error instanceof Error ? error.message : String(error) });
        }
      },
    );
    return () => abort.abort();
  }, [api, reloadKey]);

  const schema = schemaState.status === "ready" ? schemaState.schema : null;
  const maxChars = schema?.limits?.maxDictionaryChars ?? DEFAULT_MAX_DICTIONARY_CHARS;

  const onSignInRequired = React.useCallback(() => setSchemaState({ status: "signin" }), []);
  const maker = React.useMemo(
    () => ({ text: props.makerDictionary, name: props.makerDictionaryName }),
    [props.makerDictionary, props.makerDictionaryName],
  );
  const { state, dictionary, ask, cancel, clear, updateSettings, setUploaded } = useChat({
    api,
    storageNamespace: props.storageNamespace,
    historyTurns: props.historyTurns,
    initialSettings: { maxAttempts: props.defaultMaxAttempts, useHistory: props.allowFollowUps },
    maker,
    allowUpload: props.allowDictionaryUpload,
    maxDictionaryChars: maxChars,
    onOutputs,
    onSignInRequired,
  });

  const mentioned = React.useMemo(
    () => (dictionary && schema ? columnsMentioned(dictionary.text, schema.columns.map((c) => c.name)) : new Set<string>()),
    [dictionary, schema],
  );

  React.useEffect(() => {
    onOutputs?.({ activeDictionaryName: dictionary?.name ?? "" });
  }, [dictionary?.name, onOutputs]);

  // Keep the newest turn in view.
  React.useEffect(() => {
    const element = scrollRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [state.messages.length, state.pending]);

  const signIn = async () => {
    if (!props.signIn) return;
    try {
      await props.signIn();
      setReloadKey((k) => k + 1);
    } catch (error) {
      setSchemaState({ status: "signin", error: error instanceof Error ? error.message : String(error) });
    }
  };

  const caption = schema ? t("ui_Caption", schema.table, schema.database) : undefined;
  const canClear = state.messages.length > 0 && !state.pending;

  let body: React.ReactNode;
  if (schemaState.status === "loading") {
    body = <Spinner size="small" label={t("ui_Connecting")} labelPosition="after" />;
  } else if (schemaState.status === "signin") {
    body = <SignInPrompt redirectUri={props.redirectUri} error={schemaState.error} onSignIn={signIn} />;
  } else if (schemaState.status === "error") {
    body = (
      <div className={styles.centered}>
        <MessageBar layout="multiline" intent="error">
          <MessageBarBody>
            <MessageBarTitle>{t("ui_ConnectFailed")}</MessageBarTitle>
            {schemaState.error}
          </MessageBarBody>
        </MessageBar>
        <Body1>{t("ui_ConnectHelp")}</Body1>
        <Button onClick={() => setReloadKey((k) => k + 1)}>{t("ui_Retry")}</Button>
      </div>
    );
  } else {
    body = (
      <>
        {props.showTableOverview && <TableOverview schema={schemaState.schema} dictionary={dictionary} mentioned={mentioned} />}
        <ChatTranscript messages={state.messages} pending={state.pending} onCancel={cancel} />
        {state.messages.length === 0 && !state.pending && (
          <ExampleQuestions questions={props.exampleQuestions} hasDictionary={dictionary !== null} onPick={ask} />
        )}
      </>
    );
  }

  return (
    <div
      ref={rootRef}
      className={styles.root}
      style={{
        ...(props.height && props.height > 0 ? { height: props.height, minHeight: 0 } : {}),
        ...(props.width && props.width > 0 ? { width: props.width } : {}),
      }}
    >
      <div className={styles.main}>
        <div className={styles.header}>
          <Header
            title={props.title}
            caption={caption}
            isMock={props.isMock}
            canClear={canClear}
            settingsOpen={settingsOpen}
            onToggleSettings={() => setSettingsChoice(!settingsOpen)}
            onClear={clear}
          />
        </div>
        <div ref={scrollRef} className={styles.scroll}>
          {body}
        </div>
        <div className={styles.composer}>
          <Composer
            placeholder={props.placeholder}
            pending={state.pending}
            disabled={!schema}
            onSend={ask}
            onCancel={cancel}
          />
        </div>
      </div>

      <SettingsDrawer open={settingsOpen} inline={inline} onClose={() => setSettingsChoice(false)}>
        {schema && (
          <DictionarySection
            table={schema.table}
            columns={schema.columns}
            active={dictionary}
            makerName={props.makerDictionary ? props.makerDictionaryName || DEFAULT_MAKER_DICTIONARY_NAME : null}
            mentionedCount={mentioned.size}
            allowUpload={props.allowDictionaryUpload}
            maxChars={maxChars}
            onUpload={setUploaded}
          />
        )}
        <AnsweringSection settings={state.settings} canClear={canClear} onChange={updateSettings} onClear={clear} />
      </SettingsDrawer>
    </div>
  );
}
