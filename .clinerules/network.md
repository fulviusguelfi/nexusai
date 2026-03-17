# Networking & Proxy Support

All network calls in extension/CLI code **MUST** use `@/shared/net` wrappers—global `fetch` and default `axios` don't pick up proxy settings in JetBrains/CLI. In webview code, global `fetch` is fine (browser handles proxies).

- **`fetch`**: `import { fetch } from '@/shared/net'` — drop-in replacement
- **`axios`**: spread `...getAxiosSettings()` into the request config options
- **Third-party clients** (OpenAI, Ollama, etc.): pass `fetch` from `@/shared/net` to the client constructor (`fetch` option)
- **Tests**: use `mockFetchForTesting(mockFetch, callback)` from `@/shared/net` — restores original fetch when callback returns/resolves
- `shared/net.ts` itself is exempt from these rules (it sets up the wrappers)
