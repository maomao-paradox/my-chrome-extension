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

The Playwright backend launches a separate browser instance. It does not control the user's currently open Chrome tab directly; the extension should send target URLs and selectors to this backend.

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
