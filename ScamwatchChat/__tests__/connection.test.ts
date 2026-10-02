import { HttpChatApi } from "../services/apiClient";
import { MockChatApi } from "../services/mockApi";
import { loadConnection, saveConnection } from "../state/storage";
import { connectionQuery, normalizeConnection, sameConnection } from "../utils/connection";

describe("normalizeConnection", () => {
  it("trims values and drops blanks, as app.py stripped each field on Connect", () => {
    expect(normalizeConnection({ server: "  sql.example.com ", database: "", table: " dbo.T", model: "   " })).toEqual({
      server: "sql.example.com",
      table: "dbo.T",
    });
  });

  it("is null when nothing is left, and ignores values that aren't text", () => {
    expect(normalizeConnection({ server: " ", database: 3 as unknown as string })).toBeNull();
    expect(normalizeConnection(null)).toBeNull();
  });

  it("compares values after tidying", () => {
    expect(sameConnection({ table: " t " }, { table: "t", server: "" })).toBe(true);
    expect(sameConnection({ table: "t" }, null)).toBe(false);
    expect(sameConnection(null, {})).toBe(true);
  });
});

describe("connectionQuery", () => {
  it("encodes the set fields in the form's order", () => {
    expect(connectionQuery({ model: "gpt-4o", table: "Reporting.My Table", server: "s&t" })).toBe(
      "?server=s%26t&table=Reporting.My+Table&model=gpt-4o",
    );
    expect(connectionQuery(null)).toBe("");
  });
});

describe("connection in session storage", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("round-trips, and clears with null", () => {
    saveConnection("ns", { table: "dbo.T" });
    expect(loadConnection("ns")).toEqual({ table: "dbo.T" });
    saveConnection("ns", null);
    expect(loadConnection("ns")).toBeNull();
  });
});

describe("HttpChatApi.getSchema", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("sends the user's connection values as query parameters", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const api = new HttpChatApi("https://api.example.com/", { getToken: () => Promise.resolve("token") });

    await api.getSchema(undefined, { table: "dbo.Other", server: "sql.example.com" });
    await api.getSchema();

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/schema?server=sql.example.com&table=dbo.Other");
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.example.com/schema");
  });
});

describe("MockChatApi.getSchema", () => {
  it("echoes connection values and fails for a table it doesn't have", async () => {
    const api = new MockChatApi(0);
    const schema = await api.getSchema(undefined, { model: "gpt-4o-mini", openAiApiVersion: "2025-01-01" });
    expect(schema.model).toBe("gpt-4o-mini");
    expect(schema.openAiApiVersion).toBe("2025-01-01");
    expect(schema.openAiEndpoint).toBeTruthy();
    await expect(api.getSchema(undefined, { table: "dbo.Other" })).rejects.toThrow("Invalid object name 'dbo.Other'");
  });
});
