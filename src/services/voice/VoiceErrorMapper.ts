/**
 * Voice Service Error Mapper
 * Converts low-level errors into user-friendly messages with diagnostic actions
 */

import { Logger } from "@/shared/services/Logger"

export enum VoiceErrorCode {
	NO_DEVICES = "NO_DEVICES",
	DEVICE_NOT_FOUND = "DEVICE_NOT_FOUND",
	NO_SPEECH_DETECTED = "NO_SPEECH_DETECTED",
	FFMPEG_NOT_FOUND = "FFMPEG_NOT_FOUND",
	FFMPEG_SPAWN_ERROR = "FFMPEG_SPAWN_ERROR",
	CAPTURE_TIMEOUT = "CAPTURE_TIMEOUT",
	IDLE_TIMEOUT = "IDLE_TIMEOUT",
	WHISPER_FAILED = "WHISPER_FAILED",
	LLM_FAILED = "LLM_FAILED",
	PIPER_FAILED = "PIPER_FAILED",
	SILENCE_DETECTED = "SILENCE_DETECTED",
	AUDIO_QUALITY_LOW = "AUDIO_QUALITY_LOW",
	UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export interface VoiceError {
	code: VoiceErrorCode
	message: string
	userMessage: string
	diagnosticAction: string
	originalError?: Error
}

export class VoiceErrorMapper {
	static map(error: unknown): VoiceError {
		const originalError = error instanceof Error ? error : new Error(String(error))

		// Try to categorize by error message
		const message = originalError.message.toLowerCase()

		if (message.includes("no devices") || message.includes("enumeratedevices")) {
			return {
				code: VoiceErrorCode.NO_DEVICES,
				message: originalError.message,
				userMessage: "❌ No microphones found",
				diagnosticAction: "Check Settings → Sound → Input devices. Connect a microphone or enable your built-in mic.",
				originalError,
			}
		}

		if (message.includes("device not found") || message.includes("jabra")) {
			return {
				code: VoiceErrorCode.DEVICE_NOT_FOUND,
				message: originalError.message,
				userMessage: "❌ Selected microphone not found",
				diagnosticAction: "Go to Voice Settings and select an available microphone.",
				originalError,
			}
		}

		if (message.includes("silence") || message.includes("no speech") || message.includes("audio level too low")) {
			return {
				code: VoiceErrorCode.SILENCE_DETECTED,
				message: originalError.message,
				userMessage: "🔇 No speech detected",
				diagnosticAction: "Speak louder or move the microphone closer. Check microphone volume in Settings.",
				originalError,
			}
		}

		if (message.includes("ffmpeg not found") || message.includes("enoent")) {
			return {
				code: VoiceErrorCode.FFMPEG_NOT_FOUND,
				message: originalError.message,
				userMessage: "⚙️ Audio system not ready",
				diagnosticAction: "Run `npm install` to install dependencies. Restart VS Code.",
				originalError,
			}
		}

		if (message.includes("ffmpeg") && message.includes("failed")) {
			return {
				code: VoiceErrorCode.FFMPEG_SPAWN_ERROR,
				message: originalError.message,
				userMessage: "⚙️ Audio capture failed",
				diagnosticAction: "Try restarting VS Code. Check Windows audio drivers are up to date.",
				originalError,
			}
		}

		if (message.includes("idle_timeout")) {
			return {
				code: VoiceErrorCode.IDLE_TIMEOUT,
				message: originalError.message,
				userMessage: "Nenhuma fala detectada. Clique para tentar novamente.",
				diagnosticAction: "Clique no microfone e fale após o indicador verde aparecer.",
				originalError,
			}
		}

		if (message.includes("timeout") || message.includes("exceeded duration")) {
			return {
				code: VoiceErrorCode.CAPTURE_TIMEOUT,
				message: originalError.message,
				userMessage: "⏱️ Recording time exceeded",
				diagnosticAction: "Maximum recording is 30 seconds. Try a shorter message.",
				originalError,
			}
		}

		if (message.includes("whisper")) {
			return {
				code: VoiceErrorCode.WHISPER_FAILED,
				message: originalError.message,
				userMessage: "🤔 Speech-to-text failed",
				diagnosticAction: "Try speaking again with clearer audio. Check internet connection for model updates.",
				originalError,
			}
		}

		if (message.includes("llm failed") || message.includes("api error")) {
			return {
				code: VoiceErrorCode.LLM_FAILED,
				message: originalError.message,
				userMessage: "🧠 AI response failed",
				diagnosticAction: "Check internet connection. Try again in a moment.",
				originalError,
			}
		}

		if (message.includes("piper")) {
			return {
				code: VoiceErrorCode.PIPER_FAILED,
				message: originalError.message,
				userMessage: "🔊 Text-to-speech failed",
				diagnosticAction: "Restart VS Code. Check system audio is working.",
				originalError,
			}
		}

		if (message.includes("quality")) {
			return {
				code: VoiceErrorCode.AUDIO_QUALITY_LOW,
				message: originalError.message,
				userMessage: "📉 Audio quality too low",
				diagnosticAction: "Reduce background noise. Check microphone is not muted.",
				originalError,
			}
		}

		// Default fallback
		return {
			code: VoiceErrorCode.UNKNOWN_ERROR,
			message: originalError.message,
			userMessage: "❌ Voice input error",
			diagnosticAction: "Check microphone permissions in Windows Settings. Restart VS Code if issue persists.",
			originalError,
		}
	}

	static logError(error: VoiceError, context = ""): void {
		const prefix = context ? `[${context}]` : "[VoiceAgent]"
		Logger.error(`${prefix} ${error.code}: ${error.message}`)
		if (error.originalError) {
			Logger.error(`${prefix} Stack:`, error.originalError.stack)
		}
	}
}
