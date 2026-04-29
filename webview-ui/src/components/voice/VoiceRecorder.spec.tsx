import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import VoiceRecorder from "./VoiceRecorder"

let mockExtensionState: {
	voiceSttEnabled: boolean
	voiceMaxRecordingDurationMs?: number
}

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: vi.fn(() => mockExtensionState),
}))

const mockPostMessage = vi.fn()
vi.mock("@/config/platform.config", () => ({
	PLATFORM_CONFIG: {
		postMessage: (msg: unknown) => mockPostMessage(msg),
	},
}))

describe("VoiceRecorder", () => {
	beforeEach(() => {
		mockExtensionState = {
			voiceSttEnabled: true,
		}
		mockPostMessage.mockClear()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("renders mic button when STT is enabled", () => {
		render(<VoiceRecorder onTranscription={vi.fn()} />)
		expect(screen.getByRole("button")).toBeTruthy()
		expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Click to record (push-to-talk)")
	})

	it("renders nothing when STT is disabled", () => {
		mockExtensionState = { voiceSttEnabled: false }
		const { container } = render(<VoiceRecorder onTranscription={vi.fn()} />)
		expect(container.firstChild).toBeNull()
	})

	it("posts start_voice_recording when mic button is clicked", () => {
		render(<VoiceRecorder onTranscription={vi.fn()} />)
		fireEvent.click(screen.getByRole("button"))

		expect(mockPostMessage).toHaveBeenCalledTimes(1)
		expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "start_voice_recording" }))
	})

	it("uses voiceMaxRecordingDurationMs from settings when set", () => {
		mockExtensionState = { voiceSttEnabled: true, voiceMaxRecordingDurationMs: 30000 }

		render(<VoiceRecorder onTranscription={vi.fn()} />)
		fireEvent.click(screen.getByRole("button"))

		expect(mockPostMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "start_voice_recording",
				start_voice_recording: expect.objectContaining({ maxDurationMs: 30000 }),
			}),
		)
	})

	it("falls back to 120 000 ms when voiceMaxRecordingDurationMs is not set", () => {
		render(<VoiceRecorder onTranscription={vi.fn()} />)
		fireEvent.click(screen.getByRole("button"))

		expect(mockPostMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "start_voice_recording",
				start_voice_recording: expect.objectContaining({ maxDurationMs: 120000 }),
			}),
		)
	})

	it("posts stop_voice_recording on second click", () => {
		render(<VoiceRecorder onTranscription={vi.fn()} />)

		// first click → start
		fireEvent.click(screen.getByRole("button"))
		expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "start_voice_recording" }))

		// second click → stop
		fireEvent.click(screen.getByRole("button"))
		expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "stop_voice_recording" }))
	})

	it("recovers from PROCESSING when voice_result arrives without IDLE", async () => {
		render(<VoiceRecorder onTranscription={vi.fn()} />)

		await act(async () => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "voice_agent_state_changed",
						voice_agent_state_changed: { state: "PROCESSING" },
					},
				}),
			)
		})

		const button = screen.getByRole("button") as HTMLButtonElement
		await waitFor(() => expect(button.disabled).toBe(true))

		await act(async () => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "voice_result",
						voice_result: {
							success: true,
							transcriptionText: "teste",
						},
					},
				}),
			)
		})

		await waitFor(() => expect(button.disabled).toBe(false))
		expect(button.getAttribute("aria-label")).toBe("Click to record (push-to-talk)")
	})
})
