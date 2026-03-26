/**
 * WebAudioCapture — Browser-native audio capture via Web Audio API
 * Captures microphone input and converts to Float32Array format for backend processing
 */

export interface AudioCaptureOptions {
	sampleRate?: number
	maxDuration?: number
	onChunk?: () => void
	onPermissionDenied?: () => void
	onError?: (err: Error) => void
}

export type PermissionState = "granted" | "denied" | "prompt" | "checking"

export interface AudioDevice {
	deviceId: string
	label: string
	kind: "audioinput" | "audiooutput"
}

/**
 * Check current microphone permission state
 */
export async function checkMicrophonePermission(): Promise<PermissionState> {
	if (!navigator.permissions?.query) {
		return "checking"
	}

	try {
		const result = await navigator.permissions.query({ name: "microphone" as PermissionName })
		return (result.state as PermissionState) || "prompt"
	} catch {
		return "prompt"
	}
}

/**
 * Enumerate available audio input and output devices
 */
export async function enumerateAudioDevices(): Promise<AudioDevice[]> {
	if (!navigator.mediaDevices?.enumerateDevices) {
		return []
	}

	try {
		const devices = await navigator.mediaDevices.enumerateDevices()
		return devices
			.filter((d) => d.kind === "audioinput")
			.map((device) => ({
				deviceId: device.deviceId,
				label: device.label || device.deviceId,
				kind: device.kind as "audioinput",
			}))
	} catch (err) {
		console.error("[WebAudioCapture] Failed to enumerate devices:", err)
		return []
	}
}

/**
 * WebAudioCapture — Captures audio from microphone using Web Audio API
 * Resample to target sample rate and convert to Float32Array
 */
export class WebAudioCapture {
	private mediaStream: MediaStream | null = null
	private audioContext: AudioContext | null = null
	private processor: ScriptProcessorNode | null = null
	private isRecording = false
	private audioChunks: Float32Array[] = []
	private sampleRate = 44100
	private targetSampleRate = 16000
	private onChunk?: () => void
	private onPermissionDenied?: () => void
	private onError?: (err: Error) => void

	async startCapture(options: AudioCaptureOptions = {}): Promise<void> {
		if (this.isRecording) {
			throw new Error("Already recording")
		}

		this.onChunk = options.onChunk
		this.onPermissionDenied = options.onPermissionDenied
		this.onError = options.onError
		this.targetSampleRate = options.sampleRate || 16000

		try {
			this.mediaStream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: false,
			})

			// Create audio context
			const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
			this.audioContext = audioContext
			this.sampleRate = audioContext.sampleRate

			// Create script processor for raw audio capture
			const processor = audioContext.createScriptProcessor(4096, 1, 1)
			this.processor = processor

			processor.onaudioprocess = (event: AudioProcessingEvent) => {
				const inputData = event.inputBuffer.getChannelData(0)
				// Clone the data since it will be reused
				const chunk = new Float32Array(inputData.length)
				chunk.set(inputData)
				this.audioChunks.push(chunk)

				this.onChunk?.()
			}

			// Connect microphone to processor
			const source = audioContext.createMediaStreamSource(this.mediaStream)
			source.connect(processor)
			processor.connect(audioContext.destination)

			this.isRecording = true
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err))

			if (err instanceof DOMException && err.name === "NotAllowedError") {
				this.onPermissionDenied?.()
			} else {
				this.onError?.(error)
			}

			this.cleanup()
			throw error
		}
	}

	stopCapture(): Float32Array {
		if (!this.isRecording) {
			return new Float32Array()
		}

		this.isRecording = false

		// Stop audio capture
		if (this.mediaStream) {
			this.mediaStream.getTracks().forEach((track) => track.stop())
			this.mediaStream = null
		}

		if (this.processor && this.audioContext) {
			this.processor.disconnect()
			this.audioContext.close().catch(() => {
				/* ignore */
			})
		}

		// Combine all chunks
		const totalLength = this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0)
		const combined = new Float32Array(totalLength)
		let offset = 0
		for (const chunk of this.audioChunks) {
			combined.set(chunk, offset)
			offset += chunk.length
		}

		// Simple resampling if needed (linear interpolation)
		if (this.sampleRate !== this.targetSampleRate && this.sampleRate > 0) {
			return this.resampleLinear(combined)
		}

		return combined
	}

	private resampleLinear(audioData: Float32Array): Float32Array {
		const ratio = this.sampleRate / this.targetSampleRate
		const newLength = Math.floor(audioData.length / ratio)
		const resampled = new Float32Array(newLength)

		for (let i = 0; i < newLength; i++) {
			const srcIndex = i * ratio
			const srcIndexFloor = Math.floor(srcIndex)
			const srcIndexCeil = Math.min(srcIndexFloor + 1, audioData.length - 1)
			const frac = srcIndex - srcIndexFloor

			resampled[i] = audioData[srcIndexFloor] * (1 - frac) + audioData[srcIndexCeil] * frac
		}

		return resampled
	}

	isRecordingNow(): boolean {
		return this.isRecording
	}

	dispose(): void {
		this.cleanup()
	}

	private cleanup(): void {
		if (this.isRecording) {
			this.isRecording = false
		}

		if (this.mediaStream) {
			this.mediaStream.getTracks().forEach((track) => track.stop())
			this.mediaStream = null
		}

		if (this.processor) {
			this.processor.disconnect()
			this.processor = null
		}

		if (this.audioContext) {
			this.audioContext.close().catch(() => {
				/* ignore */
			})
			this.audioContext = null
		}

		this.audioChunks = []
	}
}
