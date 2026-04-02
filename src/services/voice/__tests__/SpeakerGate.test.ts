import { afterEach, beforeEach, describe, it } from "mocha"
import "should"
import sinon from "sinon"
import { SpeakerGate } from "../SpeakerGate"

describe("SpeakerGate", () => {
	let gate: SpeakerGate

	beforeEach(() => {
		SpeakerGate.getInstance().dispose()
		gate = SpeakerGate.getInstance()
	})

	afterEach(() => {
		sinon.restore()
		gate.dispose()
	})

	describe("singleton", () => {
		it("returns the same instance on repeated calls", () => {
			const a = SpeakerGate.getInstance()
			const b = SpeakerGate.getInstance()
			a.should.equal(b)
		})

		it("creates a fresh instance after dispose", () => {
			const a = SpeakerGate.getInstance()
			a.dispose()
			const b = SpeakerGate.getInstance()
			a.should.not.equal(b)
		})
	})

	describe("initial state", () => {
		it("isBlocked() returns false on fresh instance", () => {
			gate.isBlocked().should.be.false()
		})
	})

	describe("activate()", () => {
		it("isBlocked() returns true after activate()", () => {
			gate.activate()
			gate.isBlocked().should.be.true()
		})

		it("multiple activate() calls do not stack — single deactivate() clears", () => {
			gate.activate()
			gate.activate()
			gate.activate()
			gate.deactivate()
			gate.isBlocked().should.be.false()
		})
	})

	describe("deactivate()", () => {
		it("isBlocked() returns false after activate() then deactivate()", () => {
			gate.activate()
			gate.deactivate()
			gate.isBlocked().should.be.false()
		})

		it("deactivate() on already-inactive gate keeps isBlocked() false", () => {
			gate.deactivate()
			gate.isBlocked().should.be.false()
		})
	})

	describe("onDidChange()", () => {
		it("fires with true when activate() is called", () => {
			const listener = sinon.stub()
			gate.onDidChange(listener)

			gate.activate()

			listener.calledOnce.should.be.true()
			listener.firstCall.args[0].should.be.true()
		})

		it("fires with false when deactivate() is called", () => {
			const listener = sinon.stub()
			gate.activate()
			gate.onDidChange(listener)

			gate.deactivate()

			listener.calledOnce.should.be.true()
			listener.firstCall.args[0].should.be.false()
		})

		it("does not fire if state does not change (activate when already active)", () => {
			gate.activate()
			const listener = sinon.stub()
			gate.onDidChange(listener)

			gate.activate() // already active — no change

			listener.called.should.be.false()
		})

		it("stops delivering events after returned disposer is called", () => {
			const listener = sinon.stub()
			const dispose = gate.onDidChange(listener)

			dispose()
			gate.activate()

			listener.called.should.be.false()
		})
	})

	describe("dispose()", () => {
		it("resets isBlocked() to false", () => {
			gate.activate()
			gate.dispose()
			// After dispose, a new instance is created
			SpeakerGate.getInstance().isBlocked().should.be.false()
		})

		it("removes all listeners — no events fired after dispose", () => {
			const listener = sinon.stub()
			gate.onDidChange(listener)
			gate.dispose()

			// Activate on fresh instance — old listener must not fire
			SpeakerGate.getInstance().activate()

			listener.called.should.be.false()
		})
	})
})
