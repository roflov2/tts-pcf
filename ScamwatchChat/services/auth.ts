/**
 * Entra ID sign-in for calling the backend, using MSAL Browser.
 *
 * Token order: cached/silent → ssoSilent (hidden iframe, reuses the user's
 * Microsoft session) → popup. The popup needs a user click, so when silent
 * sign-in fails the UI shows a "Sign in" button that calls getToken({ interactive: true }).
 * Silent SSO often fails inside Power Apps because browsers block third-party
 * cookies in frames; the popup always works when popups are allowed.
 */

import {
  type AccountInfo,
  type AuthenticationResult,
  BrowserAuthError,
  PublicClientApplication,
} from "@azure/msal-browser";

export interface AuthSettings {
  clientId: string;
  tenantId: string;
  scope: string;
  /** Must be on the same origin as the page hosting the control, and registered as an SPA redirect URI. */
  redirectUri: string;
  loginHint?: string;
}

/** Thrown when only an interactive sign-in (a user click) can get a token. */
export class SignInRequiredError extends Error {
  constructor(message = "Sign in to use the assistant.") {
    super(message);
    this.name = "SignInRequiredError";
  }
}

export interface TokenOptions {
  /** Allow a popup. Only pass true from a click handler, or the browser blocks the popup. */
  interactive?: boolean;
  /** Skip the cached token, e.g. after the API rejected it. */
  forceRefresh?: boolean;
}

export interface TokenProvider {
  getToken(options?: TokenOptions): Promise<string>;
}

/** The redirect URI used when the maker leaves the property empty. */
export function defaultRedirectUri(): string {
  return window.location.origin;
}

export class MsalTokenProvider implements TokenProvider {
  private readonly settings: AuthSettings;
  private client?: Promise<PublicClientApplication>;

  constructor(settings: AuthSettings) {
    this.settings = settings;
  }

  /** True when the settings are the same, so the provider (and its token cache) can be kept. */
  matches(settings: AuthSettings): boolean {
    const s = this.settings;
    return (
      s.clientId === settings.clientId &&
      s.tenantId === settings.tenantId &&
      s.scope === settings.scope &&
      s.redirectUri === settings.redirectUri
    );
  }

  async getToken({ interactive = false, forceRefresh = false }: TokenOptions = {}): Promise<string> {
    const client = await this.getClient();
    const scopes = [this.settings.scope];
    const account = this.pickAccount(client);

    if (account) {
      try {
        return (await client.acquireTokenSilent({ scopes, account, forceRefresh })).accessToken;
      } catch {
        // Fall through to SSO or the popup.
      }
    }
    if (!interactive) {
      try {
        const result = await client.ssoSilent({ scopes, loginHint: this.settings.loginHint });
        return this.remember(client, result);
      } catch {
        throw new SignInRequiredError();
      }
    }
    try {
      const result = await client.acquireTokenPopup({
        scopes,
        loginHint: this.settings.loginHint,
        prompt: "select_account",
      });
      return this.remember(client, result);
    } catch (error) {
      if (error instanceof BrowserAuthError && error.errorCode === "popup_window_error") {
        throw new SignInRequiredError(
          "The sign-in window was blocked. Allow pop-ups for this site and try again.",
        );
      }
      if (error instanceof BrowserAuthError && error.errorCode === "user_cancelled") {
        throw new SignInRequiredError("Sign-in was cancelled.");
      }
      throw error;
    }
  }

  private remember(client: PublicClientApplication, result: AuthenticationResult): string {
    if (result.account) {
      client.setActiveAccount(result.account);
    }
    return result.accessToken;
  }

  private pickAccount(client: PublicClientApplication): AccountInfo | null {
    const active = client.getActiveAccount();
    if (active) {
      return active;
    }
    const accounts = client.getAllAccounts();
    const hint = this.settings.loginHint?.toLowerCase();
    return accounts.find((a) => hint && a.username.toLowerCase() === hint) ?? accounts[0] ?? null;
  }

  private getClient(): Promise<PublicClientApplication> {
    if (!this.client) {
      const { clientId, tenantId, redirectUri } = this.settings;
      const pca = new PublicClientApplication({
        auth: {
          clientId,
          authority: `https://login.microsoftonline.com/${tenantId || "organizations"}`,
          redirectUri,
        },
        cache: { cacheLocation: "sessionStorage" },
      });
      this.client = pca.initialize().then(() => pca);
    }
    return this.client;
  }
}
