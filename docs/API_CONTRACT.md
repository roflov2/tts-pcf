# API contract

The control is UI only. It talks to a small HTTP API that wraps the Python
`TextToSQLAgent`. This page describes what that API must do; the TypeScript
types in [`ScamwatchChat/types.ts`](../ScamwatchChat/types.ts) are the source of
truth, and `ScamwatchChat/services/mockApi.ts` is a working fake of it.

All requests carry `Authorization: Bearer <token>`, an Entra ID access token for
the scope set in the control's `apiScope` property. JSON in, JSON out.

## `GET /schema`

Called when the control loads, and again when the user selects **Reconnect** in
Settings → Connection. Fills the caption, the Connection section, the columns
table, the sample rows and the data dictionary template.

```json
{
  "table": "Reporting.ScamWatchReportFiltered",
  "database": "NASC_ODS",
  "server": "sqlserver.example.com",
  "model": "gpt-4o",
  "openAiEndpoint": "https://openai.example.com/",
  "openAiApiVersion": "2024-12-01-preview",
  "columns": [{ "name": "report_id", "type": "int" }],
  "sampleRows": [{ "report_id": 100000, "state": "NSW" }],
  "limits": { "maxDictionaryChars": 40000, "maxResultRows": 50000 }
}
```

| Field | From the agent |
|---|---|
| `table`, `database` | `agent.table_name`, `agent.database_name` |
| `server` | `agent.server_name`; optional, shown in Settings → Connection when present |
| `model` | `agent.deployment_name`; optional, shown in Settings → Connection when present |
| `openAiEndpoint`, `openAiApiVersion` | the Azure OpenAI client's endpoint and API version; optional, shown in Settings → Connection when present |
| `columns` | `agent.columns` (list of `(name, data_type)`) |
| `sampleRows` | `agent.sample_rows`, made JSON-safe |
| `limits.maxDictionaryChars` | `MAX_DICTIONARY_CHARS`; optional, the control assumes 40,000 |
| `limits.maxResultRows` | `agent.max_result_rows`; optional |

If the schema can't be read (`agent.schema_error`), return a 5xx with
`{"detail": "<message>"}`. The control shows the message, a checklist and a
**Try again** button.

## Connection values from users (optional)

`app.py` let each user edit the connection (server, database, table, Azure
OpenAI endpoint, API version, model deployment) and select **Connect**. That was
safe there because Streamlit ran under the user's own `az login`. Your API runs
SQL under its own identity, so the control only sends these values when the app
maker turns on the `allowConnectionChange` property.

When it's on and the user has connected with their own values, the control sends them:

- on `GET /schema` as query parameters:
  `/schema?server=…&database=…&table=…&openAiEndpoint=…&openAiApiVersion=…&model=…`
- on `POST /query` as a `connection` object with the same fields.

Fields the user left blank are left out: use your own setting for those. The
values are already trimmed, as `app.py` stripped them.

The API must:

- **check every value against an allowlist** of servers, databases, tables,
  endpoints, API versions and deployments it's willing to use, and return
  `403` with `{"detail": "…"}` for anything else. Never connect to a value just
  because a request named it. If you don't support user connections, ignore
  these fields or return `403`, and leave `allowConnectionChange` off.
- build one agent per distinct connection and reuse it, as `build_agent` did with
  `st.cache_resource`.
- return the connection actually used in the `/schema` response fields above.

## `POST /query`

```json
{
  "question": "now break that down by month",
  "history": [
    { "role": "user", "content": "How many loss reports are there?" },
    { "role": "assistant", "content": "There are 1,402.\n\nSQL used:\nSELECT COUNT(*) …" }
  ],
  "maxAttempts": 3,
  "maxPreviewRows": 20,
  "dataDictionary": "Data dictionary for …",
  "connection": { "table": "Reporting.ScamWatchReportFiltered", "model": "gpt-4o" }
}
```

The control builds `history` exactly as `build_history()` in `app.py` did (last
N turns, with "SQL used:" appended to answers), so the server passes it straight
through: `agent.query(question, max_attempts=maxAttempts, max_preview_rows=maxPreviewRows, history=history,
data_dictionary=dataDictionary)`. `maxPreviewRows` is 5–200 (the range of the
Streamlit app's "Rows the model reads per result" input) and plays the part of
the agent's `llm_preview_limit`, per question rather than per agent. `dataDictionary` is omitted when none is
active, and `connection` is omitted unless the user connected with their own
values (see above). It is already tidied and capped by the control, and running
`prepare_data_dictionary` again on the server is safe.

Response, shaped like `ask_agent()`:

```json
{
  "answer": "There were …",
  "sql": "SELECT FORMAT(date_reported, 'yyyy-MM') AS month, COUNT(*) …",
  "dataNote": "Interpretation based on the first 20 of 24 rows.",
  "attempts": [{ "query": "SELECT …", "success": true, "error": null }],
  "columnNames": ["month", "report_count"],
  "rows": [{ "month": "2025-01", "report_count": 118 }],
  "totalRows": 24,
  "truncated": false,
  "error": null
}
```

| Field | From `agent.query()` |
|---|---|
| `answer` | `answer` |
| `sql` | `sql_query` |
| `dataNote` | `data_note` |
| `attempts` | `attempts` |
| `columnNames` | `column_names` |
| `rows` | `full_results` (null when no query succeeded) |
| `totalRows`, `truncated` | `total_rows`, `truncated` |
| `error` | set when the agent raised: return HTTP 200 with `error` set, so the chat carries on (as `ask_agent` did). Leave it null when `agent.query()` returns its own `"error": "Max attempts reached"`: `ask_agent` ignored that key, and the answer ("I couldn't complete the query after multiple attempts.") and the Failed attempts tab already explain it |

Values must be JSON-safe, as `_arrow_safe()` did for Streamlit: `Decimal` →
number, `bytes` → hex string, `date`/`datetime`/`time` → ISO string, UUID and
anything else → string.

## Server requirements

- **CORS:** allow the origins the control runs on: `https://apps.powerapps.com`,
  your model-driven org (e.g. `https://<org>.crm6.dynamics.com`) and the canvas
  player origin your tenant uses (check the browser's network tab). Allow the
  `Authorization` and `Content-Type` headers.
- **Body size:** at least 1 MB (a 40,000-character dictionary plus history).
- **Timeout:** answer within about 230 s. The control gives up after that.
- **Auth:** validate the token's audience, issuer and scope. Run SQL as an
  identity that only has `SELECT` on the table; `validate_read_only` is only
  defence in depth.
- **Status codes:** 401/403 for auth problems, 413 for oversized requests, 5xx
  with `{"detail": "…"}` otherwise. The control shows `detail` to the user.
