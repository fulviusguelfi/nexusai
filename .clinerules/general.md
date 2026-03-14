Tribal knowledge—non-obvious patterns that aren't derivable from reading a few files. Add when: user had to intervene, needed many back-and-forth attempts, or discovered something requiring reading many files. **What NOT to add:** obvious/standard practices.

## Miscellaneous
- Build: `npm run compile` (NOT `npm run build`). Check `package.json` for available scripts.
- PRs: don't create changelog-entry files—maintainers handle this.
- Feature flags: see PR #7566 as reference pattern.
- Network requests: see @.clinerules/network.md

## gRPC/Protobuf Communication
- Proto files in `proto/` — one per feature domain. Simple data: use `proto/cline/common.proto` types (`StringRequest`, `Empty`, `Int64Request`). Naming: `PascalCaseService`, `camelCase` RPCs, `PascalCase` Messages.
- **Run `npm run protos`** after any proto change. Generates into `src/shared/proto/`, `src/generated/`.
- New `ClineSay` enum value → also update `src/shared/proto-conversions/cline-message.ts`.
- New RPC → handler in `src/core/controller/<domain>/` + call via `UiServiceClient.method(Request.create({...}))`.

## Adding a New API Provider
**MUST update proto conversion in 3 places or provider silently resets to Anthropic** (no error thrown—hits `default` case in proto round-trip):
1. `proto/cline/models.proto` — add to `ApiProvider` enum
2. `convertApiProviderToProto()` in `src/shared/proto-conversions/models/api-configuration-conversion.ts`
3. `convertProtoToApiProvider()` in the same file

Also update: `src/shared/api.ts`, `src/shared/providers/providers.json`, `src/core/api/index.ts`, `webview-ui/src/components/settings/utils/providerUtils.ts`, `webview-ui/src/utils/validate.ts`, `webview-ui/src/components/settings/ApiOptions.tsx`.

## Responses API Providers (OpenAI Codex, OpenAI Native)
Require native tool calling—XML tools don't work. Symptoms of misconfiguration: tools called multiple times, arguments duplicated/malformed.
- Missing from `isNextGenModelProvider()` in `src/utils/model-utils.ts` → falls back to XML tools.
- Model missing `apiFormat: ApiFormat.OPENAI_RESPONSES` in `src/shared/api.ts` → task runner won't force `enableNativeToolCalls: true`.

## Adding Tools to System Prompt
Always find an existing similar tool and follow its full chain. 5+ files required:
1. Add to `ClineDefaultTool` enum in `src/shared/tools.ts`
2. Create definition in `src/core/prompts/system-prompt/tools/` (export `[GENERIC]` minimum; fallback to GENERIC is automatic)
3. Register in `src/core/prompts/system-prompt/tools/init.ts`
4. Add to variant `config.ts` for each model family (generic, next-gen, xs, gpt-5, gemini-3, glm, hermes, etc.)
5. Handler in `src/core/task/tools/handlers/`, wire in `ToolExecutor.ts`
6. If UI feedback needed: add `ClineSay` in proto → `ExtensionMessage.ts` → `cline-message.ts` → `ChatRow.tsx`
7. Always: `UPDATE_SNAPSHOTS=true npm run test:unit` after prompt changes

## Modifying System Prompt
Modular: `components/` (shared) + `variants/` (model-specific) + `templates/` (`{{PLACEHOLDER}}`). Variants override via `componentOverrides` in `config.ts` or custom `template.ts`. XS variant is heavily condensed inline. Always regenerate snapshots after changes.
- Variant tiers: next-gen (Claude 4/GPT-5/Gemini 2.5), generic (standard), xs/hermes/glm (small/local)
- Check `variants/*/template.ts` for `rules_template` or `componentOverrides.RULES` before editing shared `components/rules.ts`

## Modifying Default Slash Commands — 3 places:
- `src/core/slash-commands/index.ts`, `src/core/prompts/commands.ts`, `webview-ui/src/utils/slash-commands.ts`

## Adding New Global State Keys — silent failure risk
1. `src/shared/storage/state-keys.ts` — add type
2. `src/core/storage/utils/state-helpers.ts` — add BOTH the `context.globalState.get()` call AND the return value in `readGlobalStateFromDisk()`. Missing just the `.get()` call compiles fine but value is always `undefined`.
3. If user-toggleable: wire BOTH `updateSettings.ts` (webview) AND `updateSettingsCli.ts` (CLI). Wire the round-trip: add to `UpdateSettingsRequest` in `proto/cline/state.proto`, include in `Controller.getStateToPostToWebview()`, and ensure `ExtensionState`/webview defaults include the key.

## StateManager: Startup Exception
Normal: `StateManager.get().getGlobalStateKey("key")`. Exception: state needed at startup BEFORE cache is ready (in `common.ts` during `initialize()`) → read directly from `context.globalState.get()`:
```ts
// Writing (any time): controller.stateManager.setGlobalState("myKey", value)
// Reading at startup (bypass cache): context.globalState.get<string>("myKey")
```
See `lastShownAnnouncementId` pattern.

## ChatRow Cancelled/Interrupted States
Status stays `"generating"` forever on cancel—no update is sent. Detect via TWO checks:
```tsx
const wasCancelled =
  status === "generating" &&
  (!isLast ||  // something came after → stale
    lastModifiedMessage?.ask === "resume_task" ||
    lastModifiedMessage?.ask === "resume_completed_task")  // just cancelled, not yet resumed
const isGenerating = status === "generating" && !wasCancelled
```
See `BrowserSessionRow.tsx` (`isLastApiReqInterrupted`) and `generate_explanation` ChatRow.

## Testing: Node Built-in Stubbing
Sinon throws `TypeError: Descriptor for property X is non-configurable` on Node built-ins (`execSync`, `readFileSync`, etc.). Fix: inject as optional constructor param:
```ts
export class MyHandler {
  constructor(
    private readonly validator: ToolValidator,
    private readonly _execSync: typeof execSync = execSync,  // real impl default
  ) {}
}
// In tests: new MyHandler(validator, sandbox.stub().returns(Buffer.from("")))
```
Apply to any new handler that imports Node built-ins directly.
