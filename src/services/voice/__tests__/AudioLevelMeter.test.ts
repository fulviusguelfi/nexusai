import { describe, it } from "mocha"
import "should"
import { AudioLevelMeter } from "../AudioLevelMeter"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a Float32Array filled with a constant amplitude value */
function constFloat32(length: number, amplitude: number): Float32Array {
	const arr = new Float32Array(length)
	arr.fill(amplitude)
	return arr
}

/** Build a PCM 16-bit LE Buffer from a Float32 amplitude */
function makePcmBuffer(length: number, amplitude: number): Buffer {
	const float32 = constFloat32(length, amplitude)
	const buf = Buffer.alloc(length * 2)
	for (let i = 0; i < length; i++) {
		const clamped = Math.max(-1, Math.min(1, float32[i]))
		buf.writeInt16LE(Math.round(clamped * 32767), i * 2)
	}
	return buf
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AudioLevelMeter", () => {
	describe("calculateRMS()", () => {
		it("returns 0 for a silent buffer", () => {
			const audio = constFloat32(1600, 0)
			AudioLevelMeter.calculateRMS(audio).should.equal(0)
		})

		it("returns the amplitude for a constant signal", () => {
			const audio = constFloat32(1600, 0.5)
			AudioLevelMeter.calculateRMS(audio).should.be.approximately(0.5, 0.0001)
		})
	})

	describe("calculatePeak()", () => {
		it("returns 0 for a silent buffer", () => {
			const audio = constFloat32(1600, 0)
			AudioLevelMeter.calculatePeak(audio).should.equal(0)
		})

		it("returns the max absolute value in the buffer", () => {
			const audio = new Float32Array([-0.3, 0.7, -0.9, 0.5])
			AudioLevelMeter.calculatePeak(audio).should.be.approximately(0.9, 0.0001)
		})
	})

	describe("rmsToDb()", () => {
		it("returns -Infinity for zero RMS (before clamp path)", () => {
			// When rms <= 0, implementation returns Number.NEGATIVE_INFINITY directly
			// The -40 clamp only applies when rms > 0 produces a value below -40dB
			AudioLevelMeter.rmsToDb(0).should.equal(Number.NEGATIVE_INFINITY)
		})

		it("returns 0 dB for RMS of 1.0 (full scale)", () => {
			AudioLevelMeter.rmsToDb(1.0).should.be.approximately(0, 0.001)
		})

		it("returns approximately -6dB for RMS of 0.5", () => {
			AudioLevelMeter.rmsToDb(0.5).should.be.approximately(-6.02, 0.1)
		})

		it("clamps to -40 dB floor for very small RMS", () => {
			AudioLevelMeter.rmsToDb(0.000001).should.equal(-40)
		})
	})

	describe("analyze() with Float32Array", () => {
		it("classifies silent audio correctly", () => {
			const audio = constFloat32(1600, 0)
			const result = AudioLevelMeter.analyze(audio, 12345)

			result.isSpeech.should.be.false()
			result.quality.should.equal("silent")
			result.rmsLevel.should.equal(0)
			result.clipping.should.be.false()
			result.timestamp.should.equal(12345)
		})

		it("classifies speech audio with RMS > 0.02 as isSpeech=true", () => {
			const audio = constFloat32(1600, 0.1)
			const result = AudioLevelMeter.analyze(audio)

			result.isSpeech.should.be.true()
		})

		it("classifies RMS > 0.1 as 'excellent' quality", () => {
			const audio = constFloat32(1600, 0.3)
			const result = AudioLevelMeter.analyze(audio)

			result.quality.should.equal("excellent")
		})

		it("classifies RMS between 0.05 and 0.1 as 'good' quality", () => {
			const audio = constFloat32(1600, 0.07)
			const result = AudioLevelMeter.analyze(audio)

			result.quality.should.equal("good")
		})

		it("classifies RMS between 0.02 and 0.05 as 'poor' quality", () => {
			const audio = constFloat32(1600, 0.03)
			const result = AudioLevelMeter.analyze(audio)

			result.quality.should.equal("poor")
		})

		it("detects clipping when peak > 0.95", () => {
			const audio = constFloat32(1600, 0.97)
			const result = AudioLevelMeter.analyze(audio)

			result.clipping.should.be.true()
		})

		it("does not flag clipping for normal peak values", () => {
			const audio = constFloat32(1600, 0.5)
			const result = AudioLevelMeter.analyze(audio)

			result.clipping.should.be.false()
		})

		it("includes dbLevel in the result", () => {
			const audio = constFloat32(1600, 0.5)
			const result = AudioLevelMeter.analyze(audio)

			result.dbLevel.should.be.approximately(-6.02, 0.1)
		})
	})

	describe("analyze() with PCM Buffer", () => {
		it("accepts Buffer input and converts to float32 internally", () => {
			const pcmBuf = makePcmBuffer(1600, 0.3)
			const result = AudioLevelMeter.analyze(pcmBuf)

			result.isSpeech.should.be.true()
			result.quality.should.equal("excellent")
		})

		it("silent PCM buffer returns isSpeech=false", () => {
			const pcmBuf = Buffer.alloc(3200, 0)
			const result = AudioLevelMeter.analyze(pcmBuf)

			result.isSpeech.should.be.false()
			result.rmsLevel.should.equal(0)
		})
	})
})
