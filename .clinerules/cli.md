# CLI Development

The CLI lives in `cli/` and uses React Ink for terminal UI.

- Colors: use `cli/src/constants/colors.ts` constants (e.g., `COLORS.primaryBlue`). Never use `dimColor` with gray—too hard to read. Use `color="gray"` for secondary text, no color for primary.
- State/messages: follow the same patterns as webview when communicating with core.
- When updating webview features, also update the CLI TUI for feature parity.

## Adding New API Providers

1. `cli/src/components/ModelPicker.tsx` — add to `providerModels` map with models and defaultId from `@shared/api`
2. `cli/src/utils/provider-config.ts` — use `applyProviderConfig()` for auth flows (handles provider, model, API key, state persistence, handler rebuild)
3. OAuth providers — add handling in `SettingsPanelContent.tsx`'s `handleProviderSelect` (see Codex OAuth flow as reference)