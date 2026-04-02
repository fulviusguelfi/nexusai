import { Logger } from "@/shared/services/Logger"

export type VisemeLabel = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "X"

export interface PhonemeEntry {
	start: number // seconds
	end: number // seconds
	value: VisemeLabel
}

export type PhonemeTimeline = PhonemeEntry[]

const VALID_VISEMES = new Set<string>(["A", "B", "C", "D", "E", "F", "G", "H", "X"])

/** Returns the viseme active at `timeSeconds`, or "X" if outside all entries. */
export function getVisemeAtTime(timeline: PhonemeTimeline, timeSeconds: number): VisemeLabel {
	for (const entry of timeline) {
		if (timeSeconds >= entry.start && timeSeconds < entry.end) {
			return entry.value
		}
	}
	return "X"
}

/**
 * Converts a WAV buffer (any sample rate) to a raw PCM Buffer at 16kHz mono 16-bit
 * for use with rhubarb-lip-sync-wasm.
 */
function wavToPcm16k(wavBuf: Buffer): Buffer {
	// Parse WAV header
	if (wavBuf.length < 44) return Buffer.alloc(0)
	const chunkId = wavBuf.toString("ascii", 0, 4)
	if (chunkId !== "RIFF") return Buffer.alloc(0)

	const audioFormat = wavBuf.readUInt16LE(20)
	const numChannels = wavBuf.readUInt16LE(22)
	const sampleRate = wavBuf.readUInt32LE(24)
	const bitsPerSample = wavBuf.readUInt16LE(34)

	if (audioFormat !== 1 || bitsPerSample !== 16) return Buffer.alloc(0)

	// Find data chunk
	let dataOffset = 12
	let dataSize = 0
	while (dataOffset + 8 <= wavBuf.length) {
		const id = wavBuf.toString("ascii", dataOffset, dataOffset + 4)
		const size = wavBuf.readUInt32LE(dataOffset + 4)
		if (id === "data") {
			dataOffset += 8
			dataSize = size
			break
		}
		dataOffset += 8 + size
	}
	if (dataSize === 0) return Buffer.alloc(0)

	// Read samples (16-bit signed, little-endian)
	const bytesPerSample = bitsPerSample / 8
	const totalSamples = Math.floor(dataSize / (numChannels * bytesPerSample))
	const samples = new Float32Array(totalSamples)
	for (let i = 0; i < totalSamples; i++) {
		let sum = 0
		for (let ch = 0; ch < numChannels; ch++) {
			const offset = dataOffset + (i * numChannels + ch) * bytesPerSample
			const s = wavBuf.readInt16LE(offset)
			sum += s / 32768.0
		}
		samples[i] = sum / numChannels // mono mix-down
	}

	// Resample to 16kHz using linear interpolation
	const targetRate = 16000
	const ratio = sampleRate / targetRate
	const outLength = Math.floor(totalSamples / ratio)
	const out16 = Buffer.alloc(outLength * 2)

	for (let i = 0; i < outLength; i++) {
		const srcPos = i * ratio
		const srcIdx = Math.floor(srcPos)
		const frac = srcPos - srcIdx
		const s0 = samples[srcIdx] ?? 0
		const s1 = samples[srcIdx + 1] ?? s0
		const val = s0 + frac * (s1 - s0)
		out16.writeInt16LE(Math.round(val * 32767), i * 2)
	}

	return out16
}

/**
 * RhubarbService
 *
 * Wraps the rhubarb-lip-sync-wasm package to extract a PhonemeTimeline
 * from a WAV buffer produced by PiperService. The WASM is lazy-loaded
 * on first use to avoid increasing extension startup time.
 *
 * On any failure (WASM load error, invalid audio, etc.) returns a silent
 * fallback timeline rather than throwing, so the avatar degrades gracefully.
 */
export class RhubarbService {
	async extractTimeline(wavBuffer: Buffer): Promise<PhonemeTimeline> {
		try {
			const pcm = wavToPcm16k(wavBuffer)
			if (pcm.length === 0) {
				Logger.debug("[RhubarbService] Could not decode WAV — returning silent fallback")
				return this._silentFallback(1.0)
			}

			const { Rhubarb } = await import("rhubarb-lip-sync-wasm")
			const result = await Rhubarb.getLipSync(pcm as unknown as Buffer<ArrayBuffer>)

			const timeline: PhonemeTimeline = []
			for (const cue of result.mouthCues ?? []) {
				const value = String(cue.value).toUpperCase()
				if (VALID_VISEMES.has(value)) {
					timeline.push({
						start: Number(cue.start),
						end: Number(cue.end),
						value: value as VisemeLabel,
					})
				}
			}

			if (timeline.length === 0) {
				const durationSeconds = pcm.length / 2 / 16000
				return this._silentFallback(durationSeconds)
			}

			// Ensure sorted by start
			timeline.sort((a, b) => a.start - b.start)
			return timeline
		} catch (err) {
			Logger.debug(
				"[RhubarbService] Extraction failed, returning fallback:",
				err instanceof Error ? err.message : String(err),
			)
			return this._silentFallback(1.0)
		}
	}

	private _silentFallback(durationSeconds: number): PhonemeTimeline {
		return [{ start: 0, end: Math.max(durationSeconds, 0.1), value: "X" }]
	}
}
