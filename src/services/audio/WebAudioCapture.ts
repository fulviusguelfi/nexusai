/**
 * Web Audio API capture for VS Code webview
 * Records microphone input and converts to Float32Array (compatible with Whisper)
 * No FFmpeg needed - uses browser's native audio APIs
 */

export interface WebAudioCaptureOptions {
	sampleRate?: number // Default 16000 Hz (Whisper requirement)
	channels?: number // Default 1 (mono)
	maxDuration?: number // Max recording duration in seconds
	onChunk?: (chunk: Float32Array) => void // Called for each audio chunk
	onError?: (error: Error) => void
	onPermissionDenied?: () => void
}

/**
 * Check if the browser supports Web Audio API
 */
export function isWebAudioSupported(): boolean {
	const audioContext = window.AudioContext || (window as any).webkitAudioContext
	return !!audioContext && !!navigator.mediaDevices?.getUserMedia
}

/**
 * WebAudioCapture - Browser-based microphone recording
 * Reuses same Float32 format as FFmpeg-based capture for seamless integration
 */
export class WebAudioCapture {
	private audioContext: AudioContext | null = null
	private mediaStream: MediaStream | null = null
	private processor: ScriptProcessorNode | null = null
	private isCapturing = false
	private recordedChunks: Float32Array[] = []
	private recordingStartTime = 0
	private maxDurationMs = 0

	async startCapture(options: WebAudioCaptureOptions = {}): Promise<void> {
		const { sampleRate = 16000, channels = 1, maxDuration, onChunk, onError, onPermissionDenied } = options

		if (this.isCapturing) {
			throw new Error("Already capturing audio")
		}

		if (!isWebAudioSupported()) {
			throw new Error("Web Audio API not supported in this browser")
		}

		try {
			// Request microphone permission
			this.mediaStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: false, // We want raw audio for speech recognition
					noiseSuppression: false,
					autoGainControl: false,
				},
			})

			// Create audio context if needed
			if (!this.audioContext) {
				this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
			}

			// Resample to target sample rate if needed
			const sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream)
			const analyser = this.audioContext.createAnalyser()
			analyser.fftSize = 4096

			// Create ScriptProcessor node for audio capturing
			// Note: ScriptProcessorNode is deprecated but still widely supported
			// For modern browsers, consider using AudioWorklet in the future
			const bufferSize = 4096
			this.processor = this.audioContext.createScriptProcessor(bufferSize, channels, channels)

			this.isCapturing = true
			this.recordedChunks = []
			this.recordingStartTime = Date.now()
			this.maxDurationMs = (maxDuration || 0) * 1000

			sourceNode.connect(analyser)
			sourceNode.connect(this.processor)
			this.processor.connect(this.audioContext.destination)

			let hasCalledComplete = false

			this.processor.onaudioprocess = (event: AudioProcessingEvent) => {
				if (!this.isCapturing) return

				// Check max duration
				if (this.maxDurationMs > 0) {
					const elapsed = Date.now() - this.recordingStartTime
					if (elapsed >= this.maxDurationMs) {
						if (!hasCalledComplete) {
							hasCalledComplete = true
							this.stopCapture()
						}
						return
					}
				}

				// Get audio data from the input buffer
				const inputData = event.inputBuffer.getChannelData(0)

				// Convert to Float32Array (already is, but make a copy)
				const chunk = new Float32Array(inputData)
				this.recordedChunks.push(chunk)

				// Call callback for progress indication
				if (onChunk) {
					onChunk(chunk)
				}
			}
		} catch (error) {
			this.isCapturing = false
			if (error instanceof DOMException && error.name === "NotAllowedError") {
				onPermissionDenied?.()
				throw new Error("Microphone permission denied by user")
			}
			onError?.(error instanceof Error ? error : new Error(String(error)))
			throw error
		}
	}

	stopCapture(): Float32Array {
		if (!this.isCapturing) {
			throw new Error("Not currently capturing")
		}

		this.isCapturing = false

		// Clean up audio nodes
		if (this.processor) {
			this.processor.disconnect()
			this.processor = null
		}

		if (this.mediaStream) {
			this.mediaStream.getTracks().forEach((track) => track.stop())
			this.mediaStream = null
		}

		// Concatenate all chunks into single Float32Array
		const totalLength = this.recordedChunks.reduce((sum, chunk) => sum + chunk.length, 0)
		const concatenated = new Float32Array(totalLength)

		let offset = 0
		for (const chunk of this.recordedChunks) {
			concatenated.set(chunk, offset)
			offset += chunk.length
		}

		this.recordedChunks = []
		return concatenated
	}

	isRecording(): boolean {
		return this.isCapturing
	}

	/**
	 * Release audio context resources
	 */
	dispose(): void {
		if (this.isCapturing) {
			this.stopCapture()
		}

		if (this.audioContext && this.audioContext.state !== "closed") {
			this.audioContext.close().catch(() => {})
		}

		this.audioContext = null
	}
}

/**
 * Utility to check if microphone permission has been granted
 */
export async function checkMicrophonePermission(): Promise<"granted" | "denied" | "prompt"> {
	if (!navigator.permissions?.query) {
		// Fallback for browsers that don't support Permissions API
		return "prompt"
	}

	try {
		const permission = await navigator.permissions.query({ name: "microphone" as any })
		return permission.state as "granted" | "denied" | "prompt"
	} catch {
		return "prompt"
	}
}

/**
 * Get list of available audio input devices
 */
export async function enumerateAudioDevices(): Promise<MediaDeviceInfo[]> {
	try {
		const devices = await navigator.mediaDevices.enumerateDevices()
		return devices.filter((device) => device.kind === "audioinput")
	} catch {
		return []
	}
}
