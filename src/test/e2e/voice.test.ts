import { E2ETestHelper, e2e } from "./utils/helpers"

// Phase 5 — Voice Tools
//
// All handlers are in src/core/task/tools/handlers/ (SpeakTextToolHandler.ts,
// ListenForSpeechToolHandler.ts). The VoiceSessionManager bridges the backend
// to the VS Code webview for audio I/O.
//
// Voice hardware (microphone / speakers) is unavailable in CI, so TTS and STT
// may not fully complete in all environments. These tests verify that the tools
// execute under enabled-by-default settings and that the agent wraps up cleanly.
//
// Mock server keyword → LLM response mappings live in:
//   fixtures/server/api.ts  (E2E_VOICE_MOCK_API_RESPONSES)
//   fixtures/server/index.ts (// ── Voice routing ──)

e2e.describe("Voice Tools", () => {
	// ── 1 ──────────────────────────────────────────────────────────────────────
	e2e("speak_text — tool executes with TTS enabled by default", async ({ helper, sidebar }) => {
		await helper.signin(sidebar)

		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("voice_speak_request")
		await sidebar.getByTestId("send-button").click()

		await E2ETestHelper.waitForChatMessage(sidebar, "Speaking:", 60_000)
	})

	// ── 2 ──────────────────────────────────────────────────────────────────────
	e2e("listen_for_speech — tool executes with STT enabled by default", async ({ helper, sidebar }) => {
		await helper.signin(sidebar)

		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("voice_listen_request")
		await sidebar.getByTestId("send-button").click()

		await E2ETestHelper.waitForChatMessage(sidebar, "No speech was captured within the timeout window.", 60_000)
	})
})
