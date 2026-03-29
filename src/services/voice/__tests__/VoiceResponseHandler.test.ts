import { afterEach, beforeEach, describe, it } from "mocha"
import "should"
import sinon from "sinon"
import { VoiceResponseHandler } from "../VoiceResponseHandler"
import { WhisperCliService } from "../WhisperCliService"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal PCM 16-bit LE buffer with silent samples */
function silentPcmBuffer(numSamples = 1600): Buffer {
	return Buffer.alloc(numSamples * 2, 0)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VoiceResponseHandler", () => {
	let isPlatformSupportedStub: sinon.SinonStub
	let getInstanceStub: sinon.SinonStub
	let transcribeStub: sinon.SinonStub

	beforeEach(() => {
		// Default: platform supported, mock transcription
		transcribeStub = sinon.stub().resolves({ text: "Hello from test", language: "en" })

		isPlatformSupportedStub = sinon.stub(WhisperCliService, "isPlatformSupported").returns(true)

		getInstanceStub = sinon.stub(WhisperCliService, "getInstance").returns({
			transcribeWithLanguageDetection: transcribeStub,
		} as any)
	})

	afterEach(() => {
		sinon.restore()
		WhisperCliService.clearInstance()
	})

	describe("processSpeechToText()", () => {
		it("returns transcription and detectedLanguage on success", async () => {
			const audioBuffer = silentPcmBuffer()
			const result = await VoiceResponseHandler.processSpeechToText(audioBuffer, {
				globalStoragePath: "/tmp/test-storage",
			})

			result.transcription.text.should.equal("Hello from test")
			result.transcription.language.should.equal("en")
			result.detectedLanguage.should.equal("en")
			;(result.error === undefined).should.be.true()
		})

		it("detects language from transcription result", async () => {
			transcribeStub.resolves({ text: "Olá mundo", language: "pt" })

			const result = await VoiceResponseHandler.processSpeechToText(silentPcmBuffer(), {
				globalStoragePath: "/tmp/test-storage",
			})

			result.detectedLanguage.should.equal("pt")
			result.transcription.text.should.equal("Olá mundo")
		})

		it("returns empty transcription and error on failure", async () => {
			transcribeStub.rejects(new Error("whisper cli failed with exit code 1"))

			const result = await VoiceResponseHandler.processSpeechToText(silentPcmBuffer(), {
				globalStoragePath: "/tmp/test-storage",
			})

			result.transcription.text.should.equal("")
			result.detectedLanguage.should.equal("unknown")
			;(result.error as Error).should.be.instanceof(Error)
			;(result.error as Error).message.should.containEql("whisper cli failed")
		})

		it("requires globalStoragePath and returns error when missing", async () => {
			// Without globalStoragePath, runSpeechToText throws
			const result = await VoiceResponseHandler.processSpeechToText(silentPcmBuffer(), {
				// no globalStoragePath
			})

			result.transcription.text.should.equal("")
			result.detectedLanguage.should.equal("unknown")
			;(result.error as Error).should.be.instanceof(Error)
		})

		it("calls onProgress callback with 0 and 100", async () => {
			const progressValues: number[] = []
			await VoiceResponseHandler.processSpeechToText(silentPcmBuffer(), {
				globalStoragePath: "/tmp/test-storage",
				onProgress: (p) => progressValues.push(p),
			})

			progressValues.should.containEql(0)
			progressValues.should.containEql(100)
		})

		it("sets confidence to 0.98 (Whisper default)", async () => {
			const result = await VoiceResponseHandler.processSpeechToText(silentPcmBuffer(), {
				globalStoragePath: "/tmp/test-storage",
			})

			result.transcription.confidence.should.equal(0.98)
		})
	})

	describe("processTextToSpeech()", () => {
		it("returns an empty-buffer VoiceAudio (placeholder implementation)", async () => {
			const result = await VoiceResponseHandler.processTextToSpeech("Hello world")

			// The current implementation is a placeholder that returns empty audio on catch
			// OR calls PiperService. Either way it should not throw.
			result.should.have.property("audio")
			result.audio.should.have.property("data")
			result.audio.data.should.be.instanceof(Buffer)
		})
	})

	describe("process() [deprecated]", () => {
		it("resolves and returns transcription text (backward compat)", async () => {
			const result = await VoiceResponseHandler.process(silentPcmBuffer(), {
				globalStoragePath: "/tmp/test-storage",
			})

			// Should succeed and return transcription
			result.transcription.text.should.equal("Hello from test")
			;(result.detectedLanguage as string).should.equal("en")
		})

		it("returns error result on STT failure without throwing", async () => {
			transcribeStub.rejects(new Error("stt boom"))

			const result = await VoiceResponseHandler.process(silentPcmBuffer(), {
				globalStoragePath: "/tmp/test-storage",
			})

			result.transcription.text.should.equal("")
			;(result.detectedLanguage as string).should.equal("unknown")
			;(result.error as Error).should.be.instanceof(Error)
		})
	})
})
