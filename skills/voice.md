# Voice Skill
TTS (Piper) and STT (Whisper) pipeline for NexusAI.

## Critical Rule
**NEVER respond to own TTS output.** SpeakerGate blocks STT during TTS playback. Never disable it.

## Architecture
```
User mic → VoiceRecorder (webview) → float32 PCM 16kHz
  → extension host → WhisperService (STT) → transcription
  → Controller → LLM → response text
  → PiperService (TTS) → WAV → System.Media.SoundPlayer (host playback)
  → AvatarOverlay (lip sync via LipSyncController + rhubarb WASM)
```

## Agent Tools
| Tool | Description |
|---|---|
| `speak_text` | Synthesize and play TTS. Checks `voiceTtsEnabled`. |
| `listen_for_speech` | Wait for STT transcription (30s timeout). Checks `voiceSttEnabled`. |

## Global State Keys
| Key | Type | Default |
|---|---|---|
| `voiceTtsEnabled` | boolean | false |
| `voiceSttEnabled` | boolean | false |
| `voicePiperVoice` | string | `en_US-lessac-medium` |
| `voiceInputDeviceId` | string | undefined |
| `voiceOutputDeviceId` | string | undefined |
| `voiceSilenceThresholdMs` | number | 1500 |
| `voiceGracePeriodMs` | number | 300 |
| `voiceMaxRecordingDurationMs` | number | 120000 |
| `avatarEnabled` | boolean | false |
| `avatarName` | string | `NexusAI` |
| `avatarPersonalityTone` | `formal\|casual\|technical` | `casual` |
| `avatarPersonalityResponseMode` | `concise\|detailed\|conversational` | `concise` |

## Supported Voice Models (Piper)
- `en_US-lessac-medium` (default English)
- `en_US-ryan-medium`
- `pt_BR-faber-medium`
- `pt_BR-cadu-medium`

## SpeakerGate
`SpeakerGate.ts` — idempotent, event-based. Blocks `VoiceRecorder` while `isSpeaking=true`.
Do not bypass — prevents TTS→STT feedback loop.

## Avatar States
`IDLE | INITIALIZING | READY_TO_LISTEN | RECORDING | PROCESSING | PLAYING | ERROR`
Animations driven by framer-motion. 9 visemes (A-H + X silence) synced via RAF loop.