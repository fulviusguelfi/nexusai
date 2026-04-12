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

const WAVEFORM_BARS = [
	{ id: "bar-l2", scale: 0.4 },
	{ id: "bar-l1", scale: 0.7 },
	{ id: "bar-c", scale: 1.0 },
	{ id: "bar-r1", scale: 0.7 },
	{ id: "bar-r2", scale: 0.4 },
]

const VoiceRecorder = forwardRef<VoiceRecorderHandle, Props>(function VoiceRecorder(
	{ onTranscription, disabled, onLanguageDetected },
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
			window.removeEventListener("click", unlock)
		}
		window.addEventListener("click", unlock, { once: true })
		return () => window.removeEventListener("click", unlock)
	}, [])

	// Audio level feedback (during RECORDING state)
	const [audioLevel, setAudioLevel] = useState<{
		rmsLevel: number // 0-1 normalized
		dbLevel: number // -40 to 0 dB
		quality: "excellent" | "good" | "poor" | "silent"
		clipping: boolean
	} | null>(null)

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
	const handleStartRecording = useCallback(async () => {
		if (isUserRecording) return
		voiceLogStore.info("VoiceRecorder", "User started recording (push-to-talk press)")
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
	}, [isUserRecording, voiceMaxRecordingDurationMs, startTimer])

	// Push-to-talk: stop recording
	const handleStopRecording = useCallback(async () => {
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

			if (data?.type === "voice_stt_partial" && data.voice_stt_partial?.text) {
				const partialText = data.voice_stt_partial.text
				console.log("[VoiceRecorder] Live partial:", partialText)
				// Also write the partial into the input box so words appear as they are spoken
				onTranscription?.(partialText, undefined, true)
			}

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
					if (state !== VOICE_AGENT_STATES.RECORDING) {
						setAudioLevel(null)
					}
				}
			}

			if (data?.type === "voice_audio_level" && data.voice_audio_level) {
				setAudioLevel(data.voice_audio_level)
			}

			// Listen for detected language badge
			if (data?.type === "voice_result" && data.voice_result?.detectedLanguage) {
				const lang = data.voice_result.detectedLanguage
				onLanguageDetected?.(lang)
				// Auto-clear after 10 seconds if no new language detected
				setTimeout(() => {
					onLanguageDetected?.(null)
				}, 10000)
			}

			if (data?.type === "voice_result") {
				const voiceResult = data.voice_result || {}
				const transcriptionText = voiceResult.transcriptionText || voiceResult.text // Try both field names
				const llmResponseText = voiceResult.llmResponseText || voiceResult.response
				const audioWavBase64 = voiceResult.audioWavBase64 || voiceResult.audioBase64
				const errorMessage = voiceResult.errorMessage || voiceResult.error

				console.log("[VoiceRecorder] Received voice_result:", {
					transcriptionText,
					llmResponseText,
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

					// Play audio response if available
					if (audioWavBase64) {
						void (async () => {
							try {
								console.log("[VoiceRecorder] Playing audio response...")
								const binaryString = atob(audioWavBase64)
								const bytes = new Uint8Array(binaryString.length)
								for (let i = 0; i < binaryString.length; i++) {
									bytes[i] = binaryString.charCodeAt(i)
								}
								const blob = new Blob([bytes], { type: "audio/wav" })
								const url = URL.createObjectURL(blob)
								const audio = new Audio(url)
								await audio.play()
							} catch (err) {
								console.error("[VoiceRecorder] Failed to play audio:", err)
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
	// Disable only while TTS is playing; PROCESSING is ~200ms so not worth blocking
	const isDisabledState = disabled || agentState === VOICE_AGENT_STATES.PLAYING
	const isActiveRecording =
		isUserRecording &&
		(agentState === VOICE_AGENT_STATES.RECORDING || agentState === VOICE_AGENT_STATES.READY_TO_LISTEN) &&
		recordingSeconds > 0
	// Spinner only while user is waiting for mic to open (pressed but recording hasn't started yet).
	// Once user clicks stop, show mic immediately — backend PROCESSING is invisible to the user.
	const isLoading = isUserRecording && !isActiveRecording

	// Click-toggle: first click starts, second click stops
	const handleToggle = isUserRecording ? handleStopRecording : handleStartRecording

	return (
		<div className="flex items-center gap-2">
			<button
				aria-label={
					agentState === VOICE_AGENT_STATES.PLAYING
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
							? "codicon-stop-circle text-red-500 animate-pulse"
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
				title={isUserRecording ? "Click to stop recording" : "Click to record (push-to-talk)"}
			/>

			{isActiveRecording && audioLevel && (
				<div className="flex items-end gap-[2px] h-4 mx-1">
					{WAVEFORM_BARS.map(({ id, scale }) => (
						<div
							className="w-[3px] rounded-full bg-red-400 transition-all duration-75"
							key={id}
							style={{
								height: `${Math.max(15, audioLevel.rmsLevel * 100 * scale)}%`,
								opacity: audioLevel.quality === "silent" ? 0.25 : 0.9,
							}}
						/>
					))}
				</div>
			)}
		</div>
	)
})

export default VoiceRecorder
