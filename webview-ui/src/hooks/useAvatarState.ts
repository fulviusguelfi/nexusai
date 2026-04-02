import { useEffect, useRef, useState } from "react"
import type { VoiceAgentState } from "@/components/voice/avatar/AvatarOverlay"
import type { PhonemeTimeline, VisemeLabel } from "@/components/voice/avatar/LipSyncController"
import { LipSyncController } from "@/components/voice/avatar/LipSyncController"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { voiceLogStore } from "@/utils/voiceDebugger"

interface AvatarState {
	agentState: VoiceAgentState
	currentViseme: VisemeLabel
	isVisible: boolean
}

/**
 * useAvatarState
 *
 * Listens to voice-related extension messages and returns the current
 * state for the AvatarOverlay component:
 * - agentState: driven by voice_agent_state_changed messages
 * - currentViseme: driven by phonemeTimeline sync during voice_audio_play
 * - isVisible: true when avatar is enabled and voice (TTS or STT) is active
 */
export function useAvatarState(): AvatarState {
	const { voiceTtsEnabled, voiceSttEnabled, avatarEnabled } = useExtensionState() as {
		voiceTtsEnabled?: boolean
		voiceSttEnabled?: boolean
		avatarEnabled?: boolean
	}

	const [agentState, setAgentState] = useState<VoiceAgentState>("IDLE")
	const [currentViseme, setCurrentViseme] = useState<VisemeLabel>("X")

	const rafRef = useRef<number | undefined>(undefined)
	const lipSyncRef = useRef<LipSyncController | undefined>(undefined)

	const isVisible = Boolean(avatarEnabled !== false && (voiceTtsEnabled || voiceSttEnabled))

	useEffect(() => {
		const handler = (event: MessageEvent) => {
			const { data } = event

			if (data?.type === "voice_agent_state_changed") {
				const state = data.voice_agent_state_changed?.state as VoiceAgentState | undefined
				if (state) {
					voiceLogStore.info("useAvatarState", "Voice agent state changed", { state })
					setAgentState(state)
				}
				return
			}

			if (data?.type === "voice_audio_play") {
				const wavBase64: string | undefined = data.voice_audio_play?.wavBase64
				const phonemeTimeline: PhonemeTimeline | undefined = data.voice_audio_play?.phonemeTimeline

				voiceLogStore.info("useAvatarState", "Received voice_audio_play message", {
					hasWav: !!wavBase64,
					phonemeCount: phonemeTimeline?.length ?? 0,
				})

				// Cleanup previous playback
				if (rafRef.current !== undefined) {
					cancelAnimationFrame(rafRef.current)
					rafRef.current = undefined
				}
				lipSyncRef.current = undefined

				if (!phonemeTimeline || phonemeTimeline.length === 0 || !wavBase64) {
					voiceLogStore.warn("useAvatarState", "Missing phoneme timeline or WAV data")
					setCurrentViseme("X")
					return
				}

				// Use performance.now() for timing instead of a muted Audio element.
				// VS Code webview blocks audio.play() via autoplay policy even for muted
				// elements, which would silently prevent the RAF loop from ever starting.
				lipSyncRef.current = new LipSyncController(phonemeTimeline)
				const durationSeconds = lipSyncRef.current.getDurationSeconds()
				const startMs = performance.now()

				voiceLogStore.info("useAvatarState", "Starting lip sync RAF loop", { durationSeconds })

				const tick = () => {
					if (!lipSyncRef.current) return
					const elapsedSeconds = (performance.now() - startMs) / 1000
					const viseme = lipSyncRef.current.getVisemeAt(elapsedSeconds)
					setCurrentViseme(viseme)
					if (elapsedSeconds < durationSeconds) {
						rafRef.current = requestAnimationFrame(tick)
					} else {
						rafRef.current = undefined
						setCurrentViseme("X")
					}
				}
				rafRef.current = requestAnimationFrame(tick)
			}
		}

		window.addEventListener("message", handler)
		return () => {
			window.removeEventListener("message", handler)
			if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current)
		}
	}, [])

	return { agentState, currentViseme, isVisible }
}
