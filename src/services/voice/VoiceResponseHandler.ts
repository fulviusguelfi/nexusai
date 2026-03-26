/**
 * Voice Response Handler - Separated STT and TTS Pipelines
 *
 * CORRECT FLOW (User specified):
 * =============================
 *
 * Phase 1: STT Only (Speech-to-Text)
 *   - User speaks audio
 *   - Whisper transcribes to text (original language)
 *   - Language detected from transcribed text
 *   - Text displayed in message box
 *   - User presses SEND button
 *
 * Phase 2: LLM Processing
 *   - Message sent to LLM with language context
 *   - LLM responds in same language
 *
 * Phase 3: TTS Only (Text-to-Speech)
 *   - LLM response text synthesized to audio
 *   - Audio played via speakers
 *
 * IMPORTANT: TTS should NEVER happen on original transcription!
 * TTS only happens on LLM RESPONSE after user presses send.
 *
 * This class provides:
 * 1. processSpeechToText() - STT only, return transcription + language
 * 2. processTextToSpeech() - TTS only, synthesize text to audio
 */

import { Logger } from "@/shared/services/Logger"
import { WhisperService } from "./WhisperService"

export interface VoiceTranscription {
	text: string
	duration: number // ms
	confidence: number // 0-1
	language: string
}

export interface VoiceAudio {
	data: Buffer // WAV format
	duration: number // ms
	sampleRate: number
	channels: number
}

export interface VoiceResponseResult {
	transcription: VoiceTranscription
	audio: VoiceAudio
	totalDuration: number // ms
	detectedLanguage?: string // IETF language tag (e.g., "pt", "pt-BR", "en-US")
	error?: Error
}

export class VoiceResponseHandler {
	/**
	 * PHASE 1: Speech-to-Text ONLY
	 *
	 * Converts audio → transcribed text + language detection
	 * This is called immediately after user stops speaking.
	 * Text is displayed in message box.
	 *
	 * Usage:
	 *   const result = await VoiceResponseHandler.processSpeechToText(audioBuffer)
	 *   console.log(result.transcription.text) // "Eu sou do Brasil" (original language)
	 *   console.log(result.detectedLanguage) // "pt-BR"
	 *   // Show text in message box
	 */
	static async processSpeechToText(
		audioBuffer: Buffer,
		options: {
			globalStoragePath?: string // Required for Whisper model caching
			sttModel?: string // "whisper-tiny" (default), "whisper-small", etc.
			userLanguage?: string // Optional: user's preferred language for Whisper hint
			maxDuration?: number // 30000ms (default)
			onProgress?: (progress: number) => void
		} = {},
	): Promise<{ transcription: VoiceTranscription; detectedLanguage: string; error?: Error }> {
		const startTime = Date.now()
		Logger.log(`📝 Stage 1: Speech-to-Text (${options.sttModel || "whisper-tiny"})`)

		try {
			options.onProgress?.(0)

			const transcription = await VoiceResponseHandler.runSpeechToText(
				audioBuffer,
				options.sttModel,
				options.globalStoragePath,
				options.userLanguage,
			)

			Logger.log(`✅ Transcribed: "${transcription.text}" [${transcription.language}] (${transcription.duration}ms)`)
			Logger.log(`📍 Detected language: ${transcription.language}`)
			options.onProgress?.(100)

			const duration = Date.now() - startTime
			return {
				transcription,
				detectedLanguage: transcription.language,
			}
		} catch (error) {
			const duration = Date.now() - startTime
			Logger.error(`❌ STT failed: ${error}`)
			return {
				transcription: { text: "", duration: 0, confidence: 0, language: "unknown" },
				detectedLanguage: "unknown",
				error: error as Error,
			}
		}
	}

	/**
	 * PHASE 3: Text-to-Speech ONLY
	 *
	 * Converts text → audio synthesis
	 * This is called ONLY after LLM responds and user approves.
	 *
	 * Usage:
	 *   const result = await VoiceResponseHandler.processTextToSpeech(llmResponse, { language: "pt-BR" })
	 *   console.log(result.audio.data) // WAV buffer
	 *   playAudio(result.audio.data)
	 */
	static async processTextToSpeech(
		text: string,
		options: {
			ttsVoice?: string // "en-US-male" (default), "pt-BR-male", etc.
			language?: string // Language hint for voice selection
			onProgress?: (progress: number) => void
		} = {},
	): Promise<{ audio: VoiceAudio; error?: Error }> {
		const startTime = Date.now()
		Logger.log(`🔊 Stage 3: Text-to-Speech (${options.ttsVoice || "en-US-male"})`)

		try {
			options.onProgress?.(0)

			const audio = await VoiceResponseHandler.runTextToSpeech(text, options.ttsVoice)

			Logger.log(`✅ TTS complete: ${audio.duration}ms audio generated`)
			options.onProgress?.(100)

			return { audio }
		} catch (error) {
			Logger.error(`❌ TTS failed: ${error}`)
			return {
				audio: { data: Buffer.alloc(0), duration: 0, sampleRate: 16000, channels: 1 },
				error: error as Error,
			}
		}
	}

	/**
	 * Legacy method: Full pipeline (STT → TTS)
	 * DEPRECATED: Use processSpeechToText() + processTextToSpeech() separately
	 *
	 * Kept for backward compatibility only.
	 * This should not be used in new code.
	 */
	static async process(
		audioBuffer: Buffer,
		options: {
			globalStoragePath?: string
			sttModel?: string
			ttsVoice?: string
			maxDuration?: number
			onProgress?: (stage: "stt" | "tts", progress: number) => void
		} = {},
	): Promise<VoiceResponseResult> {
		const startTime = Date.now()
		Logger.log(`🎤 [DEPRECATED] Starting full voice pipeline (STT → TTS)...`)
		Logger.warn(`[DEPRECATED] Use processSpeechToText() then processTextToSpeech() separately instead`)

		try {
			// Do STT
			Logger.log(`📝 Stage 1/2: Speech-to-Text (${options.sttModel || "whisper-tiny"})`)
			options.onProgress?.("stt", 0)

			const transcription = await VoiceResponseHandler.runSpeechToText(
				audioBuffer,
				options.sttModel,
				options.globalStoragePath,
				// No language hint for deprecated process() method
			)

			Logger.log(`✅ Transcribed: "${transcription.text}" [${transcription.language}]`)
			Logger.log(`📍 Language detected: ${transcription.language} - NO translation applied`)
			options.onProgress?.("stt", 100)

			// Do TTS (THIS IS WRONG - should only happen after LLM response!)
			Logger.log(`🔊 Stage 2/2: Text-to-Speech (${options.ttsVoice || "en-US-male"})`)
			Logger.warn(`⚠️ [WARNING] TTS happening on transcribed text! Should only happen after LLM response!`)
			options.onProgress?.("tts", 0)

			const audio = await VoiceResponseHandler.runTextToSpeech(transcription.text, options.ttsVoice)

			Logger.log(`✅ TTS complete: ${audio.duration}ms audio generated`)
			options.onProgress?.("tts", 100)

			const totalDuration = Date.now() - startTime
			const result: VoiceResponseResult = {
				transcription,
				audio,
				totalDuration,
				detectedLanguage: transcription.language,
			}

			return result
		} catch (error) {
			Logger.error(`❌ Voice pipeline failed: ${error}`)
			return {
				transcription: { text: "", duration: 0, confidence: 0, language: "unknown" },
				audio: { data: Buffer.alloc(0), duration: 0, sampleRate: 16000, channels: 1 },
				totalDuration: Date.now() - startTime,
				detectedLanguage: "unknown",
				error: error as Error,
			}
		}
	}

	/**
	 * Stage 1: Speech-to-Text using Whisper
	 * Converts audio buffer → transcribed text + detected language
	 */
	private static async runSpeechToText(
		audioBuffer: Buffer,
		model = "whisper-tiny",
		globalStoragePath?: string,
		languageHint?: string, // Optional: hint to Whisper (e.g., "pt" for Portuguese)
	): Promise<VoiceTranscription> {
		const startTime = Date.now()

		if (!globalStoragePath) {
			throw new Error("VoiceResponseHandler: globalStoragePath is required for Whisper")
		}

		// Convert PCM Buffer (16-bit LE) to Float32Array for Whisper
		const float32Audio = VoiceResponseHandler.bufferToFloat32(audioBuffer)

		// Initialize Whisper service and transcribe with auto language detection
		const whisper = WhisperService.getInstance(globalStoragePath)

		Logger.log(`🎙️ Transcribing ${audioBuffer.length} bytes with ${model}... (detecting language)`)
		if (languageHint) {
			Logger.log(`🎯 Language hint provided: ${languageHint}`)
		}

		const { text, language } = await whisper.transcribeWithLanguageDetection(float32Audio, 16000, languageHint)

		const duration = Date.now() - startTime
		Logger.log(`✅ Transcribed: "${text}" [${language}] (${duration}ms)`)

		return {
			text,
			duration,
			confidence: 0.98, // Whisper default confidence
			language,
		}
	}

	/**
	 * Convert PCM 16-bit LE Buffer to Float32Array (normalized to [-1, 1])
	 */
	private static bufferToFloat32(buffer: Buffer): Float32Array {
		const float32 = new Float32Array(buffer.length / 2)
		for (let i = 0; i < float32.length; i++) {
			const int16 = buffer.readInt16LE(i * 2)
			float32[i] = int16 / 32768 // Normalize to [-1, 1]
		}
		return float32
	}

	/**
	 * Stage 3: Text-to-Speech using Piper
	 * Converts transcribed text → audio buffer in original language (no translation)
	 */
	private static async runTextToSpeech(text: string, voice = "en-US-male"): Promise<VoiceAudio> {
		const startTime = Date.now()

		// TODO: Integrate with Piper service
		// This is a placeholder - actual implementation will:
		// 1. Call Piper TTS model
		// 2. Pass text + voice selection (text is in original language, not translated)
		// 3. Return WAV audio buffer

		Logger.log(`[PLACEHOLDER] TTS: Would synthesize "${text.substring(0, 30)}..." with ${voice}`)

		// Simulate TTS latency (300-500ms typical)
		await new Promise((resolve) => setTimeout(resolve, 400))

		// Return empty WAV buffer for now
		const emptyWav = Buffer.alloc(44) // Minimal WAV header

		return {
			data: emptyWav,
			duration: Date.now() - startTime,
			sampleRate: 22050,
			channels: 1,
		}
	}

	/**
	 * Estimate total pipeline duration (STT + TTS only, no LLM)
	 */
	static estimateDuration(transcribedTextLength: number): {
		stt: number
		tts: number
		total: number
	} {
		// Rough estimates:
		// STT: 400ms (+ 100ms per 10 seconds of audio)
		// TTS: 50ms per second of output (~150 chars per second typical)

		const stt = 400
		const ttsSeconds = transcribedTextLength / 150 // ~150 chars per second typical
		const tts = ttsSeconds * 1000

		return {
			stt,
			tts,
			total: stt + tts,
		}
	}
}
