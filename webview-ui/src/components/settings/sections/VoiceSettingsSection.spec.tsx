import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import VoiceSettingsSection from "./VoiceSettingsSection"

const mockUpdateSetting = vi.fn()
let mockExtensionState: {
	voiceTtsEnabled: boolean
	voiceSttEnabled: boolean
	voiceInputDeviceId: string
	voiceOutputDeviceId: string
	voicePiperVoice: string
}

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: vi.fn(() => mockExtensionState),
}))

vi.mock("../utils/settingsHandlers", () => ({
	updateSetting: (...args: unknown[]) => mockUpdateSetting(...args),
}))

describe("VoiceSettingsSection", () => {
	let originalMediaDevices: MediaDevices | undefined

	beforeEach(() => {
		mockExtensionState = {
			voiceTtsEnabled: true,
			voiceSttEnabled: true,
			voiceInputDeviceId: "",
			voiceOutputDeviceId: "",
			voicePiperVoice: "en_US-lessac-medium",
		}

		originalMediaDevices = navigator.mediaDevices
		Object.defineProperty(navigator, "mediaDevices", {
			value: undefined,
			configurable: true,
		})
	})

	afterEach(() => {
		Object.defineProperty(navigator, "mediaDevices", {
			value: originalMediaDevices,
			configurable: true,
		})
		mockUpdateSetting.mockReset()
	})

	it("renders voice settings without crashing when media devices are unavailable", () => {
		expect(() => render(<VoiceSettingsSection renderSectionHeader={() => null} />)).not.toThrow()
		expect(screen.getByText("Speech-to-Text (Whisper)")).toBeTruthy()
		expect(screen.getByText("Text-to-Speech (Piper)")).toBeTruthy()
	})

	it("renders voice settings when enumerateDevices returns empty device IDs", async () => {
		Object.defineProperty(navigator, "mediaDevices", {
			value: {
				enumerateDevices: vi.fn().mockResolvedValue([
					{ kind: "audioinput", deviceId: "", label: "" },
					{ kind: "audiooutput", deviceId: "", label: "" },
				]),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			},
			configurable: true,
		})

		expect(() => render(<VoiceSettingsSection renderSectionHeader={() => null} />)).not.toThrow()
		await waitFor(() => {
			expect(screen.getByText("Speech-to-Text (Whisper)")).toBeTruthy()
			expect(screen.getByText("Text-to-Speech (Piper)")).toBeTruthy()
		})
	})

	it("falls back to default when previously saved devices/voice are no longer available", async () => {
		mockExtensionState = {
			voiceTtsEnabled: true,
			voiceSttEnabled: true,
			voiceInputDeviceId: "missing-input",
			voiceOutputDeviceId: "missing-output",
			voicePiperVoice: "invalid-voice-id",
		}

		Object.defineProperty(navigator, "mediaDevices", {
			value: {
				enumerateDevices: vi.fn().mockResolvedValue([
					{ kind: "audioinput", deviceId: "input-1", label: "Mic 1" },
					{ kind: "audiooutput", deviceId: "output-1", label: "Speaker 1" },
				]),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			},
			configurable: true,
		})

		render(<VoiceSettingsSection renderSectionHeader={() => null} />)

		await waitFor(() => {
			expect(mockUpdateSetting).toHaveBeenCalledWith("voiceInputDeviceId", "")
			expect(mockUpdateSetting).toHaveBeenCalledWith("voiceOutputDeviceId", "")
			expect(mockUpdateSetting).toHaveBeenCalledWith("voicePiperVoice", "en_US-lessac-medium")
		})
	})
})
