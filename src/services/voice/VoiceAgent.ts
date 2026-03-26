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
	 * Capture audio from microphone with real-time silence detection
	 */
	private async captureAudio(): Promise<Buffer> {
		if (!this.audioCapture) {
			throw new Error("FFMPEG_SPAWN_ERROR")
		}

		this.setState(VoiceAgentState.RECORDING, "Listening... 🎙️")

		return new Promise((resolve, reject) => {
			let silenceDurationAccumulated = 0 // Track silence in milliseconds
			let hasDetectedSpeech = false // Ensure we detect actual speech before stopping
			const chunkDurationMs = 160 // 16000 Hz, 1 chunk every 160ms (2560 samples)
			let totalRecordedMs = 0

			const timeoutId = setTimeout(() => {
				Logger.warn("[VoiceAgent] Recording timeout, stopping capture")
				if (this.audioCapture) {
					this.audioCapture.stopCapture()
				}
				this.setState(VoiceAgentState.ERROR, "Recording exceeded max duration")
				reject(new Error("CAPTURE_TIMEOUT"))
			}, this.options.maxDuration)

			// Handle abort signal (user-initiated stop)
			this.abortController?.signal.addEventListener("abort", () => {
				clearTimeout(timeoutId)
				this.audioCapture?.stopCapture()
				reject(new Error("Recording cancelled"))
			})

			try {
				// Start recording with real-time silence tracking
				const capture = this.audioCapture!
				capture
					.startCapture({
						duration: this.options.maxDuration / 1000,
						sampleRate: 16000,
						channels: 1,
						deviceId: this.activeDevice?.name,
						// Monitor each audio chunk for silence detection
						onChunk: (chunk: Buffer) => {
							totalRecordedMs += chunkDurationMs

							// Analyze this chunk for silence
							const quality = SilenceDetector.analyze(chunk, this.options.silenceThreshold)

							Logger.log(
								`[VoiceAgent] Chunk: RMS=${quality.rmsLevel.toFixed(4)}, Quality=${quality.quality}, Silent=${quality.isSilence}`,
							)

							// Track speech detection
							if (!quality.isSilence) {
								hasDetectedSpeech = true
								silenceDurationAccumulated = 0 // Reset silence counter on speech
								Logger.log(`[VoiceAgent] Speech detected, silence counter reset`)
							} else {
								// Accumulate silence duration
								silenceDurationAccumulated += chunkDurationMs
								Logger.log(
									`[VoiceAgent] Silence accumulated: ${silenceDurationAccumulated}ms / ${this.options.silenceDurationMs}ms`,
								)

								// Stop recording if we've detected speech AND now have enough silence
								if (hasDetectedSpeech && silenceDurationAccumulated >= this.options.silenceDurationMs) {
									Logger.log(
										`[VoiceAgent] Silence threshold reached (${silenceDurationAccumulated}ms), stopping capture`,
									)
									capture.stopCapture()
									// Don't resolve here - let the close handler below resolve
								}
							}
						},
					})
					.then(() => {
						clearTimeout(timeoutId)
						const buffer = this.audioCapture?.stopCapture()
						if (buffer) {
							Logger.log(`[VoiceAgent] Capture complete, total duration: ${totalRecordedMs}ms`)
							resolve(buffer)
						} else {
							reject(new Error("No audio captured"))
						}
					})
					.catch((error) => {
						clearTimeout(timeoutId)
						reject(error)
					})
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
