import { expect } from "chai"
import sinon from "sinon"
import { StreamMetricsCollector } from "../services/StreamMetricsCollector"

describe("StreamMetricsCollector", () => {
	let sandbox: sinon.SinonSandbox

	beforeEach(() => {
		sandbox = sinon.createSandbox()
	})

	afterEach(() => {
		sandbox.restore()
	})

	it("accumulates usage metrics and marks usage as received", async () => {
		const updateClineMessage = sandbox.stub().resolves()
		const postStateToWebview = sandbox.stub().resolves()
		const captureTokenUsage = sandbox.stub().resolves()

		const collector = new StreamMetricsCollector({
			taskId: "task-1",
			ulid: "ulid-1",
			modelId: "gpt-5",
			api: { getModel: () => ({ id: "gpt-5", info: {} as any }) } as any,
			messageStateHandler: {
				getClineMessages: () => [{ text: "{}" }],
				updateClineMessage,
			} as any,
			lastApiReqIndex: 0,
			postStateToWebview,
			isTaskAborted: () => false,
			captureTokenUsage,
		})

		collector.handleUsageChunk({
			type: "usage",
			inputTokens: 10,
			outputTokens: 5,
			cacheWriteTokens: 2,
			cacheReadTokens: 3,
			totalCost: 1.5,
		})

		await collector.flushQueuedSideEffects()

		expect(collector.hasReceivedUsageChunk()).to.be.true
		expect(collector.metrics.inputTokens).to.equal(10)
		expect(collector.metrics.outputTokens).to.equal(5)
		expect(collector.metrics.cacheWriteTokens).to.equal(2)
		expect(collector.metrics.cacheReadTokens).to.equal(3)
		expect(collector.metrics.totalCost).to.equal(1.5)
		expect(postStateToWebview.called).to.be.true
	})

	it("skips queued side effects when task is aborted", async () => {
		const updateClineMessage = sandbox.stub().resolves()
		const postStateToWebview = sandbox.stub().resolves()
		const captureTokenUsage = sandbox.stub().resolves()

		const collector = new StreamMetricsCollector({
			taskId: "task-1",
			ulid: "ulid-1",
			modelId: "gpt-5",
			api: { getModel: () => ({ id: "gpt-5", info: {} as any }) } as any,
			messageStateHandler: {
				getClineMessages: () => [{ text: "{}" }],
				updateClineMessage,
			} as any,
			lastApiReqIndex: 0,
			postStateToWebview,
			isTaskAborted: () => true,
			captureTokenUsage,
		})

		collector.handleUsageChunk({ type: "usage", inputTokens: 3, outputTokens: 4 })
		await collector.flushQueuedSideEffects()

		expect(postStateToWebview.called).to.be.false
		expect(captureTokenUsage.called).to.be.false
	})

	it("finalizes api_req message with cancel reason", async () => {
		const updateClineMessage = sandbox.stub().resolves()
		const postStateToWebview = sandbox.stub().resolves()
		const captureTokenUsage = sandbox.stub().resolves()

		const collector = new StreamMetricsCollector({
			taskId: "task-1",
			ulid: "ulid-1",
			modelId: "gpt-5",
			api: { getModel: () => ({ id: "gpt-5", info: {} as any }) } as any,
			messageStateHandler: {
				getClineMessages: () => [{ text: "{}" }],
				updateClineMessage,
			} as any,
			lastApiReqIndex: 0,
			postStateToWebview,
			isTaskAborted: () => false,
			captureTokenUsage,
		})

		collector.handleUsageChunk({ type: "usage", inputTokens: 7, outputTokens: 8, totalCost: 2.25 })
		await collector.finalizeApiReqMsg("user_cancelled")

		expect(updateClineMessage.called).to.be.true
		const updatePayload = updateClineMessage.lastCall.args[1]
		const parsed = JSON.parse(updatePayload.text)
		expect(parsed.tokensIn).to.equal(7)
		expect(parsed.tokensOut).to.equal(8)
		expect(parsed.cancelReason).to.equal("user_cancelled")
		expect(parsed.cost).to.equal(2.25)
	})
})
