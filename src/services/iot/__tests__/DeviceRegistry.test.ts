import { afterEach, beforeEach, describe, it } from "mocha"
import "should"
import type { DeviceProfile } from "@shared/iot/DeviceProfile"
import { DeviceProtocol, DeviceType } from "@shared/iot/DeviceProfile"
import sinon from "sinon"
import { DeviceRegistry } from "../DeviceRegistry"

/** Build a minimal DeviceProfile for testing */
function makeDevice(overrides: Partial<DeviceProfile> = {}): DeviceProfile {
	return {
		id: "d1",
		name: "Test Device",
		ip: "192.168.1.100",
		type: DeviceType.COMPUTER,
		protocol: DeviceProtocol.SSH,
		capabilities: [],
		lastSeen: 1000,
		trustedLocal: false,
		...overrides,
	}
}

/** Build a minimal mock ExtensionContext backed by a plain Map */
function makeMockContext(): any {
	const store = new Map<string, unknown>()
	return {
		globalState: {
			get: (key: string, defaultValue?: unknown) => {
				const val = store.get(key)
				return val !== undefined ? val : defaultValue
			},
			update: async (key: string, value: unknown) => {
				store.set(key, value)
			},
		},
	}
}

/** Reset the static context so each test starts fresh */
function resetRegistry(): void {
	const reg = DeviceRegistry as any
	reg.context = undefined
	reg.changeListeners.clear()
}

describe("DeviceRegistry", () => {
	beforeEach(() => {
		resetRegistry()
		DeviceRegistry.initialize(makeMockContext())
	})

	afterEach(() => {
		resetRegistry()
		sinon.restore()
	})

	describe("getAll()", () => {
		it("returns empty array when no devices registered", () => {
			DeviceRegistry.getAll().should.deepEqual([])
		})
	})

	describe("upsert() / getAll()", () => {
		it("adds a device and retrieves it", async () => {
			const dev = makeDevice()
			await DeviceRegistry.upsert(dev)

			const all = DeviceRegistry.getAll()
			all.should.have.length(1)
			all[0].id.should.equal("d1")
			all[0].name.should.equal("Test Device")
		})

		it("updates an existing device with the same id", async () => {
			await DeviceRegistry.upsert(makeDevice({ name: "Old Name" }))
			await DeviceRegistry.upsert(makeDevice({ name: "New Name" }))

			const all = DeviceRegistry.getAll()
			all.should.have.length(1)
			all[0].name.should.equal("New Name")
		})

		it("adds multiple distinct devices", async () => {
			await DeviceRegistry.upsert(makeDevice({ id: "a", ip: "192.168.1.1" }))
			await DeviceRegistry.upsert(makeDevice({ id: "b", ip: "192.168.1.2" }))

			DeviceRegistry.getAll().should.have.length(2)
		})
	})

	describe("getById()", () => {
		it("returns the device when found", async () => {
			await DeviceRegistry.upsert(makeDevice({ id: "x" }))
			const d = DeviceRegistry.getById("x")
			d!.id.should.equal("x")
		})

		it("returns undefined when not found", () => {
			const d = DeviceRegistry.getById("missing")
			;(d === undefined).should.be.true()
		})
	})

	describe("getByIp()", () => {
		it("returns device matching the IP", async () => {
			await DeviceRegistry.upsert(makeDevice({ ip: "10.0.0.5" }))
			const d = DeviceRegistry.getByIp("10.0.0.5")
			d!.ip.should.equal("10.0.0.5")
		})

		it("returns undefined for unknown IP", () => {
			;(DeviceRegistry.getByIp("10.0.0.99") === undefined).should.be.true()
		})
	})

	describe("remove()", () => {
		it("removes a device by id", async () => {
			await DeviceRegistry.upsert(makeDevice({ id: "del" }))
			await DeviceRegistry.remove("del")
			DeviceRegistry.getAll().should.have.length(0)
		})

		it("does not throw when removing a non-existent id", async () => {
			await DeviceRegistry.remove("ghost") // should not throw
		})
	})

	describe("onDidChange()", () => {
		it("fires listener when upsert is called", async () => {
			const spy = sinon.spy()
			DeviceRegistry.onDidChange(spy)
			await DeviceRegistry.upsert(makeDevice())
			spy.calledOnce.should.be.true()
		})

		it("fires listener when remove is called", async () => {
			await DeviceRegistry.upsert(makeDevice({ id: "rm" }))
			const spy = sinon.spy()
			DeviceRegistry.onDidChange(spy)
			await DeviceRegistry.remove("rm")
			spy.calledOnce.should.be.true()
		})

		it("dispose function stops notifications", async () => {
			const spy = sinon.spy()
			const dispose = DeviceRegistry.onDidChange(spy)
			dispose()
			await DeviceRegistry.upsert(makeDevice())
			spy.called.should.be.false()
		})
	})

	describe("without initialize()", () => {
		it("getAll() returns empty array when context is not set", () => {
			resetRegistry() // context = undefined
			DeviceRegistry.getAll().should.deepEqual([])
		})
	})
})
