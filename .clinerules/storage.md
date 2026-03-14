# Storage Architecture

Settings/secrets/workspace state live in **file-backed JSON stores** under `~/.cline/data/` (shared by VSCode, CLI, JetBrains). Path inherited from upstream; rename planned later.

## Key Abstractions
- `StorageContext` (`src/shared/storage/storage-context.ts`): entry point, wraps three `ClineFileStorage` instances for globalState, secrets (0o600), and workspaceState.
- `ClineFileStorage` (`src/shared/storage/ClineFileStorage.ts`): sync JSON key-value store. Atomic writes (write-then-rename).
- `StateManager` (`src/core/storage/StateManager.ts`): in-memory cache over `StorageContext`. Runtime reads hit cache; writes update cache + debounce-flush to disk.

## ⚠️ Do NOT Use VSCode's ExtensionContext for Storage
`context.globalState`, `context.workspaceState`, `context.secrets` are VSCode-only—not available in CLI or JetBrains. Use:
```typescript
StateManager.get().getGlobalStateKey("key")    // read
StateManager.get().setGlobalState("key", val)  // write
// Similarly: getSecretKey / setSecret, getWorkspaceStateKey / setWorkspaceState
```
Data may be read by a different client than the one that wrote it.

## VSCode Migration
On startup, `src/hosts/vscode/vscode-to-file-migration.ts` copies VSCode `ExtensionContext` storage to file-backed stores. Sentinel key `__vscodeMigrationVersion` prevents re-migration. File store wins on conflict. VSCode storage is NOT cleared (safe downgrade).

## Adding New Storage Keys
1. Add to `src/shared/storage/state-keys.ts`
2. Read/write via `StateManager` (not `context.globalState`)
3. Secrets: also add to `SecretKeys` array in `state-keys.ts`