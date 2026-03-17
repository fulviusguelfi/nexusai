# NexusAI Architecture Overview

VSCode extension (forked from Cline). TypeScript. React/Vite webview.

## Component Map
- `src/extension.ts` → activates `WebviewProvider`
- `src/core/webview/index.ts` (`WebviewProvider`): manages webview lifecycle, HTML/CSP, HMR, postMessage bridge
- `src/core/controller/index.ts` (`Controller`): single source of truth; manages state (global/workspace/secrets), coordinates tasks, handles webview messages
- `src/core/task/index.ts` (`Task`): executes AI request loop + tool operations; isolated per task
- `src/services/mcp/McpHub.ts` (`McpHub`): manages MCP server connections
- `webview-ui/src/App.tsx`: React app entry
- `webview-ui/src/context/ExtensionStateContext.tsx`: React context; syncs state from extension via postMessage; provides `useExtensionState()` hook

## Communication
- Extension ↔ Webview: postMessage (protobuf-encoded, gRPC-like). See `proto/` for schemas.
- State reads: Controller reads from `StateManager`; webview reads from `ExtensionStateContext`.

## Storage
See `.clinerules/storage.md`. File-backed stores in `~/.cline/data/`. Do NOT use `context.globalState`.

## API Providers
- Provider implementations: `src/api/providers/`  
- Factory: `src/core/api/index.ts` (`createHandlerForProvider()`)
- Config: API keys in secrets store; model + settings in global state

## Task Execution Loop
`Task.initiateTaskLoop()` → make API request → parse/present content blocks → execute tools → repeat until done or aborted.