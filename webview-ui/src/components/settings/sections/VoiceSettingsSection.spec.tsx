import { trpc } from "@services/trpc-client"
import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import VoiceSettingsSection from "./VoiceSettingsSection"

const mockUpdateSetting = vi.fn()

type MockState = {
	voiceTtsEnabled: boolean
	voiceSttEnabled: boolean
	voiceInputDeviceId: string
	voiceOutputDeviceId: string
	voiceEdgeTtsVoice: string
	voiceMetadataEnabled: boolean
}
let mockExtensionState: MockState

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: vi.fn(() => mockExtensionState),
}))

vi.mock("../utils/settingsHandlers", () => ({
	updateSetting: (...args: unknown[]) => mockUpdateSetting(...args),
}))

vi.mock("@services/trpc-client", () => ({
	trpc: {
		voice: {
			enumerateAudioDevices: {
				query: vi.fn().mockResolvedValue({ inputDevices: [], outputDevices: [], error: null }),
			},
			getEdgeVoices: {
				query: vi.fn().mockResolvedValue([]),
			},
		},
	},
}))

const DEFAULT_STATE: MockState = {
	voiceTtsEnabled: true,
	voiceSttEnabled: true,
	voiceInputDeviceId: "",
	voiceOutputDeviceId: "",
	voiceEdgeTtsVoice: "pt-BR-FranciscaNeural",
	voiceMetadataEnabled: true,
}

describe("VoiceSettingsSection", () => {
	let originalMediaDevices: MediaDevices | undefined

	beforeEach(() => {
		mockExtensionState = { ...DEFAULT_STATE }
		vi.mocked(trpc.voice.enumerateAudioDevices.query).mockResolvedValue({
			inputDevices: [],
			outputDevices: [],
			error: null,
		})
		vi.mocked(trpc.voice.getEdgeVoices.query).mockResolvedValue([])

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

	it("renders voice settings without crashing when media devices are unavailable", async () => {
		expect(() => render(<VoiceSettingsSection renderSectionHeader={() => null} />)).not.toThrow()
		await waitFor(() => {
			expect(screen.getByText("Reconhecimento de Voz (Microfone)")).toBeTruthy()
			expect(screen.getByText("Síntese de Voz")).toBeTruthy()
		})
	})

	it("renders voice settings when host returns empty device lists", async () => {
		Object.defineProperty(navigator, "mediaDevices", {
			value: {
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			},
			configurable: true,
		})

		vi.mocked(trpc.voice.enumerateAudioDevices.query).mockResolvedValue({
			inputDevices: [{ deviceId: "", label: "" }],
			outputDevices: [{ deviceId: "", label: "" }],
			error: null,
		})

		expect(() => render(<VoiceSettingsSection renderSectionHeader={() => null} />)).not.toThrow()
		await waitFor(() => {
			expect(screen.getByText("Reconhecimento de Voz (Microfone)")).toBeTruthy()
			expect(screen.getByText("Síntese de Voz")).toBeTruthy()
		})
	})

	it("falls back to default when previously saved devices/voice are no longer available", async () => {
		mockExtensionState = {
			...DEFAULT_STATE,
			voiceInputDeviceId: "missing-input",
			voiceOutputDeviceId: "missing-output",
		}

		Object.defineProperty(navigator, "mediaDevices", {
			value: {
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			},
			configurable: true,
		})

		vi.mocked(trpc.voice.enumerateAudioDevices.query).mockResolvedValue({
			inputDevices: [{ deviceId: "input-1", label: "Mic 1" }],
			outputDevices: [{ deviceId: "output-1", label: "Speaker 1" }],
			error: null,
		})

		render(<VoiceSettingsSection renderSectionHeader={() => null} />)

		await waitFor(() => {
			expect(mockUpdateSetting).toHaveBeenCalledWith("voiceInputDeviceId", undefined)
			expect(mockUpdateSetting).toHaveBeenCalledWith("voiceOutputDeviceId", "")
		})
	})
})
