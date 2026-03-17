# NexusAI — Deprecation & Migration Plan

This document tracks the incremental migration from `Cline` branded identifiers to `NexusAI` identifiers. Changes are grouped into phases so that each phase can ship independently without breaking integrations.

---

## Phase 1 — External Identity (DONE ✅)

Rename every string that is visible to **external systems or users** — HTTP headers, user-agent strings, UI labels, docs URLs. These carry zero runtime risk because they are not used as lookup keys.

| Item | Old Value | New Value | Status |
|------|-----------|-----------|--------|
| `HTTP-Referer` header (openrouter, requesty, vercel-ai-gateway, zai, cline providers) | `https://cline.bot` | `https://nexusai.dev` | ✅ Done |
| `X-Title` header | `Cline` | `NexusAI` | ✅ Done |
| User-agent strings (`link-preview.ts`) | `+https://cline.bot` | `+https://nexusai.dev` | ✅ Done |
| Git checkpoint email | `checkpoint@cline.bot` | `checkpoint@nexusai.dev` | ✅ Done |
| MCP OAuth `client_name` / `client_uri` / `software_id` | `Cline` / `cline.bot` / `cline` | `NexusAI` / `nexusai.dev` / `nexusai` | ✅ Done |
| MCP Hub client name | `Cline` | `NexusAI` | ✅ Done |
| System-prompt feedback footer | `docs.cline.bot` | `docs.nexusai.dev` | ✅ Done |
| Webview MCP docs URLs | `docs.cline.bot/mcp/…` | `docs.nexusai.dev/mcp/…` | ✅ Done |
| Worktrees UI strings | "create task for Cline" / "Ask Cline to Resolve" | NexusAI equivalents | ✅ Done |
| Welcome page link | `https://cline.bot` | `https://nexusai.dev` | ✅ Done |
| `ClineRulesToggles` type alias | — | `NexusRulesToggles = ClineRulesToggles` | ✅ Done |
| Package icon description | `"cline"` | `"nexusai"` | ✅ Done |
| VSIX artifact filename | `cline-<version>.vsix` | `nexusai-<version>.vsix` | ✅ Done |

---

## Phase 2 — Backend Auth Keys (PENDING — requires NexusAI backend)

These keys are storage-layer identifiers used as lookup keys in SecretStorage and GlobalState. Renaming them requires a dual-read migration (read new → fallback to old → write to new) to preserve existing users' credentials.

**Do NOT rename these until NexusAI has its own auth backend deployed.**

| Identifier | Location | Old Key | New Key | Migration |
|------------|----------|---------|---------|-----------|
| API key secret | `src/shared/storage/state-keys.ts` | `"clineApiKey"` | `"nexusaiApiKey"` | Add to `state-migrations.ts` with dual-read |
| Account ID secret | `state-keys.ts` | `"clineAccountId"` | `"nexusaiAccountId"` | Add to `state-migrations.ts` with dual-read |
| Legacy account ID | `state-keys.ts` | `"cline:clineAccountId"` | `"nexusai:accountId"` | Deprecate after dual-read of `"nexusaiAccountId"` |
| Global rules toggles | `state-keys.ts` global state | `"globalClineRulesToggles"` | `"globalNexusAIRulesToggles"` | Dual-read in migration |
| Plan mode model key | `state-keys.ts` global state | `"planModeClineModelId"` | `"planModeNexusAIModelId"` | Dual-read in migration |
| Act mode model key | `state-keys.ts` global state | `"actModeClineModelId"` | `"actModeNexusAIModelId"` | Dual-read in migration |
| Web tools key | `state-keys.ts` global state | `"clineWebToolsEnabled"` | `"nexusaiWebToolsEnabled"` | Dual-read in migration |
| Environment variable | All files referencing `CLINE_ENVIRONMENT` | `CLINE_ENVIRONMENT` | `NEXUSAI_ENVIRONMENT` | Set both in launch configs; read from either; deprecate old after one release |

---

## Phase 3 — Internal TypeScript Identifiers (FUTURE)

These are internal class names, type names, and enum names. Renaming them is low risk (pure TypeScript refactor) but high noise (many files affected). Schedule after Phase 2 backend is stable.

| Identifier | Location | Old Name | New Name | Notes |
|------------|----------|----------|----------|-------|
| Base class | `src/shared/ExtensionMessage.ts` | `ClineMessage` | `NexusAIMessage` | Add `NexusAIMessage = ClineMessage` alias first |
| Enum | `proto/cline/*.proto` | `ClineSay` | `NexusAISay` | Requires `npm run protos` after rename |
| Enum | `proto/cline/*.proto` | `ClineAsk` | `NexusAIAsk` | Requires `npm run protos` after rename |
| Type | `src/shared/tools.ts` | `ClineDefaultTool` | `NexusAIDefaultTool` | Add alias first |
| Service | `src/services/mcp/McpHub.ts` | `ClineOAuthClientProvider` | `NexusAIOAuthClientProvider` | Internal class name only |
| Type | `src/shared/cline-rules.ts` | `ClineRulesToggles` | `NexusRulesToggles` | Alias already added in Phase 1 |

---

## Phase 4 — VS Code Configuration Keys (FUTURE)

VS Code `contributes.configuration` property IDs are user-visible in `settings.json`. Renaming them without migration causes silent loss of settings. Use `"deprecationMessage"` on old keys and add new keys.

| Old Setting ID | New Setting ID | Notes |
|---------------|---------------|-------|
| `cline.*` (all) | `nexusai.*` (all) | ~20 settings; needs `package.json` contributes update + migration read in extension activate |

---

## Identifiers Intentionally Kept as `cline` (Not Scheduled for Rename)

| Identifier | Reason |
|------------|--------|
| `CLINE_ENVIRONMENT` | Used by CI/CD pipelines, `.env` files, and E2E test helpers; renaming needs coordinated infra change — Phase 2 |
| `cline.ts` provider filename | Backend service name; rename when NexusAI creates its own provider endpoint |
| Git repo URL `coderabbitai/cline` references | Upstream fork tracking; do not rename |
| `clinerules` file format (`.clinerules`) | User-facing config format; rename in Phase 4 with backward-compat alias |
