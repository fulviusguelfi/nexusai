/**
 * VoiceRecorder - Voice input button with audio level visualization.
 * Receive-only component: Host handles capture & processing.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { PLATFORM_CONFIG } from "@/config/platform.config"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { voiceLogStore } from "@/utils/voiceDebugger"

interface Props {
	onTranscription?: (text: string, language?: string, isPartial?: boolean) => void
	disabled?: boolean
	onLanguageDetected?: (lang: string | null) => void
	onRecordingStarted?: () => void
}

export interface VoiceRecorderHandle {
	/** Stops recording if currently active — used by send button to stop before sending */
	stopIfRecording: () => void
}

const VOICE_AGENT_STATES = {
	IDLE: "IDLE",
	INITIALIZING: "INITIALIZING",
	READY_TO_LISTEN: "READY_TO_LISTEN",
	RECORDING: "RECORDING",
	PROCESSING: "PROCESSING",
	PLAYING: "PLAYING",
	ERROR: "ERROR",
} as const

type VoiceAgentState = (typeof VOICE_AGENT_STATES)[keyof typeof VOICE_AGENT_STATES]

function isVoiceAgentState(value: unknown): value is VoiceAgentState {
	return typeof value === "string" && Object.values(VOICE_AGENT_STATES).includes(value as VoiceAgentState)
}

/**
 * Convert IETF language code to display name
 * E.g., "pt-BR" → "Português (Brasil)", "en-US" → "English (US)"
 */
export function getLanguageName(code: string): string {
	const languageNames: Record<string, string> = {
		// Portuguese
		pt: "Português",
		"pt-BR": "Português (Brasil)",
		"pt-PT": "Português (Portugal)",
		// English
		en: "English",
		"en-US": "English (US)",
		"en-GB": "English (UK)",
		// Spanish
		es: "Español",
		"es-ES": "Español (España)",
		"es-MX": "Español (México)",
		// French
		fr: "Français",
		"fr-FR": "Français (France)",
		// German
		de: "Deutsch",
		"de-DE": "Deutsch (Deutschland)",
		// Italian
		it: "Italiano",
		"it-IT": "Italiano (Italia)",
		// Japanese
		ja: "日本語",
		"ja-JP": "日本語 (Japan)",
		// Chinese
		zh: "中文",
		"zh-CN": "中文 (Simplified)",
		"zh-TW": "中文 (Traditional)",
		// Korean
		ko: "한국어",
		"ko-KR": "한국어 (Korea)",
		// Russian
		ru: "Русский",
		"ru-RU": "Русский (Russia)",
		// Default fallback
	}
	return languageNames[code] || code
}

const VoiceRecorder = forwardRef<VoiceRecorderHandle, Props>(function VoiceRecorder(
	{ onTranscription, disabled, onLanguageDetected, onRecordingStarted },
	ref,
) {
	const { voiceSttEnabled, voiceMaxRecordingDurationMs } = useExtensionState()

	// UI State
	const [agentState, setAgentState] = useState<VoiceAgentState>(VOICE_AGENT_STATES.IDLE)
	const [isUserRecording, setIsUserRecording] = useState(false) // Track user intent (push-to-talk)

	// Recording timer (elapsed seconds)
	const [recordingSeconds, setRecordingSeconds] = useState(0)
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
	const pttKeyHeld = useRef(false)

	// Unlock AudioContext autoplay on mount (must happen inside a user gesture the first time).
	// Chrome/Electron grant "sticky activation" on first gesture, so TTS audio arriving later succeeds.
	useEffect(() => {
		const unlock = () => {
			try {
				const ctx = new AudioContext()
				const buf = ctx.createBuffer(1, 1, 22050)
				const src = ctx.createBufferSource()
				src.buffer = buf
				src.connect(ctx.destination)
				src.start(0)
				src.onended = () => void ctx.close()
			} catch {
				// ignore
			}
		}
		window.addEventListener("click", unlock, { once: true })
		return () => window.removeEventListener("click", unlock)
	}, [])

	// Start/stop elapsed timer
	const startTimer = useCallback(() => {
		setRecordingSeconds(0)
		timerRef.current = setInterval(() => {
			setRecordingSeconds((s) => s + 1)
		}, 1000)
	}, [])

	const stopTimer = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current)
			timerRef.current = null
		}
		setRecordingSeconds(0)
	}, [])

	// Push-to-talk: start recording
	const handleStartRecording = useCallback(() => {
		if (isUserRecording) return
		voiceLogStore.info("VoiceRecorder", "User started recording (push-to-talk press)")
		onRecordingStarted?.()
		setIsUserRecording(true)
		startTimer()
		PLATFORM_CONFIG.postMessage({
			type: "start_voice_recording",
			start_voice_recording: {
				timestamp: Date.now(),
				silenceThresholdMs: 700,
				gracePeriodMs: 2000,
				maxDurationMs: voiceMaxRecordingDurationMs || 120000,
			},
		})
	}, [isUserRecording, onRecordingStarted, voiceMaxRecordingDurationMs, startTimer])

	// Push-to-talk: stop recording
	const handleStopRecording = useCallback(() => {
		voiceLogStore.info("VoiceRecorder", `handleStopRecording called — isUserRecording=${isUserRecording} at T=${Date.now()}`)
		if (!isUserRecording) {
			voiceLogStore.warn("VoiceRecorder", "handleStopRecording: guard fired — isUserRecording is false, aborting")
			return
		}
		voiceLogStore.info("VoiceRecorder", "User stopped recording (push-to-talk release)")
		setIsUserRecording(false)
		stopTimer()
		PLATFORM_CONFIG.postMessage({
			type: "stop_voice_recording",
			stop_voice_recording: {
				timestamp: Date.now(),
			},
		})
		voiceLogStore.info("VoiceRecorder", `stop_voice_recording posted to backend at T=${Date.now()}`)
	}, [isUserRecording, stopTimer])

	// Ref to always-current isUserRecording — ensures stopIfRecording never races against stale closures
	const isUserRecordingRef = useRef(false)
	useEffect(() => {
		isUserRecordingRef.current = isUserRecording
	}, [isUserRecording])

	// Expose stopIfRecording so parent (ChatTextArea send button) can stop recording before sending
	useImperativeHandle(ref, () => ({
		stopIfRecording: () => {
			if (isUserRecordingRef.current) {
				handleStopRecordingRef.current()
			}
		},
	}))

	// Refs to always-current callbacks — lets the keyboard effect avoid re-registering on every recording state change
	const handleStartRecordingRef = useRef(handleStartRecording)
	const handleStopRecordingRef = useRef(handleStopRecording)
	useEffect(() => {
		handleStartRecordingRef.current = handleStartRecording
	}, [handleStartRecording])
	useEffect(() => {
		handleStopRecordingRef.current = handleStopRecording
	}, [handleStopRecording])

	// Keyboard push-to-talk: hold Ctrl+Shift+V to record, release any part of combo to stop
	useEffect(() => {
		if (!voiceSttEnabled) return
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.ctrlKey && e.shiftKey && e.key === "V" && !pttKeyHeld.current) {
				e.preventDefault()
				pttKeyHeld.current = true
				handleStartRecordingRef.current()
			}
		}
		const handleKeyUp = (e: KeyboardEvent) => {
			if (pttKeyHeld.current && (e.key === "V" || e.key === "Control" || e.key === "Shift")) {
				pttKeyHeld.current = false
				handleStopRecordingRef.current()
			}
		}
		window.addEventListener("keydown", handleKeyDown)
		window.addEventListener("keyup", handleKeyUp)
		return () => {
			window.removeEventListener("keydown", handleKeyDown)
			window.removeEventListener("keyup", handleKeyUp)
		}
	}, [voiceSttEnabled])

	// Listen for state changes from extension host
	useEffect(() => {
		const handler = (event: MessageEvent) => {
			const data = event.data

			if (data?.type === "voice_agent_state_changed") {
				const { state } = data.voice_agent_state_changed || {}
				if (isVoiceAgentState(state)) {
					setAgentState(state)
					// When backend reaches IDLE, the recording session has truly ended — reset user intent
					if (state === VOICE_AGENT_STATES.IDLE) {
						setIsUserRecording(false)
						stopTimer()
					}
					// Handle error states from backend (e.g., preflight check failures)
				}
			}

			if (data?.type === "voice_result") {
				const voiceResult = data.voice_result || {}
				const transcriptionText = voiceResult.transcriptionText || voiceResult.text
				const audioWavBase64 = voiceResult.audioWavBase64 || voiceResult.audioBase64
				const errorMessage = voiceResult.errorMessage || voiceResult.error

				// If an IDLE state message is dropped, voice_result is the terminal signal
				// for this recording cycle and must release the mic button UI.
				setAgentState(VOICE_AGENT_STATES.IDLE)

				console.log("[VoiceRecorder] Received voice_result:", {
					transcriptionText,
					hasAudio: !!audioWavBase64,
					error: errorMessage,
				})

				if (errorMessage) {
					console.error("[VoiceRecorder] Error from backend:", errorMessage)
					setAgentState(VOICE_AGENT_STATES.ERROR)
					setIsUserRecording(false)
					stopTimer()
				} else if (transcriptionText) {
					const detectedLang = voiceResult.detectedLanguage || null
					console.log("[VoiceRecorder] Transcription received:", transcriptionText, "lang:", detectedLang)
					onTranscription?.(transcriptionText, detectedLang ?? undefined)
					// Notify language badge (auto-clears after 10s if no new result)
					if (detectedLang) {
						onLanguageDetected?.(detectedLang)
						setTimeout(() => onLanguageDetected?.(null), 10000)
					}
					// Play audio response if available
					if (audioWavBase64) {
						void (async () => {
							let url: string | null = null
							try {
								console.log("[VoiceRecorder] Playing audio response...")
								const binaryString = atob(audioWavBase64)
								const bytes = new Uint8Array(binaryString.length)
								for (let i = 0; i < binaryString.length; i++) {
									bytes[i] = binaryString.charCodeAt(i)
								}
								const blob = new Blob([bytes], { type: "audio/wav" })
								url = URL.createObjectURL(blob)
								const audio = new Audio(url)
								await audio.play()
							} catch (err) {
								console.error("[VoiceRecorder] Failed to play audio:", err)
							} finally {
								if (url) URL.revokeObjectURL(url)
							}
						})()
					}
					// Session cleanup is driven by voice_agent_state_changed IDLE — no force-IDLE here
				}
			}

			if (data?.type === "voice_error") {
				const voiceError = data.voice_error || {}
				const errorMsg = voiceError.userMessage || voiceError.message || "Voice error"
				console.error("[VoiceRecorder] Voice error:", errorMsg)
				setAgentState(VOICE_AGENT_STATES.ERROR)
				setIsUserRecording(false)
				stopTimer()
			}
		}

		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [onTranscription, stopTimer])

	// Don't render if voice input is disabled — placed after all hooks to satisfy React rules of hooks
	if (!voiceSttEnabled) {
		return null
	}

	const isError = agentState === VOICE_AGENT_STATES.ERROR
	const isTranscribing = !isUserRecording && agentState === VOICE_AGENT_STATES.PROCESSING
	const isDisabledState = disabled || agentState === VOICE_AGENT_STATES.PLAYING || isTranscribing
	const isActiveRecording =
		isUserRecording &&
		(agentState === VOICE_AGENT_STATES.RECORDING || agentState === VOICE_AGENT_STATES.READY_TO_LISTEN) &&
		recordingSeconds > 0
	const isLoading = isTranscribing

	// Click-toggle: first click starts, second click stops
	const handleToggle = isUserRecording ? handleStopRecording : handleStartRecording

	return (
		<div className="flex items-center gap-2">
			<button
				aria-label={
					isTranscribing
						? "Transcribing audio..."
						: agentState === VOICE_AGENT_STATES.PLAYING
							? "Aguardando fim da fala da IA"
							: isUserRecording
								? "Recording in progress — Click to stop"
								: "Click to record (push-to-talk)"
				}
				className={[
					"codicon p-0 m-0 transition-all text-[14px] w-5 h-5",
					isError
						? "codicon-warning text-error"
						: isActiveRecording
							? "codicon-stop-circle text-red-500"
							: isLoading
								? "codicon-loading animate-spin"
								: "codicon-mic",
					isDisabledState ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
				]
					.filter(Boolean)
					.join(" ")}
				data-active-recording={isActiveRecording}
				disabled={isDisabledState}
				onClick={handleToggle}
				title={
					isTranscribing
						? "Transcribing audio..."
						: isUserRecording
							? "Click to stop recording"
							: "Click to record (push-to-talk)"
				}
			/>
		</div>
	)
})

export default VoiceRecorder
