import { afterEach, describe, it } from "mocha"
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
	})
})
