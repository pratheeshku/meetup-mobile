# As-built requirements (mobile): API layer

Status: AS-BUILT behaviours inferred from code at `main` 79b9a3a. Provisional IDs `AB-MAPI-nn`. Owner assigns version and status.
Design: [design/api.md](../design/api.md)

| ID | Behaviour (as built) | Evidence |
|---|---|---|
| AB-MAPI-01 | Every authenticated request carries the access token and a correlation ID; one ID per logical user action when the caller supplies it, otherwise one per call. | `client.ts`, `correlationId.ts` |
| AB-MAPI-02 | A 401 on a non-auth call triggers one token refresh and one retry; concurrent 401s share a single refresh. | `client.ts` response interceptor |
| AB-MAPI-03 | A definitive refresh refusal ends the session (tokens and cookies cleared, user sent to sign-in); network errors and 5xx never do. | `endSession`, `SessionEndedError` |
| AB-MAPI-04 | The refresh cookie is sent and stored by the OS, never read by app code. | `withCredentials`, `cookies.ts` |
| AB-MAPI-05 | Requests time out after 30 s (refresh after 10 s). | `client.ts` |
| AB-MAPI-06 | Game limits and client config (including the Places key) come from the server. | `config.ts` |
| AB-MAPI-07 | 4xx server messages are shown to the user; other errors get generic text; logs carry error class only. | `apiError.ts`, `logSafeError.ts` |
| AB-MAPI-08 | The app only calls endpoints that exist in the backend (89 calls checked). | generated inventory in design/api.md |
| AB-MAPI-09 | Perf logging records path templates and timings only, when enabled. | `client.ts`, `perfLog.ts` |

## Not evidenced in code (owner decision needed)
- Retry/backoff allowlist and per-endpoint circuit breaker (designed, not built).
- Offline queueing or caching of API data (none beyond labels).
