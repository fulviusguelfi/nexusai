import { afterEach, beforeEach, describe, it } from "mocha"
import "should"
import sinon from "sinon"
import type { VisemeLabel } from "../RhubarbService"
import { getVisemeAtTime, RhubarbService } from "../RhubarbService"

const VALID_VISEMES = new Set<string>(["A", "B", "C", "D", "E", "F", "G", "H", "X"])

// Minimal valid PCM WAV header (44 bytes) + 1s of silence at 22050Hz mono 16-bit
function makeSilentWav(durationSeconds = 1): Buffer {
	const sampleRate = 22050
	const numChannels = 1
	const bitsPerSample = 16
	const numSamples = Math.floor(sampleRate * durationSeconds)
	const dataSize = numSamples * numChannels * (bitsPerSample / 8)
	const buffer = Buffer.alloc(44 + dataSize, 0)
	// RIFF header
	buffer.write("RIFF", 0)
	buffer.writeUInt32LE(36 + dataSize, 4)
	buffer.write("WAVE", 8)
	// fmt chunk
	buffer.write("fmt ", 12)
	buffer.writeUInt32LE(16, 16) // chunk size
	buffer.writeUInt16LE(1, 20) // PCM
	buffer.writeUInt16LE(numChannels, 22)
	buffer.writeUInt32LE(sampleRate, 24)
	buffer.writeUInt32LE((sampleRate * numChannels * bitsPerSample) / 8, 28) // byte rate
	buffer.writeUInt16LE((numChannels * bitsPerSample) / 8, 32) // block align
	buffer.writeUInt16LE(bitsPerSample, 34)
	// data chunk
	buffer.write("data", 36)
	buffer.writeUInt32LE(dataSize, 40)
	return buffer
}

/**
 * Build a WAV at a custom sample rate (can be below 16kHz).
 * When sampleRate < 16000, wavToPcm16k upsamples, and the last
 * interpolation step accesses `samples[srcIdx + 1]` out-of-bounds →
 * the `?? s0` branch in the resampling loop is exercised.
 */
function makeWavAtRate(sampleRate: number, durationSeconds = 0.1): Buffer {
	const numChannels = 1
	const bitsPerSample = 16
	const numSamples = Math.floor(sampleRate * durationSeconds)
	const dataSize = numSamples * numChannels * (bitsPerSample / 8)
	const buf = Buffer.alloc(44 + dataSize, 0)
	buf.write("RIFF", 0)
	buf.writeUInt32LE(36 + dataSize, 4)
	buf.write("WAVE", 8)
	buf.write("fmt ", 12)
	buf.writeUInt32LE(16, 16)
	buf.writeUInt16LE(1, 20) // PCM
	buf.writeUInt16LE(numChannels, 22)
	buf.writeUInt32LE(sampleRate, 24)
	buf.writeUInt32LE((sampleRate * numChannels * bitsPerSample) / 8, 28)
	buf.writeUInt16LE((numChannels * bitsPerSample) / 8, 32)
	buf.writeUInt16LE(bitsPerSample, 34)
	buf.write("data", 36)
	buf.writeUInt32LE(dataSize, 40)
	return buf
}

/**
 * Build a WAV with an extra non-data chunk (e.g. "LIST") inserted before
 * the data chunk. This forces wavToPcm16k to loop past the extra chunk
 * (exercising the branch that skips non-data chunks).
 */
function makeWavWithExtraChunk(): Buffer {
	const sampleRate = 22050
	const numChannels = 1
	const bitsPerSample = 16
	const extraChunkData = Buffer.alloc(4, 0) // 4 bytes of dummy LIST content
	const numSamples = 100
	const pcmData = Buffer.alloc(numSamples * 2, 0)

	// Layout: RIFF(12) + fmt(24) + LIST(12) + data(8 + pcmData)
	const totalSize = 12 + 24 + 8 + extraChunkData.length + 8 + pcmData.length
	const buf = Buffer.alloc(totalSize)

	let offset = 0
	// RIFF header
	buf.write("RIFF", offset)
	offset += 4
	buf.writeUInt32LE(totalSize - 8, offset)
	offset += 4
	buf.write("WAVE", offset)
	offset += 4

	// fmt chunk
	buf.write("fmt ", offset)
	offset += 4
	buf.writeUInt32LE(16, offset)
	offset += 4 // chunk size
	buf.writeUInt16LE(1, offset)
	offset += 2 // PCM
	buf.writeUInt16LE(numChannels, offset)
	offset += 2
	buf.writeUInt32LE(sampleRate, offset)
	offset += 4
	buf.writeUInt32LE((sampleRate * numChannels * bitsPerSample) / 8, offset)
	offset += 4
	buf.writeUInt16LE((numChannels * bitsPerSample) / 8, offset)
	offset += 2
	buf.writeUInt16LE(bitsPerSample, offset)
	offset += 2

	// Fake LIST chunk (non-data, should be skipped)
	buf.write("LIST", offset)
	offset += 4
	buf.writeUInt32LE(extraChunkData.length, offset)
	offset += 4
	extraChunkData.copy(buf, offset)
	offset += extraChunkData.length

	// data chunk
	buf.write("data", offset)
	offset += 4
	buf.writeUInt32LE(pcmData.length, offset)
	offset += 4
	pcmData.copy(buf, offset)

	return buf
}

describe("RhubarbService", () => {
	afterEach(() => {
		sinon.restore()
	})

	describe("extractTimeline()", () => {
		it("returns an array for a valid WAV buffer", async () => {
			const service = new RhubarbService()
			const wav = makeSilentWav(1)
			const timeline = await service.extractTimeline(wav)
			timeline.should.be.an.Array()
		})

		it("all returned viseme values are valid VisemeLabel members", async () => {
			const service = new RhubarbService()
			const wav = makeSilentWav(1)
			const timeline = await service.extractTimeline(wav)
			for (const entry of timeline) {
				VALID_VISEMES.has(entry.value).should.be.true()
			}
		})

		it("timeline entries are sorted by start time", async () => {
			const service = new RhubarbService()
			const wav = makeSilentWav(1)
			const timeline = await service.extractTimeline(wav)
			for (let i = 1; i < timeline.length; i++) {
				timeline[i].start.should.be.greaterThanOrEqual(timeline[i - 1].start)
			}
		})

		it("returns at least one entry with value X for silent WAV", async () => {
			const service = new RhubarbService()
			const wav = makeSilentWav(1)
			const timeline = await service.extractTimeline(wav)
			// Silent audio should produce entries — at minimum a fallback X entry
			timeline.length.should.be.greaterThan(0)
			const hasX = timeline.some((e) => e.value === "X")
			hasX.should.be.true()
		})

		it("handles WASM load failure gracefully — returns fallback without throwing", async () => {
			const service = new RhubarbService()
			// Pass an invalid buffer to trigger fallback
			const invalidBuf = Buffer.from([0x00, 0x01, 0x02])
			let threw = false
			let timeline: Awaited<ReturnType<typeof service.extractTimeline>> = []
			try {
				timeline = await service.extractTimeline(invalidBuf)
			} catch {
				threw = true
			}
			threw.should.be.false()
			timeline.should.be.an.Array()
		})
	})

	describe("getVisemeAtTime()", () => {
		it("returns correct viseme for given time", () => {
			const timeline = [
				{ start: 0.0, end: 0.1, value: "A" as VisemeLabel },
				{ start: 0.1, end: 0.3, value: "B" as VisemeLabel },
				{ start: 0.3, end: 0.5, value: "C" as VisemeLabel },
			]
			getVisemeAtTime(timeline, 0.0).should.equal("A")
			getVisemeAtTime(timeline, 0.05).should.equal("A")
			getVisemeAtTime(timeline, 0.1).should.equal("B")
			getVisemeAtTime(timeline, 0.2).should.equal("B")
			getVisemeAtTime(timeline, 0.3).should.equal("C")
			getVisemeAtTime(timeline, 0.4).should.equal("C")
		})

		it("returns X for time beyond the last entry", () => {
			const timeline = [{ start: 0.0, end: 0.5, value: "A" as VisemeLabel }]
			getVisemeAtTime(timeline, 1.0).should.equal("X")
		})

		it("returns X for empty timeline", () => {
			getVisemeAtTime([], 0.5).should.equal("X")
		})

		it("returns X exactly at entry.end (boundary not inclusive)", () => {
			const timeline = [{ start: 0.0, end: 0.5, value: "A" as VisemeLabel }]
			getVisemeAtTime(timeline, 0.5).should.equal("X")
		})

		it("returns X when time falls in a gap between entries", () => {
			const timeline = [
				{ start: 0.0, end: 0.2, value: "A" as VisemeLabel },
				{ start: 0.4, end: 0.6, value: "B" as VisemeLabel },
			]
			// 0.3 is between 0.2 and 0.4 → gap → X
			getVisemeAtTime(timeline, 0.3).should.equal("X")
		})
	})
})

// ---------------------------------------------------------------------------
// wavToPcm16k boundary branches (exercised through extractTimeline)
// ---------------------------------------------------------------------------

describe("RhubarbService — wavToPcm16k boundary branches", () => {
	let service: RhubarbService

	beforeEach(() => {
		service = new RhubarbService()
	})

	afterEach(() => {
		sinon.restore()
	})

	it("returns fallback for WAV shorter than 44 bytes (branch: length < 44)", async () => {
		const timeline = await service.extractTimeline(Buffer.alloc(10))
		timeline.should.have.length(1)
		timeline[0].value.should.equal("X")
	})

	it("returns fallback for non-RIFF magic bytes (branch: chunkId !== RIFF)", async () => {
		const buf = Buffer.alloc(50, 0)
		buf.write("FAKE", 0)
		const timeline = await service.extractTimeline(buf)
		timeline.should.have.length(1)
		timeline[0].value.should.equal("X")
	})

	it("returns fallback for non-PCM (float32) WAV (branch: audioFormat !== 1)", async () => {
		const buf = makeWavAtRate(22050)
		buf.writeUInt16LE(3, 20) // audioFormat = 3 (IEEE_FLOAT), not 1 (PCM)
		const timeline = await service.extractTimeline(buf)
		timeline.should.have.length(1)
		timeline[0].value.should.equal("X")
	})

	it("returns fallback for WAV with no data chunk (branch: dataSize === 0)", async () => {
		// Build a RIFF/WAVE with only a fmt chunk and no data chunk
		const buf = Buffer.alloc(44 + 8, 0) // header + fmt + empty data slot
		buf.write("RIFF", 0)
		buf.writeUInt32LE(36, 4)
		buf.write("WAVE", 8)
		buf.write("fmt ", 12)
		buf.writeUInt32LE(16, 16)
		buf.writeUInt16LE(1, 20) // PCM
		buf.writeUInt16LE(1, 22) // mono
		buf.writeUInt32LE(22050, 24) // sampleRate
		buf.writeUInt32LE(44100, 28) // byteRate
		buf.writeUInt16LE(2, 32) // blockAlign
		buf.writeUInt16LE(16, 34) // bitsPerSample
		// No "data" chunk — chunk loop finds nothing → dataSize remains 0
		buf.write("JUNK", 36) // unknown chunk that is NOT "data"
		buf.writeUInt32LE(0, 40) // size 0
		const timeline = await service.extractTimeline(buf)
		timeline.should.have.length(1)
		timeline[0].value.should.equal("X")
	})

	it("processes WAV with extra chunk before data (branch: loop skips non-data)", async () => {
		const wav = makeWavWithExtraChunk()
		let threw = false
		try {
			await service.extractTimeline(wav)
		} catch {
			threw = true
		}
		threw.should.be.false()
	})

	it("exercises upsampling boundary via 8kHz WAV (branch: s1 ?? s0)", async () => {
		// 8kHz < 16kHz → wavToPcm16k upsamples; the last output sample accesses
		// samples[srcIdx + 1] out-of-bounds → the `?? s0` null-coalescing branch.
		const wav = makeWavAtRate(8000, 0.2)
		let threw = false
		try {
			await service.extractTimeline(wav)
		} catch {
			threw = true
		}
		threw.should.be.false()
	})
})
