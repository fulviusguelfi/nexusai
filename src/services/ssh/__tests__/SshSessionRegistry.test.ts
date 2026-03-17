import { afterEach, beforeEach, describe, it } from "mocha"
import "should"
import sinon from "sinon"
import { SshSessionRegistry } from "../SshSessionRegistry"

/** Reset module-level state between tests via private Maps */
function clearRegistry(): void {
	// Access private Maps via any cast — acceptable in unit tests
	const reg = SshSessionRegistry as any
	reg.sessions.clear()
	reg.metadata.clear()
	reg.changeListeners.clear()
}

describe("SshSessionRegistry", () => {
	beforeEach(clearRegistry)
	afterEach(() => {
		clearRegistry()
		sinon.restore()
	})

	describe("setMetadata() / getActiveSessions()", () => {
		it("returns empty array when no sessions registered", () => {
			SshSessionRegistry.getActiveSessions().should.deepEqual([])
		})

		it("returns session info after setMetadata()", () => {
			SshSessionRegistry.setMetadata("task-1", {
				host: "192.168.1.10",
				port: 22,
				user: "pi",
				connectedAt: 1000,
			})

			const sessions = SshSessionRegistry.getActiveSessions()
			sessions.should.have.length(1)
			sessions[0].taskId.should.equal("task-1")
			sessions[0].host.should.equal("192.168.1.10")
			sessions[0].user.should.equal("pi")
		})

		it("returns multiple sessions when multiple are set", () => {
			SshSessionRegistry.setMetadata("t1", { host: "h1", port: 22, user: "u1", connectedAt: 1 })
			SshSessionRegistry.setMetadata("t2", { host: "h2", port: 2222, user: "u2", connectedAt: 2 })

			SshSessionRegistry.getActiveSessions().should.have.length(2)
		})
	})

	describe("onDidChange()", () => {
		it("notifies listener when setMetadata() is called", () => {
			const spy = sinon.spy()
			SshSessionRegistry.onDidChange(spy)

			SshSessionRegistry.setMetadata("t1", { host: "h", port: 22, user: "u", connectedAt: 0 })

			spy.calledOnce.should.be.true()
		})

		it("notifies listener when delete() is called", () => {
			const mockClient = { end: sinon.stub() }
			SshSessionRegistry.set("t1", mockClient)
			SshSessionRegistry.setMetadata("t1", { host: "h", port: 22, user: "u", connectedAt: 0 })

			const spy = sinon.spy()
			SshSessionRegistry.onDidChange(spy)

			SshSessionRegistry.delete("t1")
			spy.calledOnce.should.be.true()
		})

		it("returned dispose function unregisters the listener", () => {
			const spy = sinon.spy()
			const dispose = SshSessionRegistry.onDidChange(spy)
			dispose()

			SshSessionRegistry.setMetadata("t1", { host: "h", port: 22, user: "u", connectedAt: 0 })

			spy.called.should.be.false()
		})
	})

	describe("delete()", () => {
		it("removes metadata when session is deleted", () => {
			const mockClient = { end: sinon.stub() }
			SshSessionRegistry.set("t1", mockClient)
			SshSessionRegistry.setMetadata("t1", { host: "h", port: 22, user: "u", connectedAt: 0 })

			SshSessionRegistry.delete("t1")

			SshSessionRegistry.getActiveSessions().should.have.length(0)
		})

		it("calls client.end() on delete", () => {
			const mockClient = { end: sinon.stub() }
			SshSessionRegistry.set("t1", mockClient)
			SshSessionRegistry.delete("t1")
			mockClient.end.calledOnce.should.be.true()
		})
	})
})
