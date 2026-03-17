import { E2ETestHelper, e2e } from "./utils/helpers"

// Phase 5 — Voice Tools
//
// All handlers are in src/core/task/tools/handlers/ (SpeakTextToolHandler.ts,
// ListenForSpeechToolHandler.ts). The VoiceSessionManager bridges the backend
// to the VS Code webview for audio I/O.
//
// Voice hardware (microphone / speakers) is unavailable in CI, so TTS and STT
// are disabled by default.  These tests verify that the tools execute, return
// an appropriate "disabled" message, and that the agent wraps up cleanly.
//
// Mock server keyword → LLM response mappings live in:
//   fixtures/server/api.ts  (E2E_VOICE_MOCK_API_RESPONSES)
//   fixtures/server/index.ts (// ── Voice routing ──)

e2e.describe("Voice Tools", () => {
	// ── 1 ──────────────────────────────────────────────────────────────────────
	e2e("speak_text — tool executes, chat reports TTS disabled", async ({ helper, sidebar }) => {
		await helper.signin(sidebar)

		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("voice_speak_request")
		await sidebar.getByTestId("send-button").click()

		// The tool returns "TTS is disabled" when voiceTtsEnabled is false (CI default).
		// The mock LLM wraps that into the attempt_completion result.
		await E2ETestHelper.waitForChatMessage(sidebar, "TTS is disabled", 60_000)
	})

	// ── 2 ──────────────────────────────────────────────────────────────────────
	e2e("listen_for_speech — tool executes, chat reports STT disabled", async ({ helper, sidebar }) => {
		await helper.signin(sidebar)

		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("voice_listen_request")
		await sidebar.getByTestId("send-button").click()

		// The tool returns "STT is disabled" when voiceSttEnabled is false (CI default).
		await E2ETestHelper.waitForChatMessage(sidebar, "STT is disabled", 60_000)
	})
})
