# Developer Skill
General software development assistance for NexusAI.

## NexusAI Build Commands
```powershell
npm run compile          # Build TypeScript (NOT npm run build)
npm run watch            # Watch mode: extension + webview
npm run protos           # Regenerate proto files (run AFTER any .proto change)
npm run test:unit        # Run unit tests
UPDATE_SNAPSHOTS=true npm run test:unit  # Regenerate snapshots after prompt changes
```

## Common Code Patterns

### Adding a Tool Handler
1. Add enum to `ClineDefaultTool` in `src/shared/tools.ts`
2. Create handler in `src/core/task/tools/handlers/`
3. Register in `ToolExecutor.ts`
4. Add to whitelist in `src/core/prompts/system-prompt/variants/*/config.ts`
5. Add `ClineSay` type if tool has UI output

### Adding a Global State Key
1. `src/shared/storage/state-keys.ts` — add key with default
2. `src/shared/ExtensionMessage.ts` — add to `ExtensionState` interface
3. `src/core/controller/index.ts` — expose in `getClineState()`
4. `webview-ui/src/context/ExtensionStateContext.tsx` — add default

### Paths — Always Cross-Platform
```typescript
import { toPosixString } from "@/utils/path"
// Never: path.join().replace()\//) — Always: toPosixString(path.join(...))
```

### Logging
```typescript
import { Logger } from "@/shared/services/Logger"
Logger.log("[Service] message")    // info
Logger.warn("[Service] message")   // warning
Logger.error("[Service] message")  // error (shows in Output Channel)
```

## Architecture Quick Reference
- `extension.ts` → `WebviewProvider` → `Controller` (single source of truth) → `Task` (agent loop)
- Webview state synced via Protobuf message passing
- Proto schemas in `proto/` → generated into `src/shared/proto/`
- Two webview providers: `VscodeWebviewProvider` (sidebar) + `EditorWebviewPanelProvider` (editor panel) — **always update both**

## Error Handling Rules
- Validate at system boundaries only (user input, external calls)
- Don't add try-catch for impossible paths
- Use `Logger.error()` before rethrowing

## Key Files
| Purpose | File |
|---|---|
| Tool handlers | `src/core/task/tools/handlers/` |
| System prompt | `src/core/prompts/system-prompt/` |
| API providers | `src/core/api/providers/` |
| State keys | `src/shared/storage/state-keys.ts` |
| Proto conversions | `src/shared/proto-conversions/` |
| Tribal knowledge | `.clinerules/general.md` |