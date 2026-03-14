import { afterEach, beforeEach, describe, it } from "mocha"
import "should"
import sinon from "sinon"
import { MqttConnectionRegistry } from "../MqttConnectionRegistry"

function clearRegistry(): void {
	const reg = MqttConnectionRegistry as any
	reg.clients.clear()
	reg.metadata.clear()
	reg.changeListeners.clear()
}

describe("MqttConnectionRegistry", () => {
	beforeEach(clearRegistry)

	afterEach(() => {
		clearRegistry()
		sinon.restore()
	})

	describe("getActiveSessions()", () => {
		it("returns empty array when no sessions registered", () => {
			MqttConnectionRegistry.getActiveSessions().should.deepEqual([])
		})
	})

	describe("set() / get() / has()", () => {
		it("stores and retrieves an MQTT client", () => {
			const mockClient = { end: sinon.stub() }
			MqttConnectionRegistry.set("task-1", mockClient)

			MqttConnectionRegistry.has("task-1").should.be.true()
			MqttConnectionRegistry.get("task-1").should.equal(mockClient)
		})

		it("has() returns false for unknown taskId", () => {
			MqttConnectionRegistry.has("ghost").should.be.false()
		})
	})

	describe("setMetadata() / getActiveSessions()", () => {
		it("stores session metadata and includes it in getActiveSessions()", () => {
			MqttConnectionRegistry.setMetadata("task-1", {
				broker: "mqtt://localhost",
				port: 1883,
				clientId: "nexusai-task-1",
				connectedAt: 1000,
			})

			const sessions = MqttConnectionRegistry.getActiveSessions()
			sessions.should.have.length(1)
			sessions[0].taskId.should.equal("task-1")
			sessions[0].broker.should.equal("mqtt://localhost")
		})

		it("returns multiple sessions when multiple are set", () => {
			MqttConnectionRegistry.setMetadata("t1", { broker: "b1", port: 1883, clientId: "c1", connectedAt: 1 })
			MqttConnectionRegistry.setMetadata("t2", { broker: "b2", port: 1883, clientId: "c2", connectedAt: 2 })

			MqttConnectionRegistry.getActiveSessions().should.have.length(2)
		})
	})

	describe("delete()", () => {
		it("calls client.end() and removes both client and metadata", () => {
			const mockClient = { end: sinon.stub() }
			MqttConnectionRegistry.set("task-1", mockClient)
			MqttConnectionRegistry.setMetadata("task-1", {
				broker: "mqtt://host",
				port: 1883,
				clientId: "c1",
				connectedAt: 0,
			})

			MqttConnectionRegistry.delete("task-1")

			mockClient.end.calledOnce.should.be.true()
			MqttConnectionRegistry.has("task-1").should.be.false()
			MqttConnectionRegistry.getActiveSessions().should.have.length(0)
		})

		it("does not throw when deleting unknown taskId", () => {
			MqttConnectionRegistry.delete("ghost") // should not throw
		})
	})

	describe("onDidChange()", () => {
		it("fires listener when setMetadata() is called", () => {
			const spy = sinon.spy()
			MqttConnectionRegistry.onDidChange(spy)

			MqttConnectionRegistry.setMetadata("t1", { broker: "b", port: 1883, clientId: "c", connectedAt: 0 })

			spy.calledOnce.should.be.true()
		})

		it("fires listener when delete() is called", () => {
			const mockClient = { end: sinon.stub() }
			MqttConnectionRegistry.set("t1", mockClient)
			MqttConnectionRegistry.setMetadata("t1", { broker: "b", port: 1883, clientId: "c", connectedAt: 0 })

			const spy = sinon.spy()
			MqttConnectionRegistry.onDidChange(spy)

			MqttConnectionRegistry.delete("t1")
			spy.calledOnce.should.be.true()
		})

		it("dispose function stops future notifications", () => {
			const spy = sinon.spy()
			const dispose = MqttConnectionRegistry.onDidChange(spy)
			dispose()

			MqttConnectionRegistry.setMetadata("t1", { broker: "b", port: 1883, clientId: "c", connectedAt: 0 })

			spy.called.should.be.false()
		})
	})
})
