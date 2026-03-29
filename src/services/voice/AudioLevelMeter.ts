/**
 * Audio Level Meter - Real-time Audio Analysis
 * Monitors audio levels during recording for UI feedback
 * Provides RMS, peak, and quality metrics in real-time
 */

export interface AudioLevel {
	timestamp: number
	rmsLevel: number // 0-1 normalized
	peakLevel: number // 0-1 normalized
	dbLevel: number // -40 to 0 dB
	quality: "excellent" | "good" | "poor" | "silent"
	isSpeech: boolean
	clipping: boolean
}

export class AudioLevelMeter {
	private static readonly RMS_THRESHOLD = 0.02 // -40dB
	private static readonly PEAK_CLIPPING_THRESHOLD = 0.95
	private static readonly SAMPLE_RATE = 16000

	/**
	 * Analyze audio level snapshot
	 * Used for real-time UI updates (progress bar, waveform, etc.)
	 */
	static analyze(pcmBuffer: Buffer | Float32Array, timestamp: number = Date.now()): AudioLevel {
		let float32Audio: Float32Array

		if (Buffer.isBuffer(pcmBuffer)) {
			float32Audio = AudioLevelMeter.bufferToFloat32(pcmBuffer)
		} else {
			float32Audio = pcmBuffer
		}

		const rmsLevel = AudioLevelMeter.calculateRMS(float32Audio)
		const peakLevel = AudioLevelMeter.calculatePeak(float32Audio)
		const dbLevel = AudioLevelMeter.rmsToDb(rmsLevel)
		const isSpeech = rmsLevel > AudioLevelMeter.RMS_THRESHOLD
		const clipping = peakLevel > AudioLevelMeter.PEAK_CLIPPING_THRESHOLD

		let quality: "excellent" | "good" | "poor" | "silent"
		if (!isSpeech) {
			quality = "silent"
		} else if (rmsLevel > 0.1) {
			quality = "excellent"
		} else if (rmsLevel > 0.05) {
			quality = "good"
		} else {
			quality = "poor"
		}

		return {
			timestamp,
			rmsLevel,
			peakLevel,
			dbLevel,
			quality,
			isSpeech,
			clipping,
		}
	}

	/**
	 * Calculate RMS (Root Mean Square) level
	 * Represents average amplitude/volume
	 */
	static calculateRMS(float32Audio: Float32Array): number {
		let sum = 0
		for (let i = 0; i < float32Audio.length; i++) {
			sum += float32Audio[i] * float32Audio[i]
		}
		const meanSquare = sum / float32Audio.length
		return Math.sqrt(meanSquare)
	}

	/**
	 * Calculate peak level
	 * Represents max amplitude in the buffer
	 */
	static calculatePeak(float32Audio: Float32Array): number {
		let max = 0
		for (let i = 0; i < float32Audio.length; i++) {
			const abs = Math.abs(float32Audio[i])
			if (abs > max) {
				max = abs
			}
		}
		return max
	}

	/**
	 * Convert RMS to decibels (dB)
	 * Perceptually more intuitive than linear RMS
	 */
	static rmsToDb(rms: number): number {
		if (rms <= 0) {
			return Number.NEGATIVE_INFINITY
		}
		const db = 20 * Math.log10(rms)
		return Math.max(db, -40) // Clamp to -40dB floor
	}

	/**
	 * Convert decibels to RMS
	 * Inverse of rmsToDb
	 */
	static dbToRms(db: number): number {
		return 10 ** (db / 20)
	}

	/**
	 * Format audio level for display
	 * Example: "-25.5 dB (Good quality)"
	 */
	static formatLevel(level: AudioLevel): string {
		const dbStr = level.dbLevel.toFixed(1)
		const qualityEmoji = {
			excellent: "🟢",
			good: "🟡",
			poor: "🟠",
			silent: "⚫",
		}

		const clippingWarning = level.clipping ? " ⚠️ Clipping!" : ""

		return `${qualityEmoji[level.quality]} ${dbStr} dB (${level.quality})${clippingWarning}`
	}

	/**
	 * Get visual bar for level (0-20 characters)
	 */
	static getVisualizationBar(level: AudioLevel): string {
		const barLength = 20
		const fillLength = Math.round((level.rmsLevel / 0.15) * barLength) // Scale to 0.15 max
		const fill = "█".repeat(Math.min(fillLength, barLength))
		const empty = "░".repeat(Math.max(barLength - fillLength, 0))
		return `[${fill}${empty}]`
	}

	/**
	 * Convert buffer to Float32Array
	 * PCM 16-bit signed → float32
	 */
	private static bufferToFloat32(buffer: Buffer): Float32Array {
		const length = buffer.length / 2
		const float32 = new Float32Array(length)

		for (let i = 0; i < length; i++) {
			const int16 = buffer.readInt16LE(i * 2)
			float32[i] = int16 / 32768 // Normalize to -1 to 1
		}

		return float32
	}

	/**
	 * Get color for level indicator (CSS color)
	 */
	static getColorForLevel(level: AudioLevel): string {
		if (level.clipping) return "#ff0000" // Red
		switch (level.quality) {
			case "excellent":
				return "#00ff00" // Green
			case "good":
				return "#ffff00" // Yellow
			case "poor":
				return "#ff9900" // Orange
			case "silent":
				return "#666666" // Gray
		}
	}
}
