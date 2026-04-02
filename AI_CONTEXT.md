# NexusAI — AI Context Document

> Version: 1.0.0-alpha | Last updated: 2025-01 | Fork of Cline v3.71.0

## Identity

- **Name**: NexusAI
- **Author**: fulviusguelfi
- **License**: Apache-2.0
- **Upstream**: [cline/cline](https://github.com/cline/cline) v3.71.0
- **Repo**: https://github.com/fulviusguelfi/nexusai

## What is NexusAI?

NexusAI is a VS Code extension and agentic coding assistant forked from Cline. It extends Cline with a **voice pipeline** (STT via Whisper, TTS via Piper) and IoT/network tools, while preserving the full Cline agent loop, MCP support, and multi-provider LLM architecture.

## Architecture Overview

```
extension.ts           Entry point — activates WebviewProvider
WebviewProvider        Manages webview lifecycle + message bridge
Controller             Single source of truth: state, webview sync, RPC handlers
Task                   The agent loop: tool execution, streaming, checkpoints
proto/cline/           Protobuf schemas (regenerate with: npm run protos)
src/services/voice/    Voice pipeline: VoiceAgent, WhisperService, PiperService
webview-ui/            React/Vite app (Tailwind + VSCode Webview UI Toolkit)
cli/                   Voice utilities (full React Ink CLI not yet ported)
```

## Key Differences from Upstream Cline

| Feature | Cline | NexusAI |
|---------|-------|---------|
| Voice STT | ❌ | ✅ Whisper (offline, ONNX) |
| Voice TTS | ❌ | ✅ Piper (offline, neural) |
| IoT Tools | ❌ | ✅ MQTT / mDNS / HTTP |
| SSH Tools | ❌ | ✅ node-ssh |
| Branding | Cline | NexusAI |

## Build Commands

```powershell
npm run compile          # Build TypeScript (NOT npm run build)
npm run watch            # Watch mode (extension + webview)
npm run protos           # Regenerate proto files (run after any .proto change)
npm run test:unit        # Run unit tests
UPDATE_SNAPSHOTS=true npm run test:unit  # Regenerate snapshots after prompt changes
```

## Critical Conventions

- **Protobuf-first**: All new RPC methods require proto definition → `npm run protos` → backend handler → frontend call
- **Adding API providers**: 3 places in proto conversions or it silently resets to Anthropic (see `.github/copilot-instructions.md`)
- **Global State Keys**: Add to `GlobalStateAndSettingKeys` in `src/shared/storage/state-keys.ts` — reading is automatic
- **Path helpers**: Always use `src/utils/path` helpers (`toPosixString`) for cross-platform paths
- **Voice messenger**: Use `getVoiceMessenger()` dynamic import pattern to avoid circular deps

## Voice Pipeline Architecture

```
User mic → VoiceRecorder (webview) → float32 PCM 16kHz
  → extension host → WhisperService (ONNX worker) → transcription text
  → Controller → LLM → response text
  → PiperService (TTS) → WAV audio
  → webview → AudioPlayer component → HTML5 audio playback
```

Key files:
- `src/services/voice/WhisperService.ts` — STT via HuggingFace transformers ONNX
- `src/services/voice/PiperService.ts` — TTS via Piper binary
- `src/core/controller/voice/recordAndRespond.ts` — main voice pipeline
- `webview-ui/src/components/voice/VoiceRecorder.tsx` — recording UI
- `webview-ui/src/components/voice/AudioPlayer.tsx` — TTS playback UI

## Project Status

- ✅ Voice STT/TTS pipeline complete (Phases 1–6)
- ✅ Avatar lip sync (rhubarb WASM)
- ✅ IoT tools (MQTT, mDNS, HTTP)
- ✅ SSH tools
- 🔄 Full CLI React Ink TUI (planned)
- 🔄 GPU Whisper acceleration (backlog)

## Known Migration Notes

This project is migrating from "Cline" branding to "NexusAI":
- Code symbols (`ClineMessage`, `ClineSay`, proto types) still use "Cline" for API compatibility
- User-facing UI strings have been updated to "NexusAI"
- Deeper refactor tracked in issues #50–#59

## Reading Order for New IAs

1. This file (`AI_CONTEXT.md`)
2. `.github/copilot-instructions.md` — critical non-obvious patterns
3. `.clinerules/general.md` — tribal knowledge
4. `src/` — main extension source
5. `docs/` — extended documentation by topic
