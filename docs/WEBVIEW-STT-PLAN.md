# 🎤 Webview STT/TTS Integration Plan

**Phase**: 2 - Webview Integration  
**Status**: 📋 Planning  
**Goal**: Integrate working CLI audio pipeline into VS Code webview

## Architecture

```
┌─ WEBVIEW (React) ─────────────────────────────┐
│                                              │
│  UI/SpeechInput.tsx                          │
│    ↓                                         │
│  WebAudioCapture (Web Audio API)            │ ← New: Browser microphone
│    ↓ (Float32Array)                         │
│  ExtensionStateContext (message passing)    │
│    ↓ (send to backend)                      │
└────────────────────────────────────────────────┘
           ↓ (Protocol Buffer messages)
┌─ EXTENSION BACKEND ───────────────────────────┐
│                                              │
│  Controller.handleSpeechToText()            │ ← New handler
│    ↓                                        │
│  WhisperService.transcribe() ✅ (same)     │
│    ↓                                        │
│  Controller.handleTextToSpeech()            │ ← New handler
│    ↓                                        │
│  PiperService.synthesize() ✅ (same)       │ ← Reuse backend!
│    ↓                                        │
│  response (Float32Array as base64)         │
└────────────────────────────────────────────────┘
           ↓ (Protocol Buffer messages)
┌─ WEBVIEW ────────────────────────────────────┐
│  Play audio (Web Audio API)                 │
└────────────────────────────────────────────────┘
```

## Tasks

### Phase 2A: Web Audio Capture (Webview)
1. [ ] Create `src/services/audio/WebAudioCapture.ts`
   - Use navigator.mediaDevices.getUserMedia()
   - Request microphone permission (one-time)
   - Capture PCM as Float32Array
   - Handle permission denied gracefully
   
2. [ ] Create `webview-ui/src/utils/AudioCapture.ts` (React hook)
   - Wrapper around WebAudioCapture
   - Permission state management
   - Progress callback support

### Phase 2B: Protocol Buffer RPC (Backend)
1. [ ] Add to `proto/cline/voice.proto`:
   ```protobuf
   message SpeechToTextRequest {
     bytes audio_float32 = 1;  // Float32Array as bytes
     int32 sample_rate = 2;
   }
   
   message SpeechToTextResponse {
     string text = 1;
     string error = 2;
   }
   ```

2. [ ] Register handler in `src/core/controller/ControllerService.ts`
   - Voice/SpeechToText RPC
   - Voice/TextToSpeech RPC

3. [ ] Create `src/core/controller/voice/VoiceHandler.ts`
   - SpeechToText: delegate to WhisperService ✅ (reuse)
   - TextToSpeech: delegate to PiperService ✅ (reuse)

### Phase 2C: React UI Component
1. [ ] Create `webview-ui/src/components/SpeechInput.tsx`
   - Record button + real-time transcription display
   - Permission state UI
   - Error handling

2. [ ] Add to settings or chat interface
   - Toggle voice mode on/off
   - Microphone selection UI (future)
   - Test with existing chat

### Phase 2D: Testing
1. [ ] Unit tests for WebAudioCapture permission handling
2. [ ] E2E test: Record → Transcribe → Parse → Display
3. [ ] Verify fallback to text input if microphone denied
4. [ ] Test audio playback in webview (existing Web Audio API)

## Key Differences from CLI

| Aspect | CLI | Webview |
|--------|-----|---------|
| Audio Capture | FFmpeg (DirectShow) | Web Audio API |
| Microphone Permission | System OS | Browser (one-time popup) |
| Backend Services | WhisperService ✅ | **Same WhisperService** ✅ |
| TTS Backend | PiperService ✅ | **Same PiperService** ✅ |
| Audio Format | PCM 16-bit → Float32 | Float32 (native) |
| Playback | PowerShell | Web Audio API (native) |

### No Changes Needed
✅ `WhisperService` (works as-is)
✅ `PiperService` (works as-is)
✅ Audio conversion utilities (reusable)

### New Files Needed
- `src/services/audio/WebAudioCapture.ts` (~150 lines)
- `webview-ui/src/utils/AudioCapture.ts` (~80 lines)
- `webview-ui/src/components/SpeechInput.tsx` (~200 lines)
- `src/core/controller/voice/VoiceHandler.ts` (~100 lines)
- Proto updates (`proto/cline/voice.proto`)

## Estimated Effort
- **WebAudioCapture**: 30 min
- **Proto RPC setup**: 20 min
- **Backend handlers**: 15 min
- **React component**: 45 min
- **Testing**: 30 min
- **Total**: ~2.5 hours

## Risk Mitigation
⚠️ Microphone permission denied → Show fallback text input
⚠️ Browser Web Audio issues → Graceful degradation to CLI
⚠️ Large audio files → Chunked transfer via Protocol Buffers
⚠️ Model download on backend → Cache already working (CLI tested)

## Decision Point
After testing: **Ship webview integration OR iterate on UI?**
- Option A: Merge to main as feature-complete
- Option B: Keep CLI-only for now (safer)
- Option C: Feature gate webview voice (experimental toggle)

---

**Ready to start Phase 2A?** → `npm run protos` + create WebAudioCapture.ts
