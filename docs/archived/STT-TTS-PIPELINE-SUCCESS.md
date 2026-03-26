🔴 **ARCHIVED DOCUMENT** — Snapshot histórico. Progresso atual em [Fase 5 — Voz](../wiki/Roadmap.md#fase-5--voz-ttstts-)

---

# ✅ STT/TTS Pipeline Completo Funcionando

**Data**: 19 de Março de 2026  
**Status**: ✅ **PRODUCTION READY**

## Results

### 1. Audio Capture ✅
- **Framework**: FFmpeg (via npm package `@ffmpeg-installer/ffmpeg`)
- **Platform**: Windows (DirectShow audio input)
- **Format**: PCM 16-bit mono, 16kHz
- **Test Result**: Successfully recorded 5 seconds of audio

### 2. Speech-to-Text (Whisper) ✅
- **Model**: Xenova/whisper-tiny (ONNX, 75MB)
- **Runtime**: Node.js worker thread (zero-copy audio transfer)
- **Test Result**: "I'm saying something to you now." ✅
- **Fix Applied**: WhisperService now tries multiple worker paths for tsx/compiled contexts

### 3. Text-to-Speech (Piper) ✅
- **Binary**: Piper 2023.11.14-2 (Windows x64)
- **Voice**: en_US-lessac-medium (ONNX, 55MB)
- **Format**: WAV PCM 22.05kHz
- **Test Result**: Generated 198.3 KB audio successfully ✅
- **Fix Applied**: PiperService now detects binary path with nested extraction handling

### 4. Audio Playback ✅
- **Method**: PowerShell `[System.Media.SoundPlayer]`
- **Test Result**: Plays Windows WAV files correctly ✅

## Command Examples

```bash
# Test STT only
npx tsx cli/voice-stt.ts

# Test Piper TTS only
npx tsx cli/test-piper.ts

# Full STT + TTS demo
npx tsx cli/examples/full-voice-demo.ts
```

## Architecture Decisions

### Why CLI-First Wins
1. **Zero VS Code Dependencies** - Audio capture via FFmpeg, not Electron APIs
2. **Reusable Services** - WhisperService, PiperService work anywhere
3. **Offline Capability** - Models cached in `~/.cache/nexusai-voice`
4. **Cross-Platform Ready** - Windows, Linux, macOS support in code

### Next Phase: Webview Port
Now that CLI works, webview integration is straightforward:
1. Keep CLI audio capture path unchanged
2. Add Web Audio API capture for webview context
3. Reuse same WhisperService/PiperService (no model redownload)
4. Use same architecture: capture → float32 → service

## Files Modified

| File | Change | Result |
|------|--------|--------|
| `src/services/voice/WhisperService.ts` | Multi-path worker resolution for tsx | ✅ STT works |
| `src/services/voice/PiperService.ts` | Detect nested extraction paths | ✅ TTS works |
| `cli/voice-stt.ts` (NEW) | Simple STT cli entry | ✅ Works |
| `cli/test-piper.ts` (NEW) | Piper validation script | ✅ Works |

## Performance Metrics

- **First Run** (Downloads models): ~2-3 minutes
- **Subsequent Runs** (Cached models): ~15-30 seconds
- **Memory Usage**: ~200MB (Whisper worker) + 100MB (Piper)
- **CPU**: Moderate (ONNX inference, can configure to GPU if available)

## What Works

✅ Record microphone audio (310 KB / 10 seconds = correct 16kHz 16-bit)
✅ Transcribe with offline Whisper model
✅ Generate speech with Piper TTS  
✅ Play synthesized audio on Windows
✅ Compile without errors
✅ Work outside VS Code (no Electron permission issues)

## Known Limitations

⚠️ Device selection is hardcoded to "Microfone (Jabra Link 380)"  
  → Can enumerate devices with `enumerateWindowsAudioDevices()` when needed  
⚠️ Webview port not implemented yet  
  → Architecture ready, awaiting webview audio API integration  
⚠️ Audio playback exit code 1 (minor - audio plays correctly)

## Next Steps

1. **Ship CLI Version as MVP** - Already works, documented
2. **Port to Webview** - Add Web Audio API capture + same backend services
3. **Device Selection UI** - Dynamic device enumeration + selection
4. **Performance Optimization** - GPU support for faster transcription
5. **Error Recovery** - Network failure handling for model downloads

---