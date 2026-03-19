import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import VoiceRecorder from "./VoiceRecorder"

let mockExtensionState: {
	voiceSttEnabled: boolean
	voiceInputDeviceId: string
}

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: vi.fn(() => mockExtensionState),
}))

describe("VoiceRecorder", () => {
	let originalMediaDevices: MediaDevices | undefined
	let originalMediaRecorder: typeof MediaRecorder | undefined

	beforeEach(() => {
		mockExtensionState = {
			voiceSttEnabled: true,
			voiceInputDeviceId: "",
		}

		originalMediaDevices = navigator.mediaDevices
		originalMediaRecorder = globalThis.MediaRecorder

		class MockMediaRecorder {
			state: RecordingState = "inactive"
			mimeType = "audio/webm"
			ondataavailable: ((event: BlobEvent) => void) | null = null
			onstop: (() => void) | null = null

			constructor(_stream: MediaStream) {}

			start() {
				this.state = "recording"
			}

			stop() {
				this.state = "inactive"
				this.onstop?.()
			}
		}

		Object.defineProperty(globalThis, "MediaRecorder", {
			value: MockMediaRecorder,
			configurable: true,
		})
	})

	afterEach(() => {
		Object.defineProperty(navigator, "mediaDevices", {
			value: originalMediaDevices,
			configurable: true,
		})

		Object.defineProperty(globalThis, "MediaRecorder", {
			value: originalMediaRecorder,
			configurable: true,
		})
	})

	it("uses selected input device when available", async () => {
		mockExtensionState = {
			voiceSttEnabled: true,
			voiceInputDeviceId: "mic-1",
		}

		const stream = { getTracks: () => [] } as unknown as MediaStream
		const getUserMedia = vi.fn().mockResolvedValue(stream)
		Object.defineProperty(navigator, "mediaDevices", {
			value: { getUserMedia },
			configurable: true,
		})

		render(<VoiceRecorder onTranscription={vi.fn()} />)
		fireEvent.mouseDown(screen.getByRole("button"))

		await waitFor(() => {
			expect(getUserMedia).toHaveBeenCalledWith({
				audio: { deviceId: { exact: "mic-1" } },
				video: false,
			})
		})
	})

	it("falls back to default input when selected device is unavailable", async () => {
		mockExtensionState = {
			voiceSttEnabled: true,
			voiceInputDeviceId: "missing-mic",
		}

		const stream = { getTracks: () => [] } as unknown as MediaStream
		const getUserMedia = vi.fn().mockRejectedValueOnce(new Error("NotFoundError")).mockResolvedValueOnce(stream)

		Object.defineProperty(navigator, "mediaDevices", {
			value: { getUserMedia },
			configurable: true,
		})

		render(<VoiceRecorder onTranscription={vi.fn()} />)
		fireEvent.mouseDown(screen.getByRole("button"))

		await waitFor(() => {
			expect(getUserMedia).toHaveBeenNthCalledWith(1, {
				audio: { deviceId: { exact: "missing-mic" } },
				video: false,
			})
			expect(getUserMedia).toHaveBeenNthCalledWith(2, { audio: true, video: false })
		})
	})

	it("uses default input when no device is selected", async () => {
		mockExtensionState = {
			voiceSttEnabled: true,
			voiceInputDeviceId: "",
		}

		const stream = { getTracks: () => [] } as unknown as MediaStream
		const getUserMedia = vi.fn().mockResolvedValue(stream)
		Object.defineProperty(navigator, "mediaDevices", {
			value: { getUserMedia },
			configurable: true,
		})

		render(<VoiceRecorder onTranscription={vi.fn()} />)
		fireEvent.mouseDown(screen.getByRole("button"))

		await waitFor(() => {
			expect(getUserMedia).toHaveBeenCalledTimes(1)
			expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false })
		})
	})
})
