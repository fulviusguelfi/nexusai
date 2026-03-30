import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock ExtensionStateContext
let mockExtensionState: { voiceTtsEnabled: boolean; voiceSttEnabled: boolean; avatarEnabled: boolean }

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: vi.fn(() => mockExtensionState),
}))

// Import after mock setup
const { useAvatarState } = await import("../useAvatarState")

describe("useAvatarState", () => {
	let messageHandlers: ((event: MessageEvent) => void)[] = []

	beforeEach(() => {
		mockExtensionState = {
			voiceTtsEnabled: true,
			voiceSttEnabled: true,
			avatarEnabled: true,
		}

		messageHandlers = []
		vi.spyOn(window, "addEventListener").mockImplementation((type, handler) => {
			if (type === "message") {
				messageHandlers.push(handler as (event: MessageEvent) => void)
			}
		})
		vi.spyOn(window, "removeEventListener").mockImplementation(() => {})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	const dispatchMessage = (data: unknown) => {
		const event = new MessageEvent("message", { data })
		for (const handler of messageHandlers) {
			handler(event)
		}
	}

	it("initial state: agentState=IDLE, isVisible=false when voice is disabled", () => {
		mockExtensionState = { voiceTtsEnabled: false, voiceSttEnabled: false, avatarEnabled: true }
		const { result } = renderHook(() => useAvatarState())

		expect(result.current.agentState).toBe("IDLE")
		expect(result.current.isVisible).toBe(false)
	})

	it("isVisible=true when voiceTtsEnabled=true", () => {
		mockExtensionState = { voiceTtsEnabled: true, voiceSttEnabled: false, avatarEnabled: true }
		const { result } = renderHook(() => useAvatarState())
		expect(result.current.isVisible).toBe(true)
	})

	it("voice_agent_state_changed message updates agentState", () => {
		const { result } = renderHook(() => useAvatarState())

		act(() => {
			dispatchMessage({ type: "voice_agent_state_changed", voice_agent_state_changed: { state: "RECORDING", context: "" } })
		})

		expect(result.current.agentState).toBe("RECORDING")
	})

	it("avatarEnabled=false → isVisible=false even when voice is active", () => {
		mockExtensionState = { voiceTtsEnabled: true, voiceSttEnabled: true, avatarEnabled: false }
		const { result } = renderHook(() => useAvatarState())
		expect(result.current.isVisible).toBe(false)
	})

	it("voice_audio_play without phonemeTimeline → currentViseme stays X", () => {
		const { result } = renderHook(() => useAvatarState())

		act(() => {
			dispatchMessage({ type: "voice_audio_play", voice_audio_play: { wavBase64: "abc", phonemeTimeline: undefined } })
		})

		expect(result.current.currentViseme).toBe("X")
	})
})
