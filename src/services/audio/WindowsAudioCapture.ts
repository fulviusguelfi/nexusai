/**
 * Windows Audio Capture using FFmpeg
 * Captures raw audio from the default microphone at 16kHz, 16-bit PCM
 * No VS Code / Electron dependency - works in CLI and standalone
 */

import { ChildProcess, spawn } from "child_process"
import { Logger } from "@/shared/services/Logger"

// Get FFmpeg path from npm package or use system install
let ffmpegPath: string
try {
	ffmpegPath = require("@ffmpeg-installer/ffmpeg").path
} catch {
	ffmpegPath = "ffmpeg"
}

export interface AudioCaptureOptions {
	duration?: number // Duration in seconds (undefined = stream until stopped)
	sampleRate?: number // Default 16000 Hz
	channels?: number // Default 1 (mono)
	deviceId?: string // Windows audio device name (default: first available)
	onChunk?: (chunk: Buffer) => void // Called for each audio chunk
	onError?: (error: Error) => void
}

/**
 * Enumerate available audio devices on Windows (for debugging)
 * Parses FFmpeg dshow output to extract AUDIO devices only
 */
export async function enumerateWindowsAudioDevices(): Promise<string[]> {
	return new Promise((resolve) => {
		const proc = spawn(ffmpegPath, ["-f", "dshow", "-list_devices", "true", "-i", "dummy"], {
			stdio: ["ignore", "pipe", "pipe"],
		})

		let output = ""
		const devices: string[] = []

		proc.stderr?.on("data", (data: Buffer) => {
			output += data.toString()
		})

		proc.on("close", () => {
			Logger.log("[WindowsAudioCapture] FFmpeg dshow output:")
			Logger.log(output)

			const lines = output.split("\n")
			Logger.log(`[WindowsAudioCapture] Total lines: ${lines.length}`)

			// FFmpeg dshow output format (with [in#0 @ ...] prefix):
			//   [in#0 @ 0000014f0bf487c0] "Device Name" (audio)
			//   [in#0 @ 0000014f0bf487c0]   Alternative name "@device_cm_..."
			// Extract all lines matching: "Device Name" (audio)

			for (const line of lines) {
				if (line.includes("(audio)")) {
					Logger.log(`[WindowsAudioCapture] Found audio line: "${line}"`)
					// Match quoted string followed by (audio), handling the [in#0 @ ...] prefix
					// Regex: .*"([^"]+)"\s*\(audio\)
					const match = line.match(/"([^"]+)"\s*\(audio\)/)
					if (match && match[1]) {
						const deviceId = `audio=${match[1]}`
						Logger.log(`[WindowsAudioCapture] Parsed device: ${deviceId}`)
						devices.push(deviceId)
					}
				}
			}

			Logger.log(`[WindowsAudioCapture] Found ${devices.length} devices total`)
			resolve(devices)
		})
	})
}

export class WindowsAudioCapture {
	private ffmpegProcess: ChildProcess | null = null
	private audioBuffer: Buffer[] = []
	private isRecording = false
	private recordingStartChunkIndex = 0 // Chunks before this index are warmup (excluded from output)
	private preRollData: Buffer[] = [] // Pre-roll chunks prepended when speech is detected

	/**
	 * Start capturing audio from microphone using FFmpeg
	 * Returns a Promise that resolves when recording completes (if duration set)
	 * or rejects on error
	 */
	async startCapture(options: AudioCaptureOptions = {}): Promise<void> {
		return new Promise(async (resolve, reject) => {
			try {
				const sampleRate = options.sampleRate || 16000
				const channels = options.channels || 1
				const duration = options.duration

				// Get device name: use provided option, or enumerate and use first available
				let deviceName = options.deviceId
				if (!deviceName) {
					// Auto-detect first available audio device on Windows
					const devices = await enumerateWindowsAudioDevices()
					if (devices.length > 0) {
						deviceName = devices[0]
						Logger.log("[WindowsAudioCapture] Auto-detected device:", deviceName)
					} else {
						throw new Error("No audio devices found")
					}
				}

				// Remove quotes if present
				deviceName = deviceName.replace(/^"|"$/g, "")

				// Ensure it has 'audio=' prefix for FFmpeg dshow
				if (!deviceName.startsWith("audio=")) {
					deviceName = `audio=${deviceName}`
				}

				// Don't wrap in quotes - spawn() passes array elements directly as args, not through shell
				const audioDeviceArg = deviceName

				Logger.log("[WindowsAudioCapture] Using device argument:", audioDeviceArg)

				const ffmpegArgs = [
					"-f",
					"dshow",
					"-i",
					audioDeviceArg,
					"-acodec",
					"pcm_s16le",
					"-ar",
					sampleRate.toString(),
					"-ac",
					channels.toString(),
					"-f",
					"s16le",
				]

				if (duration) {
					ffmpegArgs.push("-t", duration.toString())
				}

				ffmpegArgs.push("pipe:1")

				// Log the exact FFmpeg command for debugging
				Logger.log("[FFmpeg] Command:", ffmpegPath, ffmpegArgs.join(" "))

				this.ffmpegProcess = spawn(ffmpegPath, ffmpegArgs, {
					stdio: ["ignore", "pipe", "pipe"],
				})

				this.isRecording = true
				this.audioBuffer = []

				// Handle audio data
				this.ffmpegProcess.stdout?.on("data", (chunk: Buffer) => {
					this.audioBuffer.push(chunk)
					options.onChunk?.(chunk)
				})

				// Capture FFmpeg stderr for debugging
				this.ffmpegProcess.stderr?.on("data", (data: Buffer) => {
					const msg = data.toString()
					// Log FFmpeg errors and important messages
					if (msg.includes("error") || msg.includes("Error") || msg.includes("Cannot")) {
						Logger.warn("[WindowsAudioCapture] FFmpeg stderr:", msg.trim())
					}
				})

				// Handle process exit
				this.ffmpegProcess.on("exit", (code: number | null) => {
					this.isRecording = false
					Logger.log("[WindowsAudioCapture] FFmpeg exited with code:", code)
					// Accept normal exit or signals (0, 255, -2, -5, 130)
					// -5 often means SIGTERM on Windows in different encoding
					if (code === 0 || code === 255 || code === -2 || code === -5 || code === 130) {
						resolve()
					} else if (code && code < -10) {
						// Likely a signal code converted to negative
						resolve()
					} else if (this.audioBuffer.length > 0) {
						// If we got audio data, consider it success despite exit code
						const totalBytes = this.audioBuffer.reduce((sum, b) => sum + b.length, 0)
						Logger.warn(
							`[FFmpeg] Exit code ${code}, but captured ${this.audioBuffer.length} chunks (${totalBytes} bytes total)`,
						)
						resolve()
					} else {
						reject(new Error(`FFmpeg exited with code ${code}`))
					}
				})

				this.ffmpegProcess.on("error", (err: Error) => {
					this.isRecording = false
					options.onError?.(err)
					reject(err)
				})
			} catch (error) {
				reject(new Error(`Failed to start FFmpeg: ${error instanceof Error ? error.message : String(error)}`))
			}
		})
	}

	/**
	 * Mark where real recording starts (after warmup chunks are discarded).
	 * Chunks before this index will be excluded from stopCapture() output.
	 */
	markRecordingStart(): void {
		this.recordingStartChunkIndex = this.audioBuffer.length
		Logger.log(`[WindowsAudioCapture] Recording start marked at chunk index ${this.recordingStartChunkIndex}`)
	}

	/**
	 * Prepend pre-roll audio (captured just before speech detection) to the recording.
	 * Called when speech is first detected so the leading syllables aren't lost.
	 */
	prependToBuffer(data: Buffer): void {
		this.preRollData.push(data)
		Logger.log(`[WindowsAudioCapture] Pre-roll stored: ${data.length} bytes`)
	}

	/**
	 * Stop recording and return captured audio.
	 * Output = preRollData + audioBuffer[recordingStartChunkIndex:]
	 * (warmup chunks before recordingStartChunkIndex are excluded)
	 */
	stopCapture(): Buffer {
		if (this.ffmpegProcess) {
			this.ffmpegProcess.kill()
			this.ffmpegProcess = null
		}
		this.isRecording = false

		const recordingChunks = this.audioBuffer.slice(this.recordingStartChunkIndex)
		const allChunks = [...this.preRollData, ...recordingChunks]
		const totalBytes = allChunks.reduce((sum, b) => sum + b.length, 0)
		Logger.log(
			`[WindowsAudioCapture] stopCapture: preroll=${this.preRollData.length} chunks, recording=${recordingChunks.length} chunks, total=${totalBytes} bytes`,
		)
		return Buffer.concat(allChunks)
	}

	/**
	 * Get current recording status
	 */
	isCapturing(): boolean {
		return this.isRecording
	}

	/**
	 * Convert raw PCM audio (Int16LE) to Float32 array for Web Audio API compatibility
	 * (useful when sharing audio data between CLI and webview)
	 */
	static pcmToFloat32(buffer: Buffer): Float32Array {
		const float32 = new Float32Array(buffer.length / 2)
		for (let i = 0; i < float32.length; i++) {
			const int16 = buffer.readInt16LE(i * 2)
			float32[i] = int16 / 32768 // Normalize to -1..1
		}
		return float32
	}

	/**
	 * Convert Float32 array back to Int16LE PCM buffer
	 * (reverse operation for interoperability)
	 */
	static float32ToPcm(float32: Float32Array): Buffer {
		const buffer = Buffer.alloc(float32.length * 2)
		for (let i = 0; i < float32.length; i++) {
			const clamped = Math.max(-1, Math.min(1, float32[i]))
			const int16 = clamped < 0 ? clamped * 32768 : clamped * 32767
			buffer.writeInt16LE(Math.floor(int16), i * 2)
		}
		return buffer
	}
}
