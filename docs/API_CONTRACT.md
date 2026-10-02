# API contract

The control is UI only. It talks to a small HTTP API that wraps the Python
`TextToSQLAgent`. This page describes what that API must do; the TypeScript
types in [`ScamwatchChat/types.ts`](../ScamwatchChat/types.ts) are the source of
truth, and `ScamwatchChat/services/mockApi.ts` is a working fake of it.

All requests carry `Authorization: Bearer <token>`, an Entra ID access token for
the scope set in the control's `apiScope` property. JSON in, JSON out.

## `GET /schema`

Called once when the control loads. Fills the caption, the columns table, the
sample rows and the data dictionary template.

```json
{
  "table": "Reporting.ScamWatchReportFiltered",
  "database": "NASC_ODS",
  "columns": [{ "name": "report_id", "type": "int" }],
  "sampleRows": [{ "report_id": 100000, "state": "NSW" }],
  "limits": { "maxDictionaryChars": 40000, "maxResultRows": 50000 }
}
```

| Field | From the agent |
|---|---|
| `columns` | `agent.columns` (list of `(name, data_type)`) |
| `sampleRows` | `agent.sample_rows`, made JSON-safe |
| `limits.maxDictionaryChars` | `MAX_DICTIONARY_CHARS`; optional, the control assumes 40,000 |
| `limits.maxResultRows` | `agent.max_result_rows`; optional |

If the schema can't be read (`agent.schema_error`), return a 5xx with
`{"detail": "<message>"}`. The control shows the message and a **Try again** button.

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
  "dataDictionary": "Data dictionary for …"
}
```

The control builds `history` exactly as `build_history()` in `app.py` did (last
N turns, with "SQL used:" appended to answers), so the server passes it straight
through: `agent.query(question, max_attempts=maxAttempts, max_preview_rows=maxPreviewRows, history=history,
data_dictionary=dataDictionary)`. `dataDictionary` is omitted when none is
active. It is already tidied and capped by the control, and running
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
| `error` | set when the agent raised: return HTTP 200 with `error` set, so the chat carries on (as `ask_agent` did) |

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
