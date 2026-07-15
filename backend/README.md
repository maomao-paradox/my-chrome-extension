# Chrome Extension Automation Backend

Go HTTP backend for the KIRA:NOVE Chrome extension. Its main job is to expose a small Playwright automation API that extension pages or background scripts can call.

## Features

- Health and readiness probes: `GET /health`, `GET /readyz`
- Extension runtime config: `GET /api/v1/extension/config`
- Playwright browser sessions:
  - create/list/close sessions
  - navigate pages
  - click, fill, press keys, and wait for selectors
  - extract text
  - return PNG screenshots as base64
- Extension automation task center:
  - create tasks and save structured automation steps
  - create runs and receive execution events from the extension
  - archive screenshot base64 strings or file paths for each run
  - optionally ask AI to generate structured steps from natural language
- Backend-generated TOTP tokens:
  - store TOTP secrets in backend memory
  - import `otpauth://totp/...` URLs or manual Base32 secrets
  - return current codes without exposing the stored secret
- Optional OpenAI-compatible AI proxy remains available for extension features that need it
- Optional bearer/API-key protection with `API_TOKEN`
- CORS support for `chrome-extension://*` and local Vite development origins
- JSON access logs, panic recovery, security headers, request IDs, and graceful shutdown

## Install Playwright

The Go dependency is not enough by itself. Install the matching Playwright driver and browsers once per machine:

```bash
go run github.com/mxschmitt/playwright-go/cmd/playwright@v0.6100.0 install --with-deps chromium
```

If the machine does not allow installing OS packages, drop `--with-deps` and make sure Chromium dependencies are already present.

## Run

```bash
go run .
```

Default address: `http://127.0.0.1:8787`.

## Configuration

Use environment variables:

| Name | Default | Description |
| --- | --- | --- |
| `SERVER_HOST` | `127.0.0.1` | Bind host |
| `SERVER_PORT` | `8787` | Bind port |
| `APP_ENV` | `development` | Runtime environment label |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error` |
| `CORS_ALLOWED_ORIGINS` | `chrome-extension://*,http://127.0.0.1:5173,http://localhost:5173` | Comma-separated allowed origins |
| `API_TOKEN` | empty | Optional token required through `Authorization: Bearer <token>` or `X-API-Key` |
| `AI_BASE_URL` | empty | Upstream OpenAI-compatible base URL, for example `https://api.openai.com/v1` |
| `AI_API_KEY` | empty | Upstream API key |
| `AI_MODEL` | `deepseek-chat` | Default model ID |
| `AI_TIMEOUT` | `60s` | Upstream request timeout |
| `MAX_REQUEST_BYTES` | `1048576` | Maximum JSON request body size |

If `AI_BASE_URL` or `AI_API_KEY` is missing, chat endpoints return `503` and the rest of the backend remains available.

## Automation API

The primary product flow is extension-driven automation against the user's real Chrome tab. Store durable automation plans as structured JSON steps, then let the extension translate them into `playwright-crx` actions.

Create a task:

```bash
curl -s http://127.0.0.1:8787/api/automation/tasks \
  -H 'Content-Type: application/json' \
  -d '{"name":"登录并导出报表","description":"打开系统，登录，进入报表页，导出本月数据"}'
```

Save steps:

```bash
curl -s http://127.0.0.1:8787/api/automation/tasks/<task-id>/steps \
  -H 'Content-Type: application/json' \
  -d '{"steps":[{"type":"goto","url":"https://example.com/login"},{"type":"fill","target":{"kind":"label","text":"用户名"},"value":"admin"},{"type":"click","target":{"kind":"role","role":"button","name":"登录"}}]}'
```

Load task detail, including runs:

```bash
curl -s http://127.0.0.1:8787/api/automation/tasks/<task-id>
```

Create a run and report execution:

```bash
curl -s http://127.0.0.1:8787/api/automation/tasks/<task-id>/runs \
  -H 'Content-Type: application/json' \
  -d '{"mode":"real-run","page":{"url":"https://example.com/login","title":"Login"}}'

curl -s http://127.0.0.1:8787/api/automation/runs/<run-id>/events \
  -H 'Content-Type: application/json' \
  -d '{"stepId":"step_001","status":"passed","durationMs":530,"page":{"url":"https://example.com/dashboard","title":"Dashboard"}}'

curl -s http://127.0.0.1:8787/api/automation/runs/<run-id>/screenshots \
  -H 'Content-Type: application/json' \
  -d '{"stepId":"step_001","base64":"<png-base64>","contentType":"image/png"}'
```

Generate structured steps with the configured AI upstream:

```bash
curl -s http://127.0.0.1:8787/api/automation/generate \
  -H 'Content-Type: application/json' \
  -d '{"intent":"登录系统并打开销售报表","pageSnapshot":"当前页面包含用户名、密码和登录按钮"}'
```

Generated steps are schema-validated before being returned. The backend rejects arbitrary JavaScript step types.

## Playwright Session API

Create a Chromium session and open a page:

```bash
curl -s http://127.0.0.1:8787/api/automation/sessions \
  -H 'Content-Type: application/json' \
  -d '{"browser":"chromium","headless":true,"url":"https://example.com","viewport":{"width":1280,"height":720}}'
```

The response includes `session.id`. Use that ID for follow-up actions.

Navigate:

```bash
curl -s http://127.0.0.1:8787/api/automation/sessions/<session-id>/navigate \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","waitUntil":"domcontentloaded","timeoutMs":30000}'
```

Click and fill:

```bash
curl -s http://127.0.0.1:8787/api/automation/sessions/<session-id>/click \
  -H 'Content-Type: application/json' \
  -d '{"selector":"a.more","timeoutMs":10000}'

curl -s http://127.0.0.1:8787/api/automation/sessions/<session-id>/fill \
  -H 'Content-Type: application/json' \
  -d '{"selector":"input[name=q]","value":"KIRA:NOVE"}'
```

Extract text:

```bash
curl -s http://127.0.0.1:8787/api/automation/sessions/<session-id>/extract \
  -H 'Content-Type: application/json' \
  -d '{"selector":"h1","all":false}'
```

Take a screenshot:

```bash
curl -s http://127.0.0.1:8787/api/automation/sessions/<session-id>/screenshot \
  -H 'Content-Type: application/json' \
  -d '{"fullPage":true}'
```

Close the session:

```bash
curl -s -X DELETE http://127.0.0.1:8787/api/automation/sessions/<session-id>
```

The Playwright backend launches a separate browser instance. It does not control the user's currently open Chrome tab directly. Use the task APIs above for real-tab extension automation records and logs.

## TOTP API

Create a token account from an `otpauth://` URL:

```bash
curl -s http://127.0.0.1:8787/api/totp/accounts \
  -H 'Content-Type: application/json' \
  -d '{"otpauthUrl":"otpauth://totp/Example:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example"}'
```

Or create one manually:

```bash
curl -s http://127.0.0.1:8787/api/totp/accounts \
  -H 'Content-Type: application/json' \
  -d '{"issuer":"Example","accountName":"alice@example.com","secret":"JBSWY3DPEHPK3PXP"}'
```

List accounts and request the current code:

```bash
curl -s http://127.0.0.1:8787/api/totp/accounts

curl -s http://127.0.0.1:8787/api/totp/accounts/<account-id>/code \
  -H 'Content-Type: application/json' \
  -d '{}'
```

The API never returns the stored secret. Current storage is in-memory; restart clears token accounts.

## Other API Examples

Health check:

```bash
curl -s http://127.0.0.1:8787/health
```

Non-streaming chat through the extension-compatible endpoint:

```bash
curl -s http://127.0.0.1:8787/api/deepseek/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"只回复 ok","stream":false}'
```

OpenAI-compatible endpoint:

```bash
curl -s http://127.0.0.1:8787/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"只回复 ok"}],"stream":false}'
```

Clear a role session marker:

```bash
curl -s http://127.0.0.1:8787/api/deepseek/session/clear \
  -H 'Content-Type: application/json' \
  -d '{"role":"default_ai_assistant"}'
```

## Verify

```bash
go test ./...
```
