# Chat Alerts Reference

Complete catalog of all alert types displayed in the NexusAI chat interface.

## Alert Component

All alerts use the `Alert` component from `webview-ui/src/components/ui/alert.tsx` with four variants:

| Variant | Style | Usage |
|---------|-------|-------|
| `default` | Subtle background | Informational messages |
| `warning` | Amber background | Operational warnings (non-blocking) |
| `danger` | Red background | Critical errors (may block interaction) |
| `cline` | Custom theme | Agent-branded messages |

---

## Alert Types

### 1. Checkpoint Warning
- **File**: `webview-ui/src/components/chat/task-header/CheckpointError.tsx`
- **Variant**: `warning` (reclassified from `danger` in Phase 6)
- **Trigger**: Checkpoint save/restore operations encounter issues
- **Blocking**: No
- **Notes**: Operational warning — checkpoints are a convenience feature, not critical

### 2. Inline Error
- **File**: `webview-ui/src/components/chat/ChatRow.tsx` (error say type)
- **Variant**: `danger` (inline red text)
- **Trigger**: Tool execution failures, API errors
- **Blocking**: No

### 3. Diff Error
- **File**: `webview-ui/src/components/chat/ChatRow.tsx`
- **Variant**: `default` (beige background)
- **Trigger**: File diff application failures
- **Blocking**: No

### 4. .clineignore Error
- **File**: `webview-ui/src/components/chat/ChatRow.tsx`
- **Variant**: `default` (beige background)
- **Trigger**: Agent attempts to access a file blocked by `.clineignore`
- **Blocking**: No (shows message, agent continues)

### 5. Shell Integration Warning
- **File**: `webview-ui/src/components/chat/ChatRow.tsx`
- **Variant**: `danger` (red border)
- **Trigger**: Terminal shell integration not available or timed out
- **Blocking**: No (agent can still use terminal, but without output capture)

### 6. Shell Integration Suggestion
- **File**: `webview-ui/src/components/chat/ChatRow.tsx`
- **Variant**: `default` (blue informational)
- **Trigger**: First-time suggestion to enable shell integration
- **Blocking**: No

### 7. Error Retry
- **File**: `webview-ui/src/components/chat/ChatRow.tsx`
- **Variant**: `default` (beige/red mixed)
- **Trigger**: Agent encounters an error and retries automatically
- **Blocking**: No

### 8. MCP Notification
- **File**: `webview-ui/src/components/chat/ChatRow.tsx`
- **Variant**: `default` (beige background)
- **Trigger**: MCP server status changes (connected, disconnected, error)
- **Blocking**: No

### 9. Checkpoint Created
- **File**: `webview-ui/src/components/chat/ChatRow.tsx`
- **Variant**: Icon-only (no alert box)
- **Trigger**: A checkpoint is successfully saved
- **Blocking**: No

### 10. Generate Explanation
- **File**: `webview-ui/src/components/chat/ChatRow.tsx`
- **Variant**: Code background style
- **Trigger**: Agent generates step-by-step explanation of its reasoning
- **Blocking**: No

### 11. Conditional Rules
- **File**: `webview-ui/src/components/chat/ChatRow.tsx`
- **Variant**: Header-style (section divider)
- **Trigger**: `.clinerules` conditional rules are active for current context
- **Blocking**: No

### 12. Mistake Limit Reached
- **File**: `webview-ui/src/components/chat/ChatRow.tsx`
- **Variant**: `danger` (red background)
- **Trigger**: Agent exceeds `maxConsecutiveMistakes` setting
- **Blocking**: **Yes** — blocks further agent action until user intervention

### 13. Voice Speaking
- **File**: `webview-ui/src/components/voice/VoiceRecorder.tsx`
- **Variant**: Custom (unmute icon indicator)
- **Trigger**: Piper TTS is speaking a response
- **Blocking**: No (mic is gated by SpeakerGate during playback)

### 14. Voice Listening
- **File**: `webview-ui/src/components/voice/VoiceRecorder.tsx`
- **Variant**: Custom (mic icon with green pulsing dot)
- **Trigger**: Microphone is active, recording user speech
- **Blocking**: No

---

## Adding New Alerts

1. Choose the appropriate variant based on severity
2. Use `Alert` component from `webview-ui/src/components/ui/alert.tsx`
3. If the alert needs a new `ClineSay` type, follow the proto workflow (see `copilot-instructions.md`)
4. Only use `danger` variant for genuinely critical, user-actionable errors
5. Use `warning` for operational issues that don't block workflow
