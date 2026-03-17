import type { MessageStateHandler } from "@core/task/message-state"
import type { WorkspaceRootManager } from "@core/workspace/WorkspaceRootManager"
import { expect } from "chai"
import sinon from "sinon"
import * as telemetry from "../../../services/telemetry"
import CheckpointTracker from "../CheckpointTracker"
import { MultiRootCheckpointManager } from "../MultiRootCheckpointManager"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal WorkspaceRootManager mock */
function makeWorkspaceManager(roots: Array<{ path: string; name: string }>, primaryIndex = 0): WorkspaceRootManager {
	return {
		getRoots: () => roots as any[],
		getPrimaryRoot: () => roots[primaryIndex] as any,
	} as unknown as WorkspaceRootManager
}

function makeMessageStateHandler(): MessageStateHandler {
	return {} as unknown as MessageStateHandler
}

/** Fake CheckpointTracker — all methods are sinon stubs */
function makeFakeTracker() {
	return {
		commit: sinon.stub().resolves("abc123"),
		listCheckpoints: sinon.stub().resolves(["sha3", "sha2", "sha1"]),
		dispose: sinon.stub().resolves(),
		resetHead: sinon.stub().resolves(),
		getDiffSet: sinon.stub().resolves([]),
		getDiffCount: sinon.stub().resolves(0),
		getShadowGitConfigWorkTree: sinon.stub().resolves("/fake/worktree"),
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MultiRootCheckpointManager", () => {
	let sandbox: sinon.SinonSandbox
	let createStub: sinon.SinonStub
	let fakeTracker: ReturnType<typeof makeFakeTracker>
	let fakeTelemetry: { captureMultiRootCheckpoint: sinon.SinonStub }

	beforeEach(() => {
		sandbox = sinon.createSandbox()
		fakeTracker = makeFakeTracker()
		// Intercept every CheckpointTracker.create call — return the fake tracker
		createStub = sandbox.stub(CheckpointTracker, "create").resolves(fakeTracker as any)
		// Stub telemetry to avoid real network/service calls in tests
		fakeTelemetry = { captureMultiRootCheckpoint: sinon.stub() }
		sandbox.stub(telemetry, "getTelemetryService").resolves(fakeTelemetry as any)
	})

	afterEach(() => {
		sandbox.restore()
	})

	// -------------------------------------------------------------------------
	// 1. Save checkpoint — creates a Git commit
	// -------------------------------------------------------------------------
	describe("saveCheckpoint", () => {
		it("lazily initializes and triggers a commit on first call", async () => {
			const wr = makeWorkspaceManager([{ path: "/r1", name: "root1" }])
			const manager = new MultiRootCheckpointManager(wr, "task1", true, makeMessageStateHandler())

			expect((manager as any).initialized).to.equal(false)

			await manager.saveCheckpoint()

			// Initialization must have occurred
			expect(createStub.calledOnce).to.be.true
			expect((manager as any).initialized).to.equal(true)

			// saveCheckpoint fires commits in background — wait a tick
			await new Promise<void>((resolve) => setTimeout(resolve, 20))
			expect(fakeTracker.commit.calledOnce).to.be.true
		})

		it("reuses the already-initialized provider on subsequent calls", async () => {
			const wr = makeWorkspaceManager([{ path: "/r1", name: "root1" }])
			const manager = new MultiRootCheckpointManager(wr, "task1", true, makeMessageStateHandler())

			await manager.saveCheckpoint()
			await manager.saveCheckpoint()

			// CheckpointTracker.create should only be called once
			expect(createStub.callCount).to.equal(1)
		})

		it("does nothing when checkpoints are disabled", async () => {
			const wr = makeWorkspaceManager([{ path: "/r1", name: "root1" }])
			const manager = new MultiRootCheckpointManager(wr, "task1", false, makeMessageStateHandler())

			await manager.saveCheckpoint()

			expect(createStub.called).to.be.false
		})
	})

	// -------------------------------------------------------------------------
	// 2. Restore checkpoint — delegates to the primary root tracker
	// -------------------------------------------------------------------------
	describe("restoreCheckpoint", () => {
		it("initializes lazily and returns a result without throwing", async () => {
			const wr = makeWorkspaceManager([{ path: "/r1", name: "root1" }])
			const manager = new MultiRootCheckpointManager(wr, "task1", true, makeMessageStateHandler())

			const result = await manager.restoreCheckpoint(0, "restore")

			// After restore, initialized should be true
			expect((manager as any).initialized).to.equal(true)
			// The current implementation returns an empty object for the primary root
			expect(result).to.be.an("object")
		})
	})

	// -------------------------------------------------------------------------
	// 3. List checkpoints — returns ordered list of saved SHAs
	// -------------------------------------------------------------------------
	describe("listCheckpoints", () => {
		it("returns ordered list of checkpoint SHAs from the primary root", async () => {
			const wr = makeWorkspaceManager([{ path: "/r1", name: "root1" }])
			const manager = new MultiRootCheckpointManager(wr, "task1", true, makeMessageStateHandler())

			fakeTracker.listCheckpoints.resolves(["sha3", "sha2", "sha1"])
			const result = await manager.listCheckpoints()

			expect(result).to.deep.equal(["sha3", "sha2", "sha1"])
		})

		it("returns empty array when there is no primary root configured", async () => {
			const wr = {
				getRoots: () => [] as any[],
				getPrimaryRoot: () => undefined,
			} as unknown as WorkspaceRootManager
			const manager = new MultiRootCheckpointManager(wr, "task1", true, makeMessageStateHandler())

			const result = await manager.listCheckpoints()
			expect(result).to.deep.equal([])
		})
	})

	// -------------------------------------------------------------------------
	// 4. Dispose — releases resources; initialized resets to false
	// -------------------------------------------------------------------------
	describe("dispose", () => {
		it("calls dispose() on every tracker and resets internal state", async () => {
			const wr = makeWorkspaceManager([{ path: "/r1", name: "root1" }])
			const manager = new MultiRootCheckpointManager(wr, "task1", true, makeMessageStateHandler())

			await manager.initialize()
			expect((manager as any).initialized).to.equal(true)
			expect((manager as any).trackers.size).to.equal(1)

			await manager.dispose()

			expect(fakeTracker.dispose.calledOnce).to.be.true
			expect((manager as any).initialized).to.equal(false)
			expect((manager as any).trackers.size).to.equal(0)
		})

		it("is safe to call dispose() multiple times without throwing", async () => {
			const wr = makeWorkspaceManager([{ path: "/r1", name: "root1" }])
			const manager = new MultiRootCheckpointManager(wr, "task1", true, makeMessageStateHandler())

			await manager.initialize()
			await manager.dispose()
			// Second dispose: no trackers remain, should be a no-op
			await manager.dispose()

			// dispose on the fake tracker was only called once (from first dispose)
			expect(fakeTracker.dispose.callCount).to.equal(1)
		})
	})

	// -------------------------------------------------------------------------
	// 5. Multi-root — two workspace roots get independent checkpoint trackers
	// -------------------------------------------------------------------------
	describe("multi-root support", () => {
		it("creates independent trackers for every workspace root", async () => {
			const roots = [
				{ path: "/r1", name: "root1" },
				{ path: "/r2", name: "root2" },
			]
			const wr = makeWorkspaceManager(roots)
			const manager = new MultiRootCheckpointManager(wr, "task1", true, makeMessageStateHandler())

			await manager.initialize()

			// CheckpointTracker.create must be called once per root
			expect(createStub.callCount).to.equal(2)
			const calledPaths = createStub.args.map((args: any[]) => args[2])
			expect(calledPaths).to.include("/r1")
			expect(calledPaths).to.include("/r2")
		})
	})
})
