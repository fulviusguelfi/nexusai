import { afterEach, beforeEach, describe, it } from "mocha"
import "should"
import type { SshServerProfile } from "@shared/ssh/SshServerProfile"
import sinon from "sinon"
import { SshServerProfileRegistry } from "../SshServerProfileRegistry"

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<SshServerProfile> = {}): SshServerProfile {
	return {
		id: "larry",
		name: "Larry",
		host: "192.168.0.225",
		port: 22,
		user: "larry",
		authType: "password",
		...overrides,
	}
}

function makeMockContext(): any {
	const store = new Map<string, unknown>()
	const secrets = new Map<string, string>()
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
		secrets: {
			get: async (key: string): Promise<string | undefined> => secrets.get(key),
			store: async (key: string, value: string) => {
				secrets.set(key, value)
			},
			delete: async (key: string) => {
				secrets.delete(key)
			},
		},
	}
}

function resetRegistry(): void {
	const reg = SshServerProfileRegistry as any
	reg.context = undefined
	reg.changeListeners.clear()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SshServerProfileRegistry", () => {
	beforeEach(() => {
		resetRegistry()
		SshServerProfileRegistry.initialize(makeMockContext())
	})

	afterEach(() => {
		resetRegistry()
		sinon.restore()
	})

	// ── getAll ────────────────────────────────────────────────────────────────

	describe("getAll()", () => {
		it("returns empty array when no profiles registered", () => {
			SshServerProfileRegistry.getAll().should.deepEqual([])
		})

		it("returns empty array when registry is not initialized", () => {
			resetRegistry() // remove context
			SshServerProfileRegistry.getAll().should.deepEqual([])
		})
	})

	// ── upsert / getAll ───────────────────────────────────────────────────────

	describe("upsert() / getAll()", () => {
		it("adds a profile and retrieves it", async () => {
			await SshServerProfileRegistry.upsert(makeProfile(), "secret")

			const all = SshServerProfileRegistry.getAll()
			all.should.have.length(1)
			all[0].id.should.equal("larry")
			all[0].name.should.equal("Larry")
			all[0].host.should.equal("192.168.0.225")
		})

		it("updates existing profile with same id", async () => {
			await SshServerProfileRegistry.upsert(makeProfile({ host: "10.0.0.1" }), "cred")
			await SshServerProfileRegistry.upsert(makeProfile({ host: "10.0.0.2" }), "cred")

			const all = SshServerProfileRegistry.getAll()
			all.should.have.length(1)
			all[0].host.should.equal("10.0.0.2")
		})

		it("adds multiple distinct profiles", async () => {
			await SshServerProfileRegistry.upsert(makeProfile({ id: "alpha", name: "Alpha" }), "c1")
			await SshServerProfileRegistry.upsert(makeProfile({ id: "beta", name: "Beta" }), "c2")

			SshServerProfileRegistry.getAll().should.have.length(2)
		})

		it("updates lastConnectedAt on re-upsert", async () => {
			await SshServerProfileRegistry.upsert(makeProfile({ lastConnectedAt: 1000 }), "cred")
			await SshServerProfileRegistry.upsert(makeProfile({ lastConnectedAt: 9999 }), "cred")

			const all = SshServerProfileRegistry.getAll()
			all[0].lastConnectedAt!.should.equal(9999)
		})
	})

	// ── getByName ────────────────────────────────────────────────────────────

	describe("getByName()", () => {
		it("finds profile by display name (case-insensitive)", async () => {
			await SshServerProfileRegistry.upsert(makeProfile(), "cred")
			const p = SshServerProfileRegistry.getByName("LARRY")
			p!.id.should.equal("larry")
		})

		it("finds profile by id slug", async () => {
			await SshServerProfileRegistry.upsert(makeProfile(), "cred")
			const p = SshServerProfileRegistry.getByName("larry")
			p!.id.should.equal("larry")
		})

		it("trims whitespace before matching", async () => {
			await SshServerProfileRegistry.upsert(makeProfile(), "cred")
			const p = SshServerProfileRegistry.getByName("  larry  ")
			p!.id.should.equal("larry")
		})

		it("returns undefined for unknown name", async () => {
			await SshServerProfileRegistry.upsert(makeProfile(), "cred")
			const p = SshServerProfileRegistry.getByName("unknown-server")
			;(p === undefined).should.be.true()
		})

		it("returns undefined when registry is empty", () => {
			const p = SshServerProfileRegistry.getByName("larry")
			;(p === undefined).should.be.true()
		})
	})

	// ── getCredential ────────────────────────────────────────────────────────

	describe("getCredential()", () => {
		it("returns the stored credential", async () => {
			await SshServerProfileRegistry.upsert(makeProfile(), "super-secret-pw")
			const cred = await SshServerProfileRegistry.getCredential("larry")
			cred!.should.equal("super-secret-pw")
		})

		it("returns undefined for unknown id", async () => {
			const cred = await SshServerProfileRegistry.getCredential("nonexistent")
			;(cred === undefined).should.be.true()
		})

		it("returns undefined when registry is not initialized", async () => {
			resetRegistry()
			const cred = await SshServerProfileRegistry.getCredential("larry")
			;(cred === undefined).should.be.true()
		})

		it("updates credential on re-upsert", async () => {
			await SshServerProfileRegistry.upsert(makeProfile(), "old-password")
			await SshServerProfileRegistry.upsert(makeProfile(), "new-password")
			const cred = await SshServerProfileRegistry.getCredential("larry")
			cred!.should.equal("new-password")
		})
	})

	// ── remove ───────────────────────────────────────────────────────────────

	describe("remove()", () => {
		it("removes profile from the list", async () => {
			await SshServerProfileRegistry.upsert(makeProfile(), "cred")
			await SshServerProfileRegistry.remove("larry")
			SshServerProfileRegistry.getAll().should.deepEqual([])
		})

		it("removes credential from SecretStorage", async () => {
			await SshServerProfileRegistry.upsert(makeProfile(), "cred")
			await SshServerProfileRegistry.remove("larry")
			const c = await SshServerProfileRegistry.getCredential("larry")
			;(c === undefined).should.be.true()
		})

		it("only removes the targeted profile, leaving others intact", async () => {
			await SshServerProfileRegistry.upsert(makeProfile({ id: "srv1", name: "S1" }), "c1")
			await SshServerProfileRegistry.upsert(makeProfile({ id: "srv2", name: "S2" }), "c2")

			await SshServerProfileRegistry.remove("srv1")

			const all = SshServerProfileRegistry.getAll()
			all.should.have.length(1)
			all[0].id.should.equal("srv2")
		})

		it("is a no-op when id does not exist", async () => {
			await SshServerProfileRegistry.upsert(makeProfile(), "cred")
			await SshServerProfileRegistry.remove("nonexistent")
			SshServerProfileRegistry.getAll().should.have.length(1)
		})
	})

	// ── onDidChange ──────────────────────────────────────────────────────────

	describe("onDidChange()", () => {
		it("notifies listener on upsert", async () => {
			const spy = sinon.spy()
			SshServerProfileRegistry.onDidChange(spy)

			await SshServerProfileRegistry.upsert(makeProfile(), "cred")

			spy.calledOnce.should.be.true()
		})

		it("notifies listener on remove", async () => {
			await SshServerProfileRegistry.upsert(makeProfile(), "cred")

			const spy = sinon.spy()
			SshServerProfileRegistry.onDidChange(spy)
			await SshServerProfileRegistry.remove("larry")

			spy.calledOnce.should.be.true()
		})

		it("returned dispose function unregisters the listener", async () => {
			const spy = sinon.spy()
			const dispose = SshServerProfileRegistry.onDidChange(spy)
			dispose()

			await SshServerProfileRegistry.upsert(makeProfile(), "cred")

			spy.called.should.be.false()
		})

		it("multiple listeners are all notified", async () => {
			const spy1 = sinon.spy()
			const spy2 = sinon.spy()
			SshServerProfileRegistry.onDidChange(spy1)
			SshServerProfileRegistry.onDidChange(spy2)

			await SshServerProfileRegistry.upsert(makeProfile(), "cred")

			spy1.calledOnce.should.be.true()
			spy2.calledOnce.should.be.true()
		})
	})
})
