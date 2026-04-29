/**
 * recordAndRespond unit tests — issue #81
 *
 * Covers the exported utility helpers and preflight-failure fast-path.
 * The full pipeline (VoiceAgent + VoiceResponseHandler) is covered by
 * VoiceResponseHandler.test.ts and integration / smoke tests.
 */
import { afterEach, beforeEach, describe, it } from "mocha"
import "should"
import sinon from "sinon"
import { VoiceAgent } from "@/services/voice/VoiceAgent"
import { VoiceResponseHandler } from "@/services/voice/VoiceResponseHandler"
import { getActiveVoiceAgent, recordAndRespond, setActiveVoiceAgent } from "../recordAndRespond"

// ---------------------------------------------------------------------------
// Minimal stubs
// ---------------------------------------------------------------------------

/** Minimal fake PreFlightChecks that can be configured per-test */
type PreflightResult = { ok: boolean; blockers: { type: string; message: string }[] }
const _preflightResult: PreflightResult = { ok: true, blockers: [] }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("recordAndRespond helpers", () => {
	afterEach(() => {
		setActiveVoiceAgent(null)
	})

	describe("getActiveVoiceAgent() / setActiveVoiceAgent()", () => {
		it("returns null by default", () => {
			;(getActiveVoiceAgent() === null).should.be.true()
		})

		it("returns the agent set via setActiveVoiceAgent", () => {
			const fakeAgent = { stop: sinon.stub() } as any
			setActiveVoiceAgent(fakeAgent)
			getActiveVoiceAgent()!.should.equal(fakeAgent)
		})

		it("can be cleared by passing null", () => {
			setActiveVoiceAgent({ stop: sinon.stub() } as any)
			setActiveVoiceAgent(null)
			;(getActiveVoiceAgent() === null).should.be.true()
		})
	})
})

describe("recordAndRespond()", () => {
	let preflightStub: sinon.SinonStub
	let voiceAgentRecordStub: sinon.SinonStub
	let voiceAgentStopStub: sinon.SinonStub
	let sttStub: sinon.SinonStub

	beforeEach(() => {
		// Stub PreFlightChecks.runAll
		const preflight = require("@/services/voice/PreFlightChecks")
		preflightStub = sinon.stub(preflight.PreFlightChecks, "runAll").resolves(_preflightResult)
		voiceAgentRecordStub = sinon.stub(VoiceAgent.prototype, "recordAndRespond")
		voiceAgentStopStub = sinon.stub(VoiceAgent.prototype, "stop")
		sttStub = sinon.stub(VoiceResponseHandler, "processSpeechToText")
	})

	afterEach(() => {
		sinon.restore()
		setActiveVoiceAgent(null)
	})

	it("returns early with error when preflight fails", async () => {
		preflightStub.resolves({
			ok: false,
			blockers: [{ type: "ffmpeg", message: "FFmpeg not found" }],
		})

		const fakeController = { webviewProvider: null } as any
		const result = await recordAndRespond(fakeController, {})

		result.success.should.be.false()
		result.errorMessage!.should.containEql("System not ready")
		result.transcriptionText.should.equal("")
	})

	it("runs one-shot STT and returns transcription on success", async () => {
		const fakeAudio = Buffer.from("audio-bytes")
		voiceAgentRecordStub.resolves({
			audioData: fakeAudio,
			duration: 1234,
		})
		sttStub.resolves({
			transcription: { text: "ola mundo", language: "pt", confidence: 0.98 },
			detectedLanguage: "pt",
		})

		let createdAgent: any = null
		let destroyedCalled = false

		const fakeController = {
			webviewProvider: null,
			pendingVoiceInput: false,
			context: { globalStoragePath: "/tmp/storage" },
		} as any

		const result = await recordAndRespond(fakeController, {
			sttModel: "small",
			onAgentCreated: (agent: VoiceAgent) => {
				createdAgent = agent
			},
			onAgentDestroyed: () => {
				destroyedCalled = true
			},
		} as any)

		result.success.should.be.true()
		result.transcriptionText.should.equal("ola mundo")
		result.detectedLanguage!.should.equal("pt")
		fakeController.pendingVoiceInput.should.be.true()

		sinon.assert.calledOnce(voiceAgentRecordStub)
		sinon.assert.calledOnce(sttStub)
		sinon.assert.calledWithMatch(sttStub, fakeAudio, {
			globalStoragePath: "/tmp/storage",
			sttModel: "small",
			userLanguage: "pt",
		})
		sinon.assert.calledOnce(voiceAgentStopStub)
		;(createdAgent !== null).should.be.true()
		destroyedCalled.should.be.true()
		;(getActiveVoiceAgent() === null).should.be.true()
	})

	it("returns STT error when one-shot transcription fails", async () => {
		voiceAgentRecordStub.resolves({
			audioData: Buffer.from("audio"),
			duration: 222,
		})
		sttStub.resolves({
			transcription: { text: "", language: "unknown", confidence: 0.98 },
			detectedLanguage: "unknown",
			error: new Error("stt failed"),
		})

		const fakeController = {
			webviewProvider: null,
			pendingVoiceInput: false,
			context: { globalStoragePath: "/tmp/storage" },
		} as any

		const result = await recordAndRespond(fakeController, {} as any)

		result.success.should.be.false()
		result.errorMessage!.should.equal("stt failed")
		result.transcriptionText.should.equal("")
		fakeController.pendingVoiceInput.should.be.false()
		sinon.assert.calledOnce(voiceAgentStopStub)
	})

	it("returns recording failure without invoking STT", async () => {
		voiceAgentRecordStub.resolves({
			error: { userMessage: "mic failure" },
		})

		const fakeController = {
			webviewProvider: null,
			pendingVoiceInput: false,
			context: { globalStoragePath: "/tmp/storage" },
		} as any

		const result = await recordAndRespond(fakeController, {} as any)

		result.success.should.be.false()
		result.errorMessage!.should.equal("mic failure")
		sinon.assert.notCalled(sttStub)
		sinon.assert.calledOnce(voiceAgentStopStub)
		;(getActiveVoiceAgent() === null).should.be.true()
	})

	it("retries once without preferred device when configured device is missing", async () => {
		voiceAgentRecordStub
			.onFirstCall()
			.resolves({ error: { code: "DEVICE_NOT_FOUND", userMessage: "❌ Selected microphone not found" } })
			.onSecondCall()
			.resolves({
				audioData: Buffer.from("audio"),
				duration: 300,
			})

		sttStub.resolves({
			transcription: { text: "teste com fallback", language: "pt", confidence: 0.95 },
			detectedLanguage: "pt",
		})

		const fakeController = {
			webviewProvider: null,
			pendingVoiceInput: false,
			context: { globalStoragePath: "/tmp/storage" },
		} as any

		const result = await recordAndRespond(fakeController, {
			inputDeviceId: "audio=Disconnected Mic",
		} as any)

		result.success.should.be.true()
		result.transcriptionText.should.equal("teste com fallback")
		sinon.assert.calledTwice(voiceAgentRecordStub)
		sinon.assert.calledOnce(sttStub)
	})
})
