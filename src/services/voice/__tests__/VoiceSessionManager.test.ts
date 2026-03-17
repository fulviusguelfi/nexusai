import { afterEach, beforeEach, describe, it } from "mocha"
import "should"
import sinon from "sinon"
import { VoiceSessionManager } from "../VoiceSessionManager"

describe("VoiceSessionManager", () => {
	let manager: VoiceSessionManager

	beforeEach(() => {
		// Ensure a fresh singleton for every test
		VoiceSessionManager.getInstance().dispose()
		manager = VoiceSessionManager.getInstance()
	})

	afterEach(() => {
		sinon.restore()
		manager.dispose()
	})

	describe("singleton", () => {
		it("returns the same instance on repeated calls", () => {
			const a = VoiceSessionManager.getInstance()
			const b = VoiceSessionManager.getInstance()
			a.should.equal(b)
		})

		it("creates a fresh instance after dispose", () => {
			const a = VoiceSessionManager.getInstance()
			a.dispose()
			const b = VoiceSessionManager.getInstance()
			a.should.not.equal(b)
		})
	})

	describe("initial status", () => {
		it("starts with all fields falsy/empty", () => {
			manager.isRecording.should.be.false()
			manager.isSpeaking.should.be.false()
			manager.lastTranscription.should.equal("")
		})
	})

	describe("setRecording()", () => {
		it("updates isRecording and fires statusChange", () => {
			const listener = sinon.stub()
			manager.onDidChangeStatus(listener)

			manager.setRecording(true)

			manager.isRecording.should.be.true()
			listener.calledOnce.should.be.true()
			listener.firstCall.args[0].isRecording.should.be.true()
		})

		it("does not fire statusChange when value is unchanged", () => {
			const listener = sinon.stub()
			manager.onDidChangeStatus(listener)

			manager.setRecording(false) // same as initial

			listener.called.should.be.false()
		})
	})

	describe("setSpeaking()", () => {
		it("updates isSpeaking and fires statusChange", () => {
			const listener = sinon.stub()
			manager.onDidChangeStatus(listener)

			manager.setSpeaking(true)

			manager.isSpeaking.should.be.true()
			listener.calledOnce.should.be.true()
		})

		it("does not fire when value is unchanged", () => {
			const listener = sinon.stub()
			manager.onDidChangeStatus(listener)

			manager.setSpeaking(false) // same as initial

			listener.called.should.be.false()
		})
	})

	describe("setLastTranscription()", () => {
		it("updates lastTranscription and fires statusChange", () => {
			const listener = sinon.stub()
			manager.onDidChangeStatus(listener)

			manager.setLastTranscription("hello world")

			manager.lastTranscription.should.equal("hello world")
			listener.calledOnce.should.be.true()
		})
	})

	describe("onDidChangeStatus() disposer", () => {
		it("stops delivering events after dispose is called", () => {
			const listener = sinon.stub()
			const dispose = manager.onDidChangeStatus(listener)

			dispose()
			manager.setRecording(true)

			listener.called.should.be.false()
		})
	})

	describe("requestSpeak()", () => {
		it("fires the speak event to onSpeakRequest subscribers", () => {
			const listener = sinon.stub()
			manager.onSpeakRequest(listener)

			manager.requestSpeak("say this")

			listener.calledOnceWith("say this").should.be.true()
		})

		it("does not fire statusChange", () => {
			const statusListener = sinon.stub()
			manager.onDidChangeStatus(statusListener)

			manager.requestSpeak("say this")

			statusListener.called.should.be.false()
		})
	})

	describe("waitForTranscription()", () => {
		it("resolves with the transcribed text when setLastTranscription is called", async () => {
			const promise = manager.waitForTranscription(5_000)
			manager.setLastTranscription("transcribed text")
			const result = await promise
			result.should.equal("transcribed text")
		})

		it("resolves with empty string on timeout", async () => {
			const result = await manager.waitForTranscription(50)
			result.should.equal("")
		})
	})

	describe("status getter", () => {
		it("returns a snapshot of all fields", () => {
			manager.setRecording(true)
			manager.setSpeaking(true)
			manager.setLastTranscription("snap")

			const s = manager.status
			s.isRecording.should.be.true()
			s.isSpeaking.should.be.true()
			s.lastTranscription.should.equal("snap")
		})
	})
})
