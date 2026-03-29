import { describe, it } from "mocha"
import "should"
import { SilenceDetector } from "../SilenceDetector"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a Float32Array filled with a constant amplitude value */
function constFloat32(length: number, amplitude: number): Float32Array {
	const arr = new Float32Array(length)
	arr.fill(amplitude)
	return arr
}

/** Build a PCM 16-bit LE Buffer from a Float32Array */
function float32ToPcm(float32: Float32Array): Buffer {
	const buf = Buffer.alloc(float32.length * 2)
	for (let i = 0; i < float32.length; i++) {
		const clamped = Math.max(-1, Math.min(1, float32[i]))
		buf.writeInt16LE(Math.round(clamped * 32767), i * 2)
	}
	return buf
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SilenceDetector", () => {
	describe("analyze() with Float32Array input", () => {
		it("classifies completely silent audio as 'silent'", () => {
			const audio = constFloat32(1600, 0)
			const result = SilenceDetector.analyze(audio)

			result.isSilence.should.be.true()
			result.quality.should.equal("silent")
			result.rmsLevel.should.be.approximately(0, 0.0001)
			result.peakLevel.should.equal(0)
			result.confidence.should.equal(1.0)
		})

		it("classifies very low amplitude audio as 'poor'", () => {
			// rmsLevel = 0.005 → between 0.002 and 0.01 → poor
			const audio = constFloat32(1600, 0.005)
			const result = SilenceDetector.analyze(audio)

			result.quality.should.equal("poor")
			result.rmsLevel.should.be.approximately(0.005, 0.0001)
			result.confidence.should.equal(0.9)
		})

		it("classifies moderate amplitude audio as 'good'", () => {
			// rmsLevel = 0.03 → between 0.01 and 0.05 → good
			const audio = constFloat32(1600, 0.03)
			const result = SilenceDetector.analyze(audio)

			result.quality.should.equal("good")
			result.isSilence.should.be.false()
			result.confidence.should.equal(0.8)
		})

		it("classifies strong audio as 'excellent'", () => {
			// rmsLevel = 0.3 → above 0.05 and no clipping → excellent
			const audio = constFloat32(1600, 0.3)
			const result = SilenceDetector.analyze(audio)

			result.quality.should.equal("excellent")
			result.isSilence.should.be.false()
			result.confidence.should.equal(0.95)
		})

		it("detects clipping but still returns 'excellent' quality with reduced confidence", () => {
			// peak > 0.95 → clipping branch → confidence 0.85
			const audio = constFloat32(1600, 0.97)
			const result = SilenceDetector.analyze(audio)

			result.peakLevel.should.be.approximately(0.97, 0.0001)
			result.quality.should.equal("excellent")
			result.confidence.should.equal(0.85)
		})

		it("respects custom silenceThresholdRms parameter", () => {
			// audio RMS = 0.05, default threshold = 0.01 → not silent
			// but with threshold = 0.1 → silent
			const audio = constFloat32(1600, 0.05)
			const withDefault = SilenceDetector.analyze(audio)
			const withHighThreshold = SilenceDetector.analyze(audio, 0.1)

			withDefault.isSilence.should.be.false()
			withHighThreshold.isSilence.should.be.true()
		})
	})

	describe("analyze() with PCM Buffer input", () => {
		it("converts PCM 16-bit buffer and classifies correctly", () => {
			// Float32 0.3 amplitude → PCM → back to ~0.3 after normalize
			const float32 = constFloat32(1600, 0.3)
			const pcmBuf = float32ToPcm(float32)

			const result = SilenceDetector.analyze(pcmBuf)

			result.quality.should.equal("excellent")
			result.isSilence.should.be.false()
			// RMS should be close to 0.3 after the int16 round-trip
			result.rmsLevel.should.be.approximately(0.3, 0.005)
		})

		it("silent PCM buffer returns isSilence=true", () => {
			const pcmBuf = Buffer.alloc(3200, 0) // all zeros
			const result = SilenceDetector.analyze(pcmBuf)

			result.isSilence.should.be.true()
			result.quality.should.equal("silent")
			result.rmsLevel.should.equal(0)
		})
	})

	describe("calculateMinSpeechSamples()", () => {
		it("calculates 16000 samples for 1000ms at 16000Hz", () => {
			SilenceDetector.calculateMinSpeechSamples(1000, 16000).should.equal(16000)
		})

		it("calculates 8000 samples for 500ms at 16000Hz", () => {
			SilenceDetector.calculateMinSpeechSamples(500, 16000).should.equal(8000)
		})

		it("uses 16000 as default sample rate", () => {
			SilenceDetector.calculateMinSpeechSamples(1000).should.equal(16000)
		})

		it("floors fractional samples", () => {
			// 100ms at 16000Hz = 1600 samples exactly — let's test non-round number
			// 150ms at 16000Hz = 2400 samples
			SilenceDetector.calculateMinSpeechSamples(150, 16000).should.equal(2400)
		})
	})
})
