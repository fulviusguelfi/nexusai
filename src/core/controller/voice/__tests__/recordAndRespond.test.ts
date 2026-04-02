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

	beforeEach(() => {
		// Stub PreFlightChecks.runAll
		const preflight = require("@/services/voice/PreFlightChecks")
		preflightStub = sinon.stub(preflight.PreFlightChecks, "runAll").resolves(_preflightResult)
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
})
