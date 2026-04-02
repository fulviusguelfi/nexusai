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
	const audioRef = useRef<HTMLAudioElement | undefined>(undefined)
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
				if (audioRef.current) {
					audioRef.current.onplay = null
					audioRef.current.onended = null
					audioRef.current = undefined
				}

				if (!phonemeTimeline || phonemeTimeline.length === 0 || !wavBase64) {
					voiceLogStore.warn("useAvatarState", "Missing phoneme timeline or WAV data")
					setCurrentViseme("X")
					return
				}

				// Create muted timing reference audio element
				try {
					const bytes = Uint8Array.from(atob(wavBase64), (c) => c.charCodeAt(0))
					const blob = new Blob([bytes], { type: "audio/wav" })
					const url = URL.createObjectURL(blob)
					const audio = new Audio(url)
					audio.muted = true // timing reference only — host plays the real audio
					audioRef.current = audio
					lipSyncRef.current = new LipSyncController(phonemeTimeline)

					const tick = () => {
						if (!audioRef.current || !lipSyncRef.current) return
						const viseme = lipSyncRef.current.getVisemeAt(audioRef.current.currentTime)
						setCurrentViseme(viseme)
						rafRef.current = requestAnimationFrame(tick)
					}

					audio.onplay = () => {
						rafRef.current = requestAnimationFrame(tick)
					}

					audio.onended = () => {
						if (rafRef.current !== undefined) {
							cancelAnimationFrame(rafRef.current)
							rafRef.current = undefined
						}
						setCurrentViseme("X")
						URL.revokeObjectURL(url)
					}

					void audio.play().catch(() => {
						// Muted audio play might be blocked in some environments — visemes stay at X
						setCurrentViseme("X")
					})
				} catch {
					setCurrentViseme("X")
				}
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
