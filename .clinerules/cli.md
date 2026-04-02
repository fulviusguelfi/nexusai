# CLI Development

The `cli/` directory currently contains voice utilities (`voice-stt.ts`, `test-piper.ts`) and examples.
A full React Ink terminal UI (`cli/src/`) has not yet been ported from the upstream Cline fork.

- When adding features to the webview, note that a matching CLI TUI is planned but not yet implemented.
- The React Ink CLI architecture is documented but pending — do not reference `cli/src/` paths as they do not exist.

## Adding New API Providers

API provider configuration lives in `src/shared/api.ts` and `webview-ui/src/components/settings/ApiOptions.tsx`.
The CLI counterpart (`cli/src/components/ModelPicker.tsx`) does not yet exist.