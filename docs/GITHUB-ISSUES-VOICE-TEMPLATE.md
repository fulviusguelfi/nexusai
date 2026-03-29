# GitHub Issues — Phase 5 Voice Implementation

**Instructions**: Use this template to create the following issues on GitHub. Each issue includes:
- Title, description (body), label assignments, and acceptance criteria
- Creation command (if using GitHub CLI): `gh issue create -t "Title" -b "Body" -l "voice,enhancement"`

---

## 🔴 CLOSED — Already Fixed (For Reference)

### [CLOSED] #53 — Portuguese [unknown] → "pt"
**Status**: ✅ CLOSED (Fixed March 2026)  
**Label**: `bug`, `voice`, `language-detection`

**Description**:
```
Whisper-tiny doesn't return language metadata in output.
Portuguese transcription incorrectly detected as "[unknown]".

"Eu sou do Brasil" should detect as "pt", not "[unknown]"

✅ FIXED: Added heuristic detection analyzing Portuguese vocabulary:
- Checks for: ão, você, está, tudo bem, etc.
- Whisper language hint: "pt" passed for Portuguese focus
- Result: Portuguese now correctly returns "pt"
```

### [CLOSED] #54 — VoiceResponseHandler File Corruption
**Status**: ✅ CLOSED (Fixed March 2026)  
**Label**: `bug`, `voice`, `critical`

**Description**:
```
File had 57 TypeScript errors after merge conflict.
Methods were corrupted, class structure broken.

✅ FIXED: Restored proper class structure:
- Separated processSpeechToText() from processTextToSpeech()
- Removed premature TTS timing
- Restored proper pipelines
```

---

## 🔴 ACTIVE — P0 Priority (Blocking Release)

### [NEW] #56 — Portuguese Regression Test Coverage
**Status**: ⏳ PENDING  
**Label**: `test`, `voice`, `regression`, `critical`  
**Milestone**: 1.0.0-rc.1  
**Assignee**: [Your name]

**Description**:
```
CRITICAL: Add regression test for Portuguese language detection.

Previously broken: Portuguese returned "[unknown]" instead of "pt"
Fixed in March 2026 but coverage is missing.

**Acceptance Criteria**:
- [ ] Create languageDetection.test.ts (~120 lines)
- [ ] Test Portuguese detection: "Eu sou do Brasil" → "pt" 
- [ ] Test English detection: "Hello world" → "en"
- [ ] Test heuristic fallback (when Whisper doesn't return lang)
- [ ] Mock Whisper output for deterministic tests
- [ ] Run: npm run test:unit -- --grep "Portuguese"
- [ ] All 3 tests pass consistently

**Related Files**:
- src/services/voice/whisper.worker.ts (detection logic)
- tests/unit/WhisperService.test.ts (pattern example)

**Priority**: P0 — Regression protection essential for 1.0.0
**Effort**: 2-3 hours
**Depends On**: None
```

---

## 🟡 ACTIVE — P1 Priority (Next Sprint)

### [NEW] #50 — Device Selection UI
**Status**: ⏳ PENDING  
**Label**: `feature`, `voice`, `webview`, `ui`  
**Milestone**: 1.0.0-rc.2  
**Assignee**: [Your name]

**Description**:
```
Add microphone device selection dropdown in VoiceSettings.

Currently hardcoded to "Microfone (Jabra Link 380)".
Users with multiple devices cannot switch.

**Acceptance Criteria**:
- [ ] Create component: webview-ui/src/components/voice/DeviceSelector.tsx
- [ ] Enumerate audio devices in Windows (DirectShow API)
- [ ] Dropdown UI: List all available microphones
- [ ] User selection: Persist to VoiceSessionManager config
- [ ] CLI test: Verify enumerateWindowsAudioDevices() works
- [ ] UI test: Device list updates when devices plugged/unplugged
- [ ] Label: Show device name + capability badge (e.g., "16-bit, 44.1kHz")

**Definition of Done**:
- User can select from ≥2 audio devices
- Selection persists across sessions
- CLI + webview both respect selection
- No errors in console (Dev Tools)

**Related Files**:
- src/services/audio/WindowsAudioCapture.ts (enumerateWindowsAudioDevices)
- webview-ui/src/components/voice/VoiceSettingsSection.tsx
- VoiceSessionManager.ts (config persistence)

**Effort**: 8-10 hours
**Depends On**: None
```

### [NEW] #51 — Chat Integration: RECORD Button
**Status**: ⏳ PENDING  
**Label**: `feature`, `voice`, `webview`, `integration`  
**Milestone**: 1.0.0-rc.2  
**Assignee**: [Your name]

**Description**:
```
Integrate voice recording into chat UI.
Add "Record" button next to text input field.

When clicked:
1. Start recording from selected microphone
2. Show "Recording... ⏹️" indicator with timer
3. Auto-stop after 10 seconds or manual stop
4. Transcribe with Whisper
5. Insert transcription into chat input
6. User can edit/send

**Acceptance Criteria**:
- [ ] Add RecordButton.tsx component
- [ ] Button appears next to chat text input
- [ ] Click → Opens microphone permission once (or re-grant)
- [ ] Recording state: Visual feedback (LED indicator, timer)
- [ ] Stop options: Auto (10s) or manual button
- [ ] Transcription appears in input field (not as message yet)
- [ ] Transcription confidence badge (if Whisper returns it)
- [ ] Error handling: Show popup if microphone fails
- [ ] Accessibility: Label + keyboard shortcut (e.g., Ctrl+Shift+V)

**Definition of Done**:
- E2E test: User clicks Record → Says "hello" → "hello" appears in input
- Load test: Works after recording 5+ times
- No memory leaks or worker thread issues

**Related Files**:
- webview-ui/src/components/chat/ChatRow.tsx (layout integration)
- webview-ui/src/components/voice/VoiceRecorder.tsx (recording logic)
- src/core/task/tools/handlers/recordAndRespond.ts (handler)

**Effort**: 12-15 hours (includes E2E testing)
**Depends On**: #50 (Device Selection)
**Blocked By**: None
```

### [NEW] #52 — Audio Playback in Webview
**Status**: ⏳ PENDING  
**Label**: `feature`, `voice`, `webview`, `tts`  
**Milestone**: 1.0.0-rc.2  
**Assignee**: [Your name]

**Description**:
```
Play TTS audio response in webview instead of system speaker only.

Currently: TTS triggers speaker output only (PowerShell).
Needed: Webview shows audio player UI.

**Acceptance Criteria**:
- [ ] Create component: webview-ui/src/components/voice/AudioPlayer.tsx
- [ ] TTS response returns {audio: base64, mimeType: "audio/wav"}
- [ ] Chat UI shows player widget below agent response
- [ ] Play button → Plays audio in browser
- [ ] Pause/resume controls
- [ ] Progress bar with duration
- [ ] Volume control slider
- [ ] Auto-play option (checkbox in Settings)
- [ ] Multiple messages can have audio (player doesn't interfere)

**Definition of Done**:
- E2E test: Agent responds with voice → Audio player appears → Play works
- No browser permission errors
- Audio quality preserved (no re-encoding artifacts)

**Related Files**:
- webview-ui/src/components/chat/Message.tsx (show player)
- src/services/voice/PiperService.ts (TTS output format)
- webview-ui/src/components/voice/VoicePlayback.tsx (controls)

**Effort**: 8-10 hours
**Depends On**: #51 (Chat integration working)
**Blocked By**: None
```

### [NEW] #55 — Unit Test Suite for Voice Services
**Status**: ⏳ PENDING  
**Label**: `test`, `voice`, `coverage`  
**Milestone**: 1.0.0-rc.1  
**Assignee**: [Your name (or pair)]

**Description**:
```
Add comprehensive unit tests for Voice services.

Current coverage: 75% (E2E + handlers, missing service tests)
Target coverage: 95%+ (all services + edge cases)

**Missing Tests** (~750 lines total):

1. WhisperService.test.ts (~150 lines)
   - Transcribe with language hint
   - Language detection fallback
   - Worker thread lifecycle
   - Error handling (network, model download)

2. PiperService.test.ts (~100 lines)
   - Synthesize text
   - Voice selection
   - Format conversion (WAV → base64)
   - CLI path vs npm binary detection

3. VoiceResponseHandler.test.ts (~200 lines)
   - processSpeechToText() with/without language hint
   - processTextToSpeech() output format
   - Timing: STT → LLM → TTS phases
   - Error propagation

4. recordAndRespond.test.ts (~180 lines)
   - Audio buffer capture
   - Transcription flow
   - Empty audio response (correct behavior)
   - Portuguese regression case

5. languageDetection.test.ts (~120 lines)
   - Heuristic detection (Portuguese, English)
   - Edge cases (mixed language input)
   - Whisper language hint effect

**Acceptance Criteria**:
- [ ] All 5 test files created
- [ ] npm run test:unit -- --grep "voice" → 9-10 passing
- [ ] Coverage report: ≥95% for WhisperService + PiperService
- [ ] Portuguese regression test INCLUDED
- [ ] All tests use Mocha + Sinon pattern (see VoiceSessionManager.test.ts)
- [ ] CI/CD integration: Tests run on PR

**Definition of Done**:
- All new tests passing
- No flaky tests (run 5x)
- Code review: Coverage looks reasonable

**Related Files**:
- tests/unit/VoiceSessionManager.test.ts (pattern example)
- tests/unit/ListenForSpeechToolHandler.test.ts (mocking pattern)
- npm run test:unit (command)

**Effort**: 20-25 hours (5 hours each × 5 files)
**Depends On**: #56 (Regression test structure)
**Blocked By**: None

**Notes**:
- Use existing test patterns (Mocha, Sinon, should.js)
- Mock Whisper/Piper to avoid downloading models in tests
- Test both happy path + error cases
```

---

## 🟠 FUTURE — P2 Priority (Later Phases)

### [NEW] #57 — Performance: GPU Acceleration for Whisper
**Status**: ⏳ BACKLOG  
**Label**: `enhancement`, `voice`, `performance`  
**Milestone**: 1.0.1+  
**Assignee**: TBD

**Description**:
```
Optimize Whisper inference with GPU (CUDA/MPS if available).

Current: CPU-only inference ~15-30s per transcription
Target: GPU inference ~5-10s (if GPU available)

**Acceptance Criteria**:
- [ ] Detect GPU availability (CUDA on Windows/Linux, MPS on Mac)
- [ ] Load Whisper model with GPU backend
- [ ] Fallback to CPU if GPU unavailable
- [ ] Run benchmark: CPU vs GPU performance
- [ ] No package or binary bloat

**Effort**: 15-20 hours
**Depends On**: #55 (Tests must pass)
```

### [NEW] #58 — Multi-Language TTS Voice Selection
**Status**: ⏳ BACKLOG  
**Label**: `enhancement`, `voice`, `localization`  
**Milestone**: 1.0.1+  
**Assignee**: TBD

**Description**:
```
Support TTS in Portuguese, Spanish, German, French (Piper voices).

Currently: English-only (en_US-lessac-medium)
Needed: Language-specific voices + UI selection

**Acceptance Criteria**:
- [ ] Download Piper voice models for: pt-BR, es, de, fr
- [ ] Language → Voice mapping
- [ ] Settings UI: Voice selector dropdown
- [ ] E2E test: Portuguese response uses pt voice
- [ ] No model path conflicts

**Effort**: 10-12 hours
**Depends On**: #52 (TTS working)
```

---

## 📋 Creation Instructions

### Option A: GitHub CLI
```bash
# Install: https://cli.github.com/

# Create P0 issue #56
gh issue create \
  -t "Portuguese Regression Test Coverage" \
  -b "[Copy body from #56 section above]" \
  -l "test,voice,regression,critical" \
  --milestone "1.0.0-rc.1"

# Create P1 issue #50
gh issue create \
  -t "Device Selection UI" \
  -b "[Copy body from #50 section above]" \
  -l "feature,voice,webview,ui"
```

### Option B: GitHub Web UI
1. Go to: https://github.com/yourusername/cline/issues/new
2. Copy title + body from section above
3. Add labels (top right)
4. Set milestone (1.0.0-rc.1, etc.)
5. Click "Create"

---

## 📊 Issue Summary

| Priority | Issue # | Title | Status | Effort | Depends |
|----------|---------|-------|--------|--------|---------|
| P0 | #56 | Portuguese Regression Test | ⏳ NEW | 2-3h | — |
| P1 | #50 | Device Selection UI | ⏳ NEW | 8-10h | — |
| P1 | #51 | Chat RECORD Button | ⏳ NEW | 12-15h | #50 |
| P1 | #52 | Audio Playback in Webview | ⏳ NEW | 8-10h | #51 |
| P1 | #55 | Unit Test Suite | ⏳ NEW | 20-25h | #56 |
| P2 | #57 | GPU Acceleration | ⏳ BACKLOG | 15-20h | #55 |
| P2 | #58 | Multi-Language TTS | ⏳ BACKLOG | 10-12h | #52 |
| ✅ | #53 | Portuguese Detection | ✅ CLOSED | DONE | — |
| ✅ | #54 | File Corruption | ✅ CLOSED | DONE | — |

**Total Effort (P0+P1 only)**: ~65-75 hours  
**Typical Sprint**: 40-50 hours  
**Suggested**: Split across 2-3 sprints

---

**Last Generated**: March 2026  
**Source**: Fase 5 Integration Status  
**Ready to**: Copy → Paste into GitHub CLI or Web UI
