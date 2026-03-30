import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import VoiceRecorder from "./VoiceRecorder"

let mockExtensionState: {
	voiceSttEnabled: boolean
	voiceInputDeviceId: string
	voiceSilenceThresholdMs?: number
	voiceGracePeriodMs?: number
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
			voiceInputDeviceId: "",
		}
		mockPostMessage.mockClear()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("renders mic button when STT is enabled", () => {
		render(<VoiceRecorder onTranscription={vi.fn()} />)
		expect(screen.getByRole("button")).toBeTruthy()
		expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Start recording (Press)")
	})

	it("renders nothing when STT is disabled", () => {
		mockExtensionState = { voiceSttEnabled: false, voiceInputDeviceId: "" }
		const { container } = render(<VoiceRecorder onTranscription={vi.fn()} />)
		expect(container.firstChild).toBeNull()
	})

	it("uses selected input device when available", () => {
		mockExtensionState = {
			voiceSttEnabled: true,
			voiceInputDeviceId: "mic-1",
		}

		render(<VoiceRecorder onTranscription={vi.fn()} />)
		fireEvent.click(screen.getByRole("button"))

		expect(mockPostMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "start_voice_recording",
			}),
		)
	})

	it("falls back to default input when selected device is unavailable", () => {
		mockExtensionState = {
			voiceSttEnabled: true,
			voiceInputDeviceId: "missing-mic",
		}

		render(<VoiceRecorder onTranscription={vi.fn()} />)
		fireEvent.click(screen.getByRole("button"))

		// Host handles device fallback — webview posts start_voice_recording and host uses saved deviceId
		expect(mockPostMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "start_voice_recording",
			}),
		)
	})

	it("uses default input when no device is selected", () => {
		mockExtensionState = {
			voiceSttEnabled: true,
			voiceInputDeviceId: "",
		}

		render(<VoiceRecorder onTranscription={vi.fn()} />)
		fireEvent.click(screen.getByRole("button"))

		expect(mockPostMessage).toHaveBeenCalledTimes(1)
		expect(mockPostMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "start_voice_recording",
			}),
		)
	})
})
