/**
 * VoiceRecorder - Voice input button with audio level visualization.
 * Receive-only component: Host handles capture & processing.
 */
import React, { useCallback, useEffect, useState } from "react"
import { PLATFORM_CONFIG } from "@/config/platform.config"
import { useExtensionState } from "@/context/ExtensionStateContext"

interface Props {
	onTranscription?: (text: string) => void
	disabled?: boolean
}

const VOICE_AGENT_STATES = {
	IDLE: "IDLE",
	INITIALIZING: "INITIALIZING",
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
function getLanguageName(code: string): string {
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

const VoiceRecorder: React.FC<Props> = ({ onTranscription, disabled }) => {
	const { voiceSttEnabled, voiceSilenceThresholdMs } = useExtensionState()

	// UI State
	const [agentState, setAgentState] = useState<VoiceAgentState>(VOICE_AGENT_STATES.IDLE)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const [stateContext, setStateContext] = useState<string>("")
	const [isUserRecording, setIsUserRecording] = useState(false) // Track user intent (push-to-talk)
	const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null) // Language badge

	// Audio level feedback (during RECORDING state)
	const [audioLevel, setAudioLevel] = useState<{
		rmsLevel: number // 0-1 normalized
		dbLevel: number // -40 to 0 dB
		quality: "excellent" | "good" | "poor" | "silent"
		clipping: boolean
	} | null>(null)

	// Don't render if voice input is disabled
	if (!voiceSttEnabled) {
		return null
	}

	// Icon and label for each state
	const getStateDisplay = (): { icon: string; label: string; isActive: boolean } => {
		switch (agentState) {
			case VOICE_AGENT_STATES.IDLE:
				return { icon: "🎤", label: "Voice", isActive: false }
			case VOICE_AGENT_STATES.INITIALIZING:
				return { icon: "⏳", label: "Starting...", isActive: true }
			case VOICE_AGENT_STATES.RECORDING:
				return { icon: "🎙️", label: "Listening...", isActive: true }
			case VOICE_AGENT_STATES.PROCESSING:
				return { icon: "⚙️", label: "Processing...", isActive: true }
			case VOICE_AGENT_STATES.PLAYING:
				return { icon: "🔊", label: "Playing...", isActive: true }
			case VOICE_AGENT_STATES.ERROR:
				return { icon: "❌", label: "Error", isActive: false }
			default:
				return { icon: "🎤", label: "Voice", isActive: false }
		}
	}

	// Handle button click - toggle recording on/off (push-to-talk style)
	const handleToggleRecording = useCallback(async () => {
		if (isUserRecording) {
			// Stop recording
			console.log("[VoiceRecorder] User stopped recording (push-to-talk release)")
			setIsUserRecording(false)
			setStateContext("Processing...")
			PLATFORM_CONFIG.postMessage({
				type: "stop_voice_recording",
				stop_voice_recording: {
					timestamp: Date.now(),
				},
			})
		} else {
			// Start recording
			console.log("[VoiceRecorder] User started recording (push-to-talk press)")
			setErrorMessage(null)
			setStateContext("Listening for audio...")
			setIsUserRecording(true)

			PLATFORM_CONFIG.postMessage({
				type: "start_voice_recording",
				start_voice_recording: {
					timestamp: Date.now(),
					silenceThresholdMs: voiceSilenceThresholdMs || 700,
				},
			})
		}
	}, [isUserRecording, voiceSilenceThresholdMs])

	// Listen for state changes from extension host
	useEffect(() => {
		const handler = (event: MessageEvent) => {
			const data = event.data

			if (data?.type === "voice_agent_state_changed") {
				const { state, context } = data.voice_agent_state_changed || {}
				if (isVoiceAgentState(state)) {
					setAgentState(state)
					setStateContext(context || "")
					setErrorMessage(null)
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
				setDetectedLanguage(data.voice_result.detectedLanguage)
				// Auto-clear after 10 seconds if no new language detected
				setTimeout(() => {
					setDetectedLanguage(null)
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
					setErrorMessage(errorMessage)
					setAgentState(VOICE_AGENT_STATES.ERROR)
					setIsUserRecording(false)
				} else if (transcriptionText) {
					console.log("[VoiceRecorder] Transcription received:", transcriptionText)
					onTranscription?.(transcriptionText)

					// Play audio response if available
					if (audioWavBase64) {
						try {
							console.log("[VoiceRecorder] Playing audio response...")
							const binaryString = atob(audioWavBase64)
							const bytes = new Uint8Array(binaryString.length)
							for (let i = 0; i < binaryString.length; i++) {
								bytes[i] = binaryString.charCodeAt(i)
							}
							const blob = new Blob([bytes], { type: "audio/wav" })
							const url = URL.createObjectURL(blob)
							new Audio(url).play()
						} catch (err) {
							console.error("[VoiceRecorder] Failed to play audio:", err)
						}
					}

					// Return to idle after brief delay
					setTimeout(() => {
						setAgentState(VOICE_AGENT_STATES.IDLE)
						setIsUserRecording(false)
						setStateContext("")
					}, 500)
				}
			}

			if (data?.type === "voice_error") {
				const voiceError = data.voice_error || {}
				const errorMsg = voiceError.userMessage || voiceError.message || "Voice error"
				console.error("[VoiceRecorder] Voice error:", errorMsg)
				setErrorMessage(errorMsg)
				setAgentState(VOICE_AGENT_STATES.ERROR)
				setIsUserRecording(false)
			}
		}

		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [onTranscription])

	const display = getStateDisplay()
	const isLoading = display.isActive || isUserRecording
	const isError = agentState === VOICE_AGENT_STATES.ERROR
	// Button ALWAYS clickable during RECORDING (user controls stop)
	// Disable only in PROCESSING/PLAYING/INITIALIZING or when voice disabled
	const isDisabledState = disabled || (isLoading && agentState !== VOICE_AGENT_STATES.RECORDING)
	const isActiveRecording = isUserRecording && agentState === VOICE_AGENT_STATES.RECORDING

	return (
		<div className="flex items-center gap-2">
			<button
				aria-label={isUserRecording ? "Stop recording (Release)" : "Start recording (Press)"}
				className={[
					"codicon p-0 m-0 transition-all text-[14px] w-5 h-5",
					isError
						? "codicon-warning text-error"
						: isActiveRecording
							? "codicon-stop-circle text-red-500 animate-pulse"
							: isLoading
								? "codicon-loading animate-spin"
								: "codicon-mic",
					isDisabledState && !isActiveRecording
						? "opacity-40 cursor-not-allowed"
						: isActiveRecording
							? "cursor-pointer"
							: "cursor-pointer",
				]
					.filter(Boolean)
					.join(" ")}
				data-active-recording={isActiveRecording}
				disabled={isDisabledState && !isActiveRecording}
				onClick={handleToggleRecording}
				title={isUserRecording ? "Click to stop recording" : "Click to start recording"}
			/>
			{agentState === VOICE_AGENT_STATES.RECORDING && audioLevel && (
				<div className="flex items-center gap-1 text-xs">
					<span className="font-mono min-w-[40px]">{audioLevel.dbLevel.toFixed(1)}dB</span>
					<span className="opacity-70">{audioLevel.quality}</span>
				</div>
			)}
			{detectedLanguage && (
				<div className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-500/10 border border-blue-500/30">
					<span>🌐</span>
					<span className="font-medium text-blue-400">{getLanguageName(detectedLanguage)}</span>
				</div>
			)}
			{stateContext && <span className="text-xs opacity-70">{stateContext}</span>}
			{errorMessage && <span className="text-xs text-red-400">{errorMessage}</span>}
		</div>
	)
}

export default VoiceRecorder
