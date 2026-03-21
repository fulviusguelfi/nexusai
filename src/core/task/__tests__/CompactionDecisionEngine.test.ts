import { expect } from "chai"
import sinon from "sinon"
import type { CompactionDecisionDeps } from "../services/CompactionDecisionEngine"
import { CompactionDecisionEngine } from "../services/CompactionDecisionEngine"

function makeDeps(overrides: Partial<CompactionDecisionDeps> = {}): CompactionDecisionDeps {
	const getGlobalSettingsKey = sinon.stub().callsFake((key: string) => {
		if (key === "useAutoCondense") {
			return true
		}
		return undefined
	})

	return {
		taskId: "test-task",
		taskState: {
			currentlySummarizing: false,
			conversationHistoryDeletedRange: undefined,
		} as any,
		messageStateHandler: {
			getApiConversationHistory: sinon.stub().returns([]),
			getClineMessages: sinon.stub().returns([]),
			saveClineMessagesAndUpdateHistory: sinon.stub().resolves(),
		} as any,
		contextManager: {
			shouldCompactContextWindow: sinon.stub().returns(false),
			attemptFileReadOptimization: sinon.stub().resolves(false),
		} as any,
		stateManager: {
			getGlobalSettingsKey,
		} as any,
		api: {
			getModel: sinon.stub().returns({ id: "gpt-5" }),
		} as any,
		getCurrentProviderInfo: () => ({
			providerId: "ollama",
			model: { id: "gpt-5", info: {} as any },
			mode: "act" as any,
			customPrompt: "compact",
		}),
		...overrides,
	}
}

describe("CompactionDecisionEngine", () => {
	let sandbox: sinon.SinonSandbox

	beforeEach(() => {
		sandbox = sinon.createSandbox()
	})

	afterEach(() => {
		sandbox.restore()
	})

	it("returns useCompactPrompt=true for local provider with compact prompt", async () => {
		const engine = new CompactionDecisionEngine(makeDeps())
		const result = await engine.decide(0)
		expect(result.useCompactPrompt).to.be.true
	})

	it("does not compact when auto-condense is disabled", async () => {
		const contextManager = {
			shouldCompactContextWindow: sinon.stub().returns(true),
			attemptFileReadOptimization: sinon.stub().resolves(true),
		}
		const engine = new CompactionDecisionEngine(
			makeDeps({
				stateManager: { getGlobalSettingsKey: sinon.stub().returns(false) } as any,
				contextManager: contextManager as any,
			}),
		)

		const result = await engine.decide(0)
		expect(result.shouldCompact).to.be.false
		expect(contextManager.shouldCompactContextWindow.called).to.be.false
	})

	it("increments deleted range after summarization and saves messages", async () => {
		const saveStub = sinon.stub().resolves()
		const taskState = {
			currentlySummarizing: true,
			conversationHistoryDeletedRange: [0, 2] as [number, number],
		} as any
		const messageStateHandler = {
			getApiConversationHistory: sinon.stub().returns([{}, {}, {}, {}, {}]),
			getClineMessages: sinon.stub().returns([]),
			saveClineMessagesAndUpdateHistory: saveStub,
		} as any

		const engine = new CompactionDecisionEngine(
			makeDeps({
				taskState,
				messageStateHandler,
			}),
		)

		await engine.decide(0)
		expect(taskState.currentlySummarizing).to.be.false
		expect(taskState.conversationHistoryDeletedRange).to.deep.equal([0, 4])
		expect(saveStub.calledOnce).to.be.true
	})

	it("prevents compact when active message count is <= 2", async () => {
		const attemptStub = sinon.stub().resolves(true)
		const engine = new CompactionDecisionEngine(
			makeDeps({
				taskState: {
					currentlySummarizing: false,
					conversationHistoryDeletedRange: [0, 2],
				} as any,
				messageStateHandler: {
					getApiConversationHistory: sinon.stub().returns([{}, {}, {}, {}, {}]),
					getClineMessages: sinon.stub().returns([]),
					saveClineMessagesAndUpdateHistory: sinon.stub().resolves(),
				} as any,
				contextManager: {
					shouldCompactContextWindow: sinon.stub().returns(true),
					attemptFileReadOptimization: attemptStub,
				} as any,
			}),
		)

		const result = await engine.decide(0)
		expect(result.shouldCompact).to.be.false
		expect(attemptStub.called).to.be.false
	})
})
