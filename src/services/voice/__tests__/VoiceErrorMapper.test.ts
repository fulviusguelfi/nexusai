import { afterEach, describe, it } from "mocha"
import "should"
import sinon from "sinon"
import { Logger } from "@/shared/services/Logger"
import { VoiceErrorCode, VoiceErrorMapper } from "../VoiceErrorMapper"

describe("VoiceErrorMapper", () => {
	afterEach(() => {
		sinon.restore()
	})

	describe("map() - error code classification", () => {
		it("maps 'no devices' message to NO_DEVICES", () => {
			const result = VoiceErrorMapper.map(new Error("no devices found on this system"))
			result.code.should.equal(VoiceErrorCode.NO_DEVICES)
			result.userMessage.should.containEql("No microphones")
		})

		it("maps 'enumeratedevices' message to NO_DEVICES", () => {
			const result = VoiceErrorMapper.map(new Error("enumerateDevices failed"))
			result.code.should.equal(VoiceErrorCode.NO_DEVICES)
		})

		it("maps 'device not found' to DEVICE_NOT_FOUND", () => {
			const result = VoiceErrorMapper.map(new Error("device not found: USB Mic"))
			result.code.should.equal(VoiceErrorCode.DEVICE_NOT_FOUND)
		})

		it("maps 'jabra' branded device to DEVICE_NOT_FOUND", () => {
			const result = VoiceErrorMapper.map(new Error("jabra headset disconnected"))
			result.code.should.equal(VoiceErrorCode.DEVICE_NOT_FOUND)
		})

		it("maps 'silence' message to SILENCE_DETECTED", () => {
			const result = VoiceErrorMapper.map(new Error("silence detected in audio stream"))
			result.code.should.equal(VoiceErrorCode.SILENCE_DETECTED)
		})

		it("maps 'no speech' message to SILENCE_DETECTED", () => {
			const result = VoiceErrorMapper.map(new Error("no speech in recording"))
			result.code.should.equal(VoiceErrorCode.SILENCE_DETECTED)
		})

		it("maps 'audio level too low' to SILENCE_DETECTED", () => {
			const result = VoiceErrorMapper.map(new Error("audio level too low to process"))
			result.code.should.equal(VoiceErrorCode.SILENCE_DETECTED)
		})

		it("maps 'ffmpeg not found' to FFMPEG_NOT_FOUND", () => {
			const result = VoiceErrorMapper.map(new Error("ffmpeg not found in PATH"))
			result.code.should.equal(VoiceErrorCode.FFMPEG_NOT_FOUND)
		})

		it("maps 'enoent' to FFMPEG_NOT_FOUND", () => {
			const result = VoiceErrorMapper.map(new Error("ENOENT: no such file or directory"))
			result.code.should.equal(VoiceErrorCode.FFMPEG_NOT_FOUND)
		})

		it("maps 'ffmpeg ... failed' to FFMPEG_SPAWN_ERROR", () => {
			const result = VoiceErrorMapper.map(new Error("ffmpeg process failed to start"))
			result.code.should.equal(VoiceErrorCode.FFMPEG_SPAWN_ERROR)
		})

		it("maps 'idle_timeout' to IDLE_TIMEOUT", () => {
			const result = VoiceErrorMapper.map(new Error("idle_timeout reached"))
			result.code.should.equal(VoiceErrorCode.IDLE_TIMEOUT)
		})

		it("maps 'timeout' to CAPTURE_TIMEOUT", () => {
			const result = VoiceErrorMapper.map(new Error("recording timeout exceeded"))
			result.code.should.equal(VoiceErrorCode.CAPTURE_TIMEOUT)
		})

		it("maps 'exceeded duration' to CAPTURE_TIMEOUT", () => {
			const result = VoiceErrorMapper.map(new Error("exceeded duration limit of 30s"))
			result.code.should.equal(VoiceErrorCode.CAPTURE_TIMEOUT)
		})

		it("maps 'whisper' to WHISPER_FAILED", () => {
			const result = VoiceErrorMapper.map(new Error("whisper cli returned error code 1"))
			result.code.should.equal(VoiceErrorCode.WHISPER_FAILED)
		})

		it("maps 'llm failed' to LLM_FAILED", () => {
			const result = VoiceErrorMapper.map(new Error("llm failed to respond"))
			result.code.should.equal(VoiceErrorCode.LLM_FAILED)
		})

		it("maps 'api error' to LLM_FAILED", () => {
			const result = VoiceErrorMapper.map(new Error("api error 503 service unavailable"))
			result.code.should.equal(VoiceErrorCode.LLM_FAILED)
		})

		it("maps 'piper' to PIPER_FAILED", () => {
			const result = VoiceErrorMapper.map(new Error("piper exited with code 1"))
			result.code.should.equal(VoiceErrorCode.PIPER_FAILED)
		})

		it("maps 'quality' to AUDIO_QUALITY_LOW", () => {
			const result = VoiceErrorMapper.map(new Error("audio quality too low for transcription"))
			result.code.should.equal(VoiceErrorCode.AUDIO_QUALITY_LOW)
		})

		it("falls back to UNKNOWN_ERROR for unrecognized messages", () => {
			const result = VoiceErrorMapper.map(new Error("something completely unexpected happened"))
			result.code.should.equal(VoiceErrorCode.UNKNOWN_ERROR)
			result.userMessage.should.containEql("Voice input error")
		})

		it("handles non-Error values (plain string) gracefully", () => {
			const result = VoiceErrorMapper.map("plain string error")
			result.code.should.equal(VoiceErrorCode.UNKNOWN_ERROR)
			;(result.originalError as Error).should.be.instanceof(Error)
		})

		it("preserves original error reference", () => {
			const original = new Error("whisper cli failed")
			const result = VoiceErrorMapper.map(original)
			;(result.originalError as Error).should.equal(original)
		})
	})

	describe("logError()", () => {
		it("calls Logger.error with the error code and message", () => {
			const loggerErrorStub = sinon.stub(Logger, "error")
			const voiceError = VoiceErrorMapper.map(new Error("piper failed to synthesize"))

			VoiceErrorMapper.logError(voiceError)

			loggerErrorStub.called.should.be.true()
			const firstCallArgs = loggerErrorStub.firstCall.args[0] as string
			firstCallArgs.should.containEql(voiceError.code)
		})

		it("includes context prefix when context is provided", () => {
			const loggerErrorStub = sinon.stub(Logger, "error")
			const voiceError = VoiceErrorMapper.map(new Error("whisper error"))

			VoiceErrorMapper.logError(voiceError, "RecordingController")

			const firstCallArgs = loggerErrorStub.firstCall.args[0] as string
			firstCallArgs.should.startWith("[RecordingController]")
		})

		it("uses [VoiceAgent] prefix when no context given", () => {
			const loggerErrorStub = sinon.stub(Logger, "error")
			const voiceError = VoiceErrorMapper.map(new Error("silence detected"))

			VoiceErrorMapper.logError(voiceError)

			const firstCallArgs = loggerErrorStub.firstCall.args[0] as string
			firstCallArgs.should.startWith("[VoiceAgent]")
		})
	})
})
