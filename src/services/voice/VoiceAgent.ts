/**
 * Voice Agent - Main Orchestrator
 * Coordinates the entire voice pipeline: capture → STT → LLM → TTS
 * Features: State machine, timeout handling, error recovery, detailed logging
 */

import { Logger } from "@/shared/services/Logger"
import { WindowsAudioCapture } from "../audio/WindowsAudioCapture"
import { SilenceDetector } from "./SilenceDetector"
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
	maxDuration?: number // Max recording time in milliseconds (default: 30000)
	silenceThreshold?: number // RMS threshold for silence (default: 0.01)
	silenceDurationMs?: number // Duration of silence to detect (milliseconds, default: 700)
	stateCallback?: (state: VoiceAgentState, context?: string) => void
	errorCallback?: (error: VoiceError) => void
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
	private options: Required<VoiceAgentOptions>

	// State callbacks
	private stateCallback: (state: VoiceAgentState, context?: string) => void
	private errorCallback: (error: VoiceError) => void

	constructor(options: VoiceAgentOptions = {}) {
		this.options = {
			maxDuration: options.maxDuration || 30000,
			silenceThreshold: options.silenceThreshold || 0.01,
			silenceDurationMs: options.silenceDurationMs || 700,
			stateCallback: options.stateCallback || (() => {}),
			errorCallback: options.errorCallback || (() => {}),
		}

		this.stateCallback = this.options.stateCallback
		this.errorCallback = this.options.errorCallback

		Logger.log("[VoiceAgent] Initialized with config:", {
			maxDuration: this.options.maxDuration,
			silenceThreshold: this.options.silenceThreshold,
			silenceDurationMs: this.options.silenceDurationMs,
		})

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

			// Step 3: Validate audio quality
			const quality = SilenceDetector.analyze(audioBuffer, this.options.silenceThreshold)
			Logger.log(`[VoiceAgent] Audio quality: ${SilenceDetector.getDescription(quality)}`)

			if (quality.isSilence) {
				throw new Error("SILENCE_DETECTED")
			}

			// Step 4: Transition to processing
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
			// Check if device is available and store it
			const device = await VoiceDeviceManager.getActiveDevice()
			Logger.log(`[VoiceAgent] Using device: ${device.name}`)

			// Store the full device string (e.g., "audio=Microphone")
			this.activeDevice = device

			this.audioCapture = new WindowsAudioCapture()
			this.abortController = new AbortController()

			this.setState(VoiceAgentState.INITIALIZING, `Ready on: ${device.name}`)
		} catch (error) {
			if (error instanceof Error && error.message === "NO_DEVICES") {
				throw new Error("NO_DEVICES")
			}
			throw error
		}
	}

	/**
	 * Capture audio from microphone with real-time silence detection.
	 *
	 * Pipeline:
	 *   1. Warmup: discard first chunk (dshow instability on Windows)
	 *   2. READY_TO_LISTEN: signal UI when FFmpeg is stable
	 *   3. Pre-roll ring buffer: keep last N chunks before speech onset
	 *   4. Speech detection: inject pre-roll + start recording
	 *   5. Silence detection: stop after silence threshold (with grace period)
	 *   6. Idle timeout: auto-cancel if no speech within 10s
	 */
	private async captureAudio(): Promise<Buffer> {
		if (!this.audioCapture) {
			throw new Error("FFMPEG_SPAWN_ERROR")
		}

		this.setState(VoiceAgentState.RECORDING, "Initializing microphone...")

		return new Promise((resolve, reject) => {
			const captureStart = Date.now()
			const tsc = () => `[T+${Date.now() - captureStart}ms]`

			// === Timing & accumulation ===
			let totalRecordedMs = 0
			let chunkIndex = 0

			// === Silence detection ===
			let silenceDurationAccumulated = 0
			let hasDetectedSpeech = false

			// === Warmup: discard first chunk (dshow init instability) ===
			let isWarmupComplete = false
			let warmupChunksDiscarded = 0
			const WARMUP_CHUNKS = 1

			// === Pre-roll ring buffer (~1.5s before speech onset) ===
			const PREROLL_MAX_CHUNKS = 3
			const preRollBuffer: Buffer[] = []
			let speechStarted = false

			// === Grace period + idle timeout ===
			const GRACE_PERIOD_MS = 2000 // 2s after READY_TO_LISTEN before silence can auto-stop
			const IDLE_TIMEOUT_MS = 10000 // 10s without speech → auto-cancel
			let gracePeriodActive = true
			let gracePeriodTimer: NodeJS.Timeout | null = null
			let idleTimer: NodeJS.Timeout | null = null

			const clearTimers = () => {
				if (gracePeriodTimer) {
					clearTimeout(gracePeriodTimer)
					gracePeriodTimer = null
				}
				if (idleTimer) {
					clearTimeout(idleTimer)
					idleTimer = null
				}
			}

			const timeoutId = setTimeout(() => {
				Logger.warn(`${tsc()} [VoiceAgent] Max duration reached, stopping capture`)
				clearTimers()
				if (this.audioCapture) {
					this.audioCapture.stopCapture()
				}
				this.setState(VoiceAgentState.ERROR, "Recording exceeded max duration")
				reject(new Error("CAPTURE_TIMEOUT"))
			}, this.options.maxDuration)

			// Handle abort signal (user-initiated stop)
			this.abortController?.signal.addEventListener("abort", () => {
				clearTimeout(timeoutId)
				clearTimers()
				this.audioCapture?.stopCapture()
				reject(new Error("Recording cancelled"))
			})

			try {
				if (!this.audioCapture) {
					clearTimeout(timeoutId)
					reject(new Error("FFMPEG_SPAWN_ERROR"))
					return
				}
				const capture = this.audioCapture
				capture
					.startCapture({
						duration: this.options.maxDuration / 1000,
						sampleRate: 16000,
						channels: 1,
						deviceId: this.activeDevice?.name,
						onChunk: (chunk: Buffer) => {
							chunkIndex++
							// Real chunk duration calculated from actual bytes (not a hardcoded estimate)
							const realChunkMs = (chunk.length / 2 / 16000) * 1000

							// === WARMUP: discard first chunk(s) — dshow is unstable at startup ===
							if (!isWarmupComplete) {
								warmupChunksDiscarded++
								Logger.log(
									`${tsc()} [VoiceAgent] Warmup #${warmupChunksDiscarded}: discarded ${chunk.length}B (${realChunkMs.toFixed(0)}ms) — dshow stabilizing`,
								)
								if (warmupChunksDiscarded >= WARMUP_CHUNKS) {
									isWarmupComplete = true
									capture.markRecordingStart()
									this.setState(VoiceAgentState.READY_TO_LISTEN, "Pode falar agora")
									Logger.log(`${tsc()} 🎙️ FFmpeg READY — dshow estabilizado, aguardando fala`)

									// Grace period: give user 2s to start speaking before silence detection
									gracePeriodTimer = setTimeout(() => {
										gracePeriodActive = false
										Logger.log(`${tsc()} [VoiceAgent] Grace period ended — silence detection active`)
									}, GRACE_PERIOD_MS)

									// Idle timeout: auto-cancel if no speech within 10s
									idleTimer = setTimeout(() => {
										if (!hasDetectedSpeech) {
											Logger.log(`${tsc()} [VoiceAgent] Idle timeout — no speech in ${IDLE_TIMEOUT_MS}ms`)
											capture.stopCapture()
											clearTimeout(timeoutId)
											reject(new Error("IDLE_TIMEOUT"))
										}
									}, IDLE_TIMEOUT_MS)
								}
								return // Do not process warmup chunk further
							}

							// === Post-warmup: process audio ===
							totalRecordedMs += realChunkMs
							const quality = SilenceDetector.analyze(chunk, this.options.silenceThreshold)

							Logger.log(
								`${tsc()} [VoiceAgent] Chunk #${chunkIndex} | ${chunk.length}B | ${realChunkMs.toFixed(0)}ms | RMS=${quality.rmsLevel.toFixed(4)} | ${quality.quality} | silent=${quality.isSilence}`,
							)

							// === PRE-ROLL: ring buffer before speech onset ===
							if (!speechStarted) {
								if (!quality.isSilence) {
									speechStarted = true
									hasDetectedSpeech = true
									silenceDurationAccumulated = 0
									if (idleTimer) {
										clearTimeout(idleTimer)
										idleTimer = null
									}

									if (preRollBuffer.length > 0) {
										const preRollData = Buffer.concat(preRollBuffer)
										capture.prependToBuffer(preRollData)
										Logger.log(
											`${tsc()} 🗣️ Speech detected — pre-roll injetado: ${preRollBuffer.length} chunks (${preRollData.length}B)`,
										)
									} else {
										Logger.log(
											`${tsc()} 🗣️ Speech detected — chunk #${chunkIndex}, RMS=${quality.rmsLevel.toFixed(4)}`,
										)
									}
									preRollBuffer.length = 0
								} else {
									// Still waiting for speech — maintain ring buffer
									preRollBuffer.push(chunk)
									if (preRollBuffer.length > PREROLL_MAX_CHUNKS) {
										preRollBuffer.shift()
									}
								}
							}

							// === SILENCE DETECTION (only after speech started) ===
							if (hasDetectedSpeech) {
								if (!quality.isSilence) {
									silenceDurationAccumulated = 0
								} else {
									silenceDurationAccumulated += realChunkMs
									Logger.log(
										`${tsc()} [VoiceAgent] Silence: ${silenceDurationAccumulated.toFixed(0)}ms / ${this.options.silenceDurationMs}ms`,
									)
									if (!gracePeriodActive && silenceDurationAccumulated >= this.options.silenceDurationMs) {
										Logger.log(
											`${tsc()} 🔇 Silence threshold reached — stopping capture (recorded: ${totalRecordedMs.toFixed(0)}ms)`,
										)
										capture.stopCapture()
									}
								}
							}
						},
					})
					.then(() => {
						clearTimeout(timeoutId)
						clearTimers()
						const buffer = this.audioCapture?.stopCapture()
						if (buffer && buffer.length > 0) {
							Logger.log(
								`${tsc()} [VoiceAgent] Capture complete — ${buffer.length} bytes, ~${totalRecordedMs.toFixed(0)}ms recorded`,
							)
							resolve(buffer)
						} else {
							reject(new Error("No audio captured"))
						}
					})
					.catch((error) => {
						clearTimeout(timeoutId)
						clearTimers()
						reject(error)
					})
			} catch (error) {
				clearTimeout(timeoutId)
				clearTimers()
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
	 */
	stop(): void {
		Logger.log("[VoiceAgent] User requested stop, halting capture...")
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
