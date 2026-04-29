/**
 * ContinuousVoiceFlow integration unit test
 *
 * Validates the full state machine for TWO consecutive voice conversation rounds:
 *   round 1: record → STT → [TTS activates gate] → [TTS done, gate released] → IDLE
 *   round 2: record → STT → success  (gate must be free; no rejection)
 *
 * This is a regression test for the stale-gate bug where SpeakerGate stayed
 * blocked after TTS completion, permanently preventing subsequent recordings.
 */
import { afterEach, beforeEach, describe, it } from "mocha"
import "should"
import sinon from "sinon"
import { recordAndRespond, setActiveVoiceAgent } from "@/core/controller/voice/recordAndRespond"
import { SpeakerGate } from "@/services/voice/SpeakerGate"
import { VoiceAgent } from "@/services/voice/VoiceAgent"
import { VoiceResponseHandler } from "@/services/voice/VoiceResponseHandler"
import { VoiceSessionManager } from "@/services/voice/VoiceSessionManager"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFakeAudio(tag = "audio"): Buffer {
	return Buffer.from(tag)
}

function makeFakeController(storagePath = "/tmp/storage"): any {
	return {
		webviewProvider: null,
		pendingVoiceInput: false,
		context: { globalStoragePath: storagePath },
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Continuous voice conversation flow (2-round cycle)", () => {
	let recordStub: sinon.SinonStub
	let stopStub: sinon.SinonStub
	let sttStub: sinon.SinonStub

	beforeEach(() => {
		const preflight = require("@/services/voice/PreFlightChecks")
		sinon.stub(preflight.PreFlightChecks, "runAll").resolves({ ok: true, blockers: [] })
		recordStub = sinon.stub(VoiceAgent.prototype, "recordAndRespond")
		stopStub = sinon.stub(VoiceAgent.prototype, "stop")
		sttStub = sinon.stub(VoiceResponseHandler, "processSpeechToText")

		// Ensure gate starts clean
		SpeakerGate.getInstance().dispose()
	})

	afterEach(() => {
		sinon.restore()
		setActiveVoiceAgent(null)
		SpeakerGate.getInstance().deactivate()
		VoiceSessionManager.getInstance().dispose()
	})

	// ─────────────────────────────────────────────────────────────────────────
	// Core loop: two rounds succeed when gate is properly released between them
	// ─────────────────────────────────────────────────────────────────────────

	it("allows a second recording after gate is released following TTS", async () => {
		const audioA = makeFakeAudio("round-1")
		const audioB = makeFakeAudio("round-2")

		// Both rounds produce valid audio + transcription
		recordStub
			.onFirstCall()
			.resolves({ audioData: audioA, duration: 1000 })
			.onSecondCall()
			.resolves({ audioData: audioB, duration: 800 })

		sttStub
			.onFirstCall()
			.resolves({
				transcription: { text: "primeira pergunta", language: "pt", confidence: 0.98 },
				detectedLanguage: "pt",
			})
			.onSecondCall()
			.resolves({
				transcription: { text: "segunda pergunta", language: "pt", confidence: 0.98 },
				detectedLanguage: "pt",
			})

		const controller = makeFakeController()

		// ── Round 1 ──────────────────────────────────────────────────────────
		const result1 = await recordAndRespond(controller, {} as any)

		result1.success.should.be.true()
		result1.transcriptionText.should.equal("primeira pergunta")
		controller.pendingVoiceInput.should.be.true()

		// Simulate TTS: gate activates then deactivates (as the production handler does)
		const gate = SpeakerGate.getInstance()
		gate.activate()
		gate.isBlocked().should.be.true()
		gate.deactivate()
		gate.isBlocked().should.be.false()

		// Reset pendingVoiceInput for round 2 (normally done after LLM submit)
		controller.pendingVoiceInput = false

		// ── Round 2 ──────────────────────────────────────────────────────────
		const result2 = await recordAndRespond(controller, {} as any)

		result2.success.should.be.true()
		result2.transcriptionText.should.equal("segunda pergunta")
		controller.pendingVoiceInput.should.be.true()

		// Both rounds called STT and VoiceAgent
		sinon.assert.calledTwice(recordStub)
		sinon.assert.calledTwice(sttStub)
		sinon.assert.calledTwice(stopStub)
	})

	// ─────────────────────────────────────────────────────────────────────────
	// Stale-gate recovery: gate blocked but >15 s old → auto-released
	// ─────────────────────────────────────────────────────────────────────────

	it("gate blocked for >15s does not prevent second round via releaseIfStale", () => {
		const dateNow = sinon.stub(Date, "now").returns(1000)

		const gate = SpeakerGate.getInstance()

		// Simulate TTS that crashed without calling deactivate()
		gate.activate() // _activatedAt = 1000
		gate.isBlocked().should.be.true()

		// Advance time past stale threshold (16 s)
		dateNow.returns(17_000)

		const wasReleased = gate.releaseIfStale(15_000)

		wasReleased.should.be.true()
		gate.isBlocked().should.be.false()
	})

	// ─────────────────────────────────────────────────────────────────────────
	// Active gate (<15 s) rejects recording — explicit error, no silent ignore
	// ─────────────────────────────────────────────────────────────────────────

	it("gate blocked for <15s keeps blocking (no premature release)", () => {
		const dateNow = sinon.stub(Date, "now").returns(1000)

		const gate = SpeakerGate.getInstance()
		gate.activate() // _activatedAt = 1000

		// Only 5 s elapsed — still within TTS window
		dateNow.returns(6_000)

		const wasReleased = gate.releaseIfStale(15_000)

		wasReleased.should.be.false()
		gate.isBlocked().should.be.true()
	})

	// ─────────────────────────────────────────────────────────────────────────
	// VoiceSessionManager state mirrors the gate cycle
	// ─────────────────────────────────────────────────────────────────────────

	it("VoiceSessionManager.setSpeaking mirrors gate activate/deactivate cycle", () => {
		const manager = VoiceSessionManager.getInstance()
		const events: boolean[] = []
		const unsubscribe = manager.onDidChangeStatus((s) => events.push(s.isSpeaking))

		manager.isSpeaking.should.be.false()

		// Gate activates → TTS starts
		SpeakerGate.getInstance().activate()
		manager.setSpeaking(true)

		// Gate deactivates → TTS ends
		SpeakerGate.getInstance().deactivate()
		manager.setSpeaking(false)

		events.should.deepEqual([true, false])
		manager.isSpeaking.should.be.false()

		unsubscribe()
	})

	// ─────────────────────────────────────────────────────────────────────────
	// getBlockedDurationMs resets to 0 after deactivate
	// ─────────────────────────────────────────────────────────────────────────

	it("getBlockedDurationMs returns 0 after gate is deactivated", () => {
		const dateNow = sinon.stub(Date, "now").returns(1000)

		const gate = SpeakerGate.getInstance()
		gate.activate() // _activatedAt = 1000
		dateNow.returns(4_000) // 3 s later
		gate.getBlockedDurationMs().should.be.greaterThanOrEqual(3_000)

		gate.deactivate()
		gate.getBlockedDurationMs().should.equal(0)
	})
})
