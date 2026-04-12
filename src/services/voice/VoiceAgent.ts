/**
 * Voice Agent - Main Orchestrator
 * Coordinates the entire voice pipeline: capture → STT → LLM → TTS
 * Features: State machine, timeout handling, error recovery, detailed logging
 */

import { Logger } from "@/shared/services/Logger"
import { AudioCapturePool } from "../audio/AudioCapturePool"
import { WindowsAudioCapture } from "../audio/WindowsAudioCapture"
import { VoiceDeviceManager } from "./VoiceDeviceManager"
import { VoiceError, VoiceErrorMapper } from "./VoiceErrorMapper"

export enum VoiceAgentState {
	IDLE = "IDLE",
	INITIALIZING = "INITIALIZING",
	READY_TO_LISTEN = "READY_TO_LISTEN",
	RECORDING = "RECORDING",
	PROCESSING = "PROCESSING",
	PLAYING = "PLAYING",
	ERROR = "ERROR",
}

export interface VoiceAgentOptions {
	maxDuration?: number // Max recording time in milliseconds (default: 120000)
	/** @deprecated PTT mode — silence detection is no longer used */
	silenceThreshold?: number
	/** @deprecated PTT mode — silence detection is no longer used */
	silenceDurationMs?: number
	/** @deprecated PTT mode — grace period is no longer used */
	gracePeriodMs?: number
	deviceId?: string // Explicit device to use e.g. "audio=Device Name" (default: auto-detect)
	stateCallback?: (state: VoiceAgentState, context?: string) => void
	errorCallback?: (error: VoiceError) => void
	/** Called every ~3 seconds with accumulated raw PCM (16kHz, 16-bit LE, mono) during recording */
	onPartialAudio?: (buffer: Buffer, durationMs: number) => void
	/** Called for every PCM chunk received after speech onset (16kHz, 16-bit LE, mono) */
	onSpeechChunk?: (chunk: Buffer) => void
}

export interface VoiceResponse {
	state: VoiceAgentState
	audioData?: Buffer // WAV format
	text?: string
	duration?: number
	error?: VoiceError
}

export class VoiceAgent {
	private currentState: VoiceAgentState = VoiceAgentState.IDLE
	private audioCapture: WindowsAudioCapture | null = null
	private abortController: AbortController | null = null
	private activeDevice: { name: string; id: string } | null = null
	private options: {
		maxDuration: number
		stateCallback: (state: VoiceAgentState, context?: string) => void
		errorCallback: (error: VoiceError) => void
	}
	private readonly deviceId: string | undefined
	private readonly onPartialAudio: ((buffer: Buffer, durationMs: number) => void) | undefined
	private readonly onSpeechChunk: ((chunk: Buffer) => void) | undefined

	// State callbacks
	private stateCallback: (state: VoiceAgentState, context?: string) => void
	private errorCallback: (error: VoiceError) => void

	constructor(options: VoiceAgentOptions = {}) {
		this.deviceId = options.deviceId || undefined
		this.onPartialAudio = options.onPartialAudio
		this.onSpeechChunk = options.onSpeechChunk
		this.options = {
			maxDuration: options.maxDuration || 120000,
			stateCallback: options.stateCallback || (() => {}),
			errorCallback: options.errorCallback || (() => {}),
		}

		this.stateCallback = this.options.stateCallback
		this.errorCallback = this.options.errorCallback

		Logger.log("[VoiceAgent] Initialized with config:", { maxDuration: this.options.maxDuration })

		this.setState(VoiceAgentState.IDLE, "Ready")
	}

	/**
	 * Main entry point: record voice and return response
	 * Handles the complete flow: initialize → capture → validate → process
	 */
	async recordAndRespond(): Promise<VoiceResponse> {
		const startTime = Date.now()

		try {
			// Step 1: Initialize
			await this.initialize()

			// Step 2: Record audio
			const audioBuffer = await this.captureAudio()

			// Step 3: Transition to processing
			this.setState(VoiceAgentState.PROCESSING, "Converting speech to text...")

			// Note: STT/LLM/TTS would be handled by separate services
			// This is a placeholder for the pipeline
			const duration = Date.now() - startTime

			return {
				state: VoiceAgentState.PROCESSING,
				audioData: audioBuffer,
				duration,
			}
		} catch (error) {
			return this.handleError(error)
		}
	}

	/**
	 * Initialize agent and validate prerequisites
	 */
	private async initialize(): Promise<void> {
		this.setState(VoiceAgentState.INITIALIZING, "Checking audio system...")

		try {
			if (this.deviceId) {
				// Explicit device requested via settings — strip "audio=" prefix to get plain name
				const deviceName = this.deviceId.replace(/^audio=/, "")
				this.activeDevice = { id: "explicit", name: deviceName }
				Logger.log(`[VoiceAgent] Using device from settings: ${deviceName}`)
			} else {
				// Clear cache so hot-plugged devices activated after extension load are detected
				VoiceDeviceManager.clearCache()
				// Auto-select: first available device from VoiceDeviceManager
				const device = await VoiceDeviceManager.getActiveDevice()
				this.activeDevice = device
				Logger.log(`[VoiceAgent] Using default device: ${device.name}`)
			}

			this.audioCapture = new WindowsAudioCapture()
			this.abortController = new AbortController()

			this.setState(VoiceAgentState.INITIALIZING, `Ready on: ${this.activeDevice!.name}`)
		} catch (error) {
			if (error instanceof Error && error.message === "NO_DEVICES") {
				throw new Error("NO_DEVICES")
			}
			throw error
		}
	}

	/**
	 * Capture audio from microphone — push-to-talk mode.
	 *
	 * Fast path (pool): FFmpeg already running → READY_TO_LISTEN is instantaneous.
	 * Fallback path: fresh FFmpeg start with 1-chunk warmup (~500ms).
	 */
	private async captureAudio(): Promise<Buffer> {
		if (!this.audioCapture) {
			throw new Error("FFMPEG_SPAWN_ERROR")
		}

		this.setState(VoiceAgentState.RECORDING, "Initializing microphone...")

		return new Promise((resolve, reject) => {
			const captureStart = Date.now()
			const tsc = () => `[T+${Date.now() - captureStart}ms]`

			let totalRecordedMs = 0
			let chunkIndex = 0

			const timeoutId = setTimeout(() => {
				Logger.warn(`${tsc()} [VoiceAgent] Max duration reached, stopping capture`)
				this.audioCapture?.stopCapture()
				this.setState(VoiceAgentState.ERROR, "Recording exceeded max duration")
				reject(new Error("CAPTURE_TIMEOUT"))
			}, this.options.maxDuration)

			// Handle abort signal (destroy-path — cancel without returning audio)
			this.abortController?.signal.addEventListener("abort", () => {
				clearTimeout(timeoutId)
				this.audioCapture?.stopCapture()
				reject(new Error("Recording cancelled"))
			})

			const onComplete = () => {
				clearTimeout(timeoutId)
				const buffer = this.audioCapture?.stopCapture() ?? Buffer.alloc(0)
				if (buffer.length > 0) {
					Logger.log(
						`${tsc()} [VoiceAgent] Capture complete — ${buffer.length} bytes, ~${totalRecordedMs.toFixed(0)}ms`,
					)
					resolve(buffer)
				} else {
					reject(new Error("No audio captured"))
				}
			}

			const onCaptureError = (error: unknown) => {
				clearTimeout(timeoutId)
				reject(error)
			}

			const deliverChunk = (chunk: Buffer) => {
				chunkIndex++
				const realChunkMs = (chunk.length / 2 / 16000) * 1000
				totalRecordedMs += realChunkMs
				Logger.log(`${tsc()} [VoiceAgent] Chunk #${chunkIndex} | ${chunk.length}B | ${realChunkMs.toFixed(0)}ms`)
				if (this.onSpeechChunk) {
					this.onSpeechChunk(chunk)
				}
			}

			// === Fast path: pool capture already warm — READY_TO_LISTEN instantaneous ===
			const pooled = AudioCapturePool.lease()
			if (pooled) {
				this.audioCapture = pooled.capture // update ref so stop() targets the right process
				pooled.capture.resetBuffer()
				pooled.capture.setChunkCallback(deliverChunk)
				pooled.capture.markRecordingStart()
				this.setState(VoiceAgentState.READY_TO_LISTEN, "Pode falar agora")
				Logger.log(`${tsc()} 🎙️ POOL — READY_TO_LISTEN instantaneous (zero warmup)`)
				pooled.promise.then(onComplete).catch(onCaptureError)
				return
			}

			// === Fallback path: fresh FFmpeg start with 1-chunk warmup ===
			try {
				const capture = this.audioCapture!
				let isWarmupComplete = false
				capture
					.startCapture({
						duration: this.options.maxDuration / 1000,
						sampleRate: 16000,
						channels: 1,
						deviceId: this.activeDevice?.name,
						onChunk: (chunk: Buffer) => {
							chunkIndex++
							const realChunkMs = (chunk.length / 2 / 16000) * 1000

							// Discard first chunk — dshow is unstable at startup
							if (!isWarmupComplete) {
								isWarmupComplete = true
								capture.markRecordingStart()
								this.setState(VoiceAgentState.READY_TO_LISTEN, "Pode falar agora")
								Logger.log(
									`${tsc()} 🎙️ FFmpeg READY — dshow estabilizado (warmup: ${chunk.length}B / ${realChunkMs.toFixed(0)}ms)`,
								)
								return
							}

							// Deliver every post-warmup chunk directly to Vosk
							totalRecordedMs += realChunkMs
							Logger.log(
								`${tsc()} [VoiceAgent] Chunk #${chunkIndex} | ${chunk.length}B | ${realChunkMs.toFixed(0)}ms`,
							)
							if (this.onSpeechChunk) {
								this.onSpeechChunk(chunk)
							}
						},
					})
					.then(onComplete)
					.catch(onCaptureError)
			} catch (error) {
				clearTimeout(timeoutId)
				reject(error)
			}
		})
	}

	/**
	 * Cancel current recording
	 */
	cancel(): void {
		Logger.log("[VoiceAgent] Cancelling recording...")
		this.abortController?.abort()
		this.audioCapture?.stopCapture()
		this.setState(VoiceAgentState.IDLE, "Cancelled")
	}

	/**
	 * Update internal state and notify listeners
	 */
	private setState(newState: VoiceAgentState, context = ""): void {
		if (newState !== this.currentState) {
			Logger.log(`[VoiceAgent] State: ${this.currentState} → ${newState}${context ? ` (${context})` : ""}`)
			this.currentState = newState
			this.stateCallback(newState, context)
		}
	}

	/**
	 * Get current state
	 */
	getState(): VoiceAgentState {
		return this.currentState
	}

	/**
	 * Handle errors and convert to user-friendly messages
	 */
	private handleError(error: unknown): VoiceResponse {
		const voiceError = VoiceErrorMapper.map(error)
		VoiceErrorMapper.logError(voiceError, "VoiceAgent")

		this.setState(VoiceAgentState.ERROR, voiceError.userMessage)
		this.errorCallback(voiceError)

		return {
			state: VoiceAgentState.ERROR,
			error: voiceError,
		}
	}

	/**
	 * Stop recording immediately (user-initiated stop, e.g., push-to-talk release)
	 * @param source - identifies caller for log tracing (e.g. "user-button", "finally", "stopIfRecording")
	 */
	stop(source = "user"): void {
		Logger.log(
			`[VoiceAgent] stop() called [source=${source}] at T=${Date.now()}, audioCapture=${this.audioCapture ? "present" : "null"}`,
		)
		this.audioCapture?.stopCapture()
	}

	/**
	 * Cleanup resources
	 */
	destroy(): void {
		Logger.log("[VoiceAgent] Destroying...")
		this.audioCapture?.stopCapture()
		this.abortController?.abort()
		this.setState(VoiceAgentState.IDLE, "Destroyed")
	}
}
