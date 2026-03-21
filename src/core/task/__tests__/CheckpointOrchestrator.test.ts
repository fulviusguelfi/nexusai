import { expect } from "chai"
import sinon from "sinon"
import type { CheckpointOrchestratorDeps } from "../services/CheckpointOrchestrator"
import { CheckpointOrchestrator } from "../services/CheckpointOrchestrator"

function makeDeps(overrides: Partial<CheckpointOrchestratorDeps> = {}): CheckpointOrchestratorDeps {
	return {
		taskId: "test-task",
		taskState: { checkpointManagerErrorMessage: undefined, conversationHistoryDeletedRange: undefined } as any,
		messageStateHandler: { getClineMessages: sinon.stub().returns([]), updateClineMessage: sinon.stub().resolves() } as any,
		fileContextTracker: {} as any,
		diffViewProvider: {} as any,
		workspaceManager: { getRoots: sinon.stub().returns(["/root"]) } as any,
		stateManager: { getGlobalSettingsKey: sinon.stub().returns(false) } as any,
		updateTaskHistory: sinon.stub().resolves([]),
		say: sinon.stub().resolves(),
		cancelTask: sinon.stub().resolves(),
		postStateToWebview: sinon.stub().resolves(),
		...overrides,
	}
}

describe("CheckpointOrchestrator", () => {
	let sandbox: sinon.SinonSandbox

	beforeEach(() => {
		sandbox = sinon.createSandbox()
	})

	afterEach(() => {
		sandbox.restore()
	})

	describe("saveCheckpoint()", () => {
		it("resolves immediately when checkpointManager is undefined", async () => {
			const deps = makeDeps()
			const orchestrator = new CheckpointOrchestrator(deps)
			// checkpointManager is undefined (buildCheckpointManager not called because stateManager returns false)
			// resolves immediately — no throw is the assertion
			await orchestrator.saveCheckpoint()
		})

		it("delegates to checkpointManager.saveCheckpoint when manager exists", async () => {
			const saveCheckpoint = sinon.stub().resolves()
			const deps = makeDeps()
			const orchestrator = new CheckpointOrchestrator(deps)
			// Inject a fake manager
			;(orchestrator as any)._checkpointManager = { saveCheckpoint }
			await orchestrator.saveCheckpoint(true, 12345)
			expect(saveCheckpoint.calledOnceWith(true, 12345)).to.be.true
		})
	})

	describe("waitForInitialCommitIfNeeded()", () => {
		it("does nothing when no pending commit promise", async () => {
			const orchestrator = new CheckpointOrchestrator(makeDeps())
			// resolves immediately — no throw is the assertion
			await orchestrator.waitForInitialCommitIfNeeded("write_to_file")
		})

		it("awaits pending promise for unsafe (write) tools", async () => {
			const orchestrator = new CheckpointOrchestrator(makeDeps())
			let resolved = false
			const promise = new Promise<string | undefined>((res) =>
				setTimeout(() => {
					resolved = true
					res(undefined)
				}, 10),
			)
			;(orchestrator as any)._initialCheckpointCommitPromise = promise
			await orchestrator.waitForInitialCommitIfNeeded("write_to_file")
			expect(resolved).to.be.true
			expect((orchestrator as any)._initialCheckpointCommitPromise).to.be.undefined
		})
	})

	describe("maybeRunFirstRequestInit()", () => {
		it("does nothing when isFirstRequest is false", () => {
			const deps = makeDeps()
			const orchestrator = new CheckpointOrchestrator(deps)
			orchestrator.maybeRunFirstRequestInit(false)
			expect((orchestrator as any)._initialCheckpointCommitPromise).to.be.undefined
		})

		it("does nothing when checkpoints are disabled", () => {
			const deps = makeDeps()
			const orchestrator = new CheckpointOrchestrator(deps)
			orchestrator.maybeRunFirstRequestInit(true) // stateManager returns false for enableCheckpointsSetting
			expect((orchestrator as any)._initialCheckpointCommitPromise).to.be.undefined
		})
	})
})
