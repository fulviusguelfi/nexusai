/**
 * Silence Detector for Voice Audio Quality
 * Uses RMS (Root Mean Square) to detect if audio contains actual speech
 * Prevents sending empty/silent audio to Whisper
 */

export interface AudioQuality {
	isSilence: boolean
	rmsLevel: number
	peakLevel: number
	quality: "excellent" | "good" | "poor" | "silent"
	confidence: number // 0-1
}

export class SilenceDetector {
	// RMS threshold: -40dB corresponds to ~0.01 in normalized audio
	private static readonly SILENCE_THRESHOLD_RMS = 0.01

	// Peak threshold to detect clipping
	private static readonly PEAK_THRESHOLD = 0.95

	/**
	 * Calculate minimum speech samples from duration in milliseconds
	 * @param durationMs Duration to wait for silence (milliseconds)
	 * @param sampleRate Sample rate (typically 16000 Hz)
	 * @returns Number of samples
	 */
	static calculateMinSpeechSamples(durationMs: number, sampleRate = 16000): number {
		return Math.floor((durationMs * sampleRate) / 1000)
	}

	/**
	 * Analyze audio buffer for speech content
	 * @param audioBuffer PCM 16-bit or Float32 audio data
	 * @param silenceThresholdRms RMS threshold used to classify silence
	 * @returns Audio quality analysis
	 */
	static analyze(
		audioBuffer: Buffer | Float32Array,
		silenceThresholdRms = SilenceDetector.SILENCE_THRESHOLD_RMS,
	): AudioQuality {
		let float32Audio: Float32Array

		// Convert PCM buffer to Float32 if needed
		if (audioBuffer instanceof Buffer) {
			float32Audio = SilenceDetector.bufferToFloat32(audioBuffer) as Float32Array
		} else {
			float32Audio = audioBuffer as Float32Array
		}

		// Calculate RMS (Root Mean Square) - measures overall loudness
		const rmsLevel = SilenceDetector.calculateRMS(float32Audio)

		// Calculate peak level - maximum amplitude (avoid spread operator with large arrays)
		let peakLevel = 0
		for (let i = 0; i < float32Audio.length; i++) {
			const absValue = Math.abs(float32Audio[i])
			if (absValue > peakLevel) {
				peakLevel = absValue
			}
		}

		// Detect silence based on RMS threshold only
		// (accumulated silence tracking happens in VoiceAgent, not here)
		const isSilence = rmsLevel < silenceThresholdRms

		// Determine quality rating
		let quality: "excellent" | "good" | "poor" | "silent"
		let confidence: number

		if (rmsLevel < 0.002) {
			quality = "silent"
			confidence = 1.0
		} else if (rmsLevel < 0.01) {
			quality = "poor"
			confidence = 0.9
		} else if (rmsLevel < 0.05) {
			quality = "good"
			confidence = 0.8
		} else if (peakLevel <= SilenceDetector.PEAK_THRESHOLD) {
			quality = "excellent"
			confidence = 0.95
		} else {
			// Clipping detected
			quality = "excellent" // Still excellent, but let Whisper handle clipping
			confidence = 0.85
		}

		return {
			isSilence,
			rmsLevel,
			peakLevel,
			quality,
			confidence,
		}
	}

	/**
	 * Calculate RMS level from Float32 audio
	 * RMS = sqrt(sum(sample^2) / count)
	 */
	private static calculateRMS(float32Audio: Float32Array): number {
		if (float32Audio.length === 0) return 0

		let sumSquares = 0
		for (let i = 0; i < float32Audio.length; i++) {
			const sample = float32Audio[i]
			sumSquares += sample * sample
		}

		const meanSquare = sumSquares / float32Audio.length
		return Math.sqrt(meanSquare)
	}

	/**
	 * Convert PCM 16-bit LE buffer to Float32 normalized audio
	 */
	private static bufferToFloat32(buffer: Buffer): Float32Array {
		const float32 = new Float32Array(buffer.length / 2)
		for (let i = 0; i < float32.length; i++) {
			const int16 = buffer.readInt16LE(i * 2)
			float32[i] = int16 / 32768 // Normalize to -1..1
		}
		return float32
	}

	/**
	 * Get human-readable description of quality
	 */
	static getDescription(quality: AudioQuality): string {
		const levelPercent = Math.round(quality.rmsLevel * 100)

		if (quality.isSilence) {
			return `🔇 Silence detected (${levelPercent}% level)`
		}

		switch (quality.quality) {
			case "excellent":
				return `✨ Excellent quality (${levelPercent}% level)`
			case "good":
				return `✅ Good quality (${levelPercent}% level)`
			case "poor":
				return `⚠️ Poor quality - speak louder (${levelPercent}% level)`
			case "silent":
				return `🔇 Silent (${levelPercent}% level)`
			default:
				return `Unknown quality (${levelPercent}% level)`
		}
	}
}
