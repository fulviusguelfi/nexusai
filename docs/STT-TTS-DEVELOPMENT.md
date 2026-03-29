# 🎤 STT/TTS Development Guide: CLI vs Webview

## Your Situation

❌ VS Code webview → microphone denied error
✅ Windows microphone works fine standalone
⚠️ Need to develop & debug STT/TTS without fighting Electron permission issues

## ✅ The Solution: CLI-First Development

### Why This Works

Your project already has:
- **WhisperService.ts** - offline STT (reusable)
- **PiperService.ts** - offline TTS (reusable)
- **VoiceSessionManager.ts** - state management (zero VS Code imports)

The **ONLY** thing that differs between CLI and webview is **audio capture**:
- CLI: `WindowsAudioCapture.ts` (FFmpeg) ← you're creating this now
- Webview: `VoiceRecorder.tsx` (Web Audio API)

**Both send the same `Float32Array` to `WhisperService`** ✅

```
┌─ CLI (process.stdin → FFmpeg)
│  └─ WindowsAudioCapture.ts → Float32Array
│     └─ WhisperService.transcribe(Float32Array) ✅ WORKS
│
└─ Webview (browser getUserMedia)
   └─ VoiceRecorder.tsx → Float32Array
      └─ WhisperService.transcribe(Float32Array) ✅ WORKS
```

## 🚀 Getting Started: Run CLI Examples

### 1. Build the project
```bash
npm run compile
npm run protos
```

### 2. Test STT (speech-to-text) only
```bash
npx ts-node cli/examples/voice-to-text.ts
```

This will:
1. Record 10 seconds from your microphone (using FFmpeg, NO VS Code dependency)
2. Transcribe with Whisper locally
3. Print what you said

**If this works** → Your microphone + Whisper are fine ✅

### 3. Test full STT + TTS
```bash
npx ts-node cli/examples/full-voice-demo.ts
```

This will:
1. Record 5 seconds
2. Transcribe with Whisper
3. Synthesize a response with Piper TTS
4. Play the audio back

## 🔍 Why VS Code Webview Fails

### The Permission Stack

```
Windows Audio Device (e.g., "Microphone")
    ↓
1. Windows Privacy Settings: ✅ You enabled this
    ↓
2. Electron Permission Handler: ✅ Your code auto-grants
    ↓
3. Browser Security Model (Electron webview)
    ↓
❌ getUserMedia() DENIED somewhere
```

### Root Causes (in priority order)

| Cause | Detection | Fix |
|-------|-----------|-----|
| **VS Code process lacks Windows permission** | Try recording in standalone Electron app | Grant permission to `Code.exe` in Windows Settings → Privacy → Microphone |
| **Browser context restrictions** | getUserMedia works in Node but not webview | May need Electron-specific permission flow |
| **Webview sandbox too strict** | getUserMedia('audio') immediately fails | Check webview preload scripts / sandbox config |
| **Wrong getUserMedia constraints** | See exact error message in console | Add fallback to `{ audio: { autoGainControl: false } }` |

### Quick Diagnostic

Add this to `VoiceSettingsSection.tsx`:

```typescript
// TEMPORARY DEBUG - Line 140 area, inside requestPermission()
console.log("[DEBUG] mediaDevices:", typeof navigator.mediaDevices)
console.log("[DEBUG] getUserMedia:", typeof navigator.mediaDevices?.getUserMedia)

if (navigator.mediaDevices) {
  navigator.permissions?.query?.({ name: "microphone" }).then(result => {
    console.log("[DEBUG] Permission query result:", result.state)
  })
}
```

Then check VS Code **Developer Tools** (Help → Toggle Developer Tools) console output.

## 📋 Development Workflow

### Week 1: Debug & Develop in CLI (What You Do Now)

1. ✅ Test microphone capture: `voice-to-text.ts`
2. ✅ Test full pipeline: `full-voice-demo.ts`
3. ✅ Add custom audio processing if needed
4. ✅ Create CLI commands: `cline voice-record` / `cline voice-transcribe`

### Week 2: Port to Webview (When CLI Works)

1. Rename: `WindowsAudioCapture.ts` → `WebAudioCapture.ts`
2. Update: `VoceRecorder.tsx` to use renamed service
3. **Same WhisperService + PiperService** ✅ No changes needed
4. Test in VS Code webview

## 🛠️ Architecture: Shared vs Platform-Specific

### ✅ Reusable Across CLI + Webview

```
src/services/voice/
├── WhisperService.ts          ✅ SAME (both)
├── PiperService.ts            ✅ SAME (both)
├── VoiceSessionManager.ts      ✅ SAME (both)
├── whisper.worker.ts           ✅ SAME (both)
└── proto/voice.proto           ✅ SAME (both)
```

### ❌ Platform-Specific (different for CLI vs Webview)

```
Audio Capture:
├── CLI → src/services/audio/WindowsAudioCapture.ts (FFmpeg)
└── Webview → webview-ui/src/components/voice/VoiceRecorder.tsx (Web Audio API)
```

## 🎯 Next Steps

1. **Run CLI examples** → Confirm STT/TTS works outside VS Code
2. **Identify VS Code issue** → Use diagnostic steps above
3. **Either:**
   - Fix Electron permissions → Use webview after
   - Ship CLI + webview versions independently

## 📝 Notes

- **FFmpeg requirement**: CLI examples need `ffmpeg` in PATH
  ```bash
  # Install on Windows
  choco install ffmpeg
  # OR
  scoop install ffmpeg
  ```

- **Whisper + Piper models**: First run downloads ~3GB of models to `%USERPROFILE%/.cache/huggingface/`

- **Audio format**: Always 16kHz 16-bit mono for Whisper compatibility

## 🚨 If CLI Fails

If `voice-to-text.ts` fails:

1. **Check FFmpeg**: `ffmpeg -version`
2. **Check microphone**: `ffmpeg -f dshow -list_devices true -i dummy` (shows audio devices)
3. **Check Whisper models**: Is `%USERPROFILE%/.cache/` being written?
4. **Add verbose logging**: Add `console.log("[DEBUG]", ...)` to `WindowsAudioCapture.ts`

---

**Go CLI-first. It'll work. Then we fix the webview.** ✨
