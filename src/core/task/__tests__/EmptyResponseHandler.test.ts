import { expect } from "chai"
import sinon from "sinon"
import { EmptyResponseHandler, type EmptyResponseHandlerDeps } from "../services/EmptyResponseHandler"

function makeDeps(overrides: Partial<EmptyResponseHandlerDeps> = {}): EmptyResponseHandlerDeps {
	return {
		ulid: "ulid-1",
		useNativeToolCalls: () => false,
		getCurrentProviderInfo: () => ({ model: { id: "gpt-5" }, providerId: "openai" }),
		getApiRequestIdSafe: () => "req-123",
		say: sinon.stub().resolves(),
		ask: sinon.stub().resolves({ response: "noButtonClicked" }),
		messageStateHandler: {
			addToApiConversationHistory: sinon.stub().resolves(),
		} as any,
		captureProviderApiError: sinon.stub().resolves(),
		...overrides,
	}
}

describe("EmptyResponseHandler", () => {
	let sandbox: sinon.SinonSandbox

	beforeEach(() => {
		sandbox = sinon.createSandbox()
	})

	afterEach(() => {
		sandbox.restore()
	})

	it("auto-retries when under retry limit", async () => {
		const clock = sandbox.useFakeTimers()
		const deps = makeDeps()
		const handler = new EmptyResponseHandler(deps)
		const taskState = { autoRetryAttempts: 0 }

		const resultPromise = handler.handle({
			taskState,
			modelInfo: { modelId: "gpt-5", providerId: "openai", mode: "act" as any },
			requestId: "req-123",
			taskMetrics: {
				cacheWriteTokens: 0,
				cacheReadTokens: 0,
				inputTokens: 10,
				outputTokens: 20,
				totalCost: 1,
			},
		})

		await clock.tickAsync(2000)
		const result = await resultPromise

		expect(result).to.be.false
		expect(taskState.autoRetryAttempts).to.equal(1)
		expect((deps.say as sinon.SinonStub).calledWith("error_retry")).to.be.true
	})

	it("ends loop when retries exhausted and user declines retry", async () => {
		const deps = makeDeps({
			ask: sinon.stub().resolves({ response: "noButtonClicked" }),
		})
		const handler = new EmptyResponseHandler(deps)
		const taskState = { autoRetryAttempts: 3 }

		const result = await handler.handle({
			taskState,
			modelInfo: { modelId: "gpt-5", providerId: "openai", mode: "act" as any },
			requestId: "req-123",
			taskMetrics: {
				cacheWriteTokens: 0,
				cacheReadTokens: 0,
				inputTokens: 10,
				outputTokens: 20,
				totalCost: 1,
			},
		})

		expect(result).to.be.true
	})

	it("continues loop and resets retries when user approves manual retry", async () => {
		const deps = makeDeps({
			ask: sinon.stub().resolves({ response: "yesButtonClicked" }),
		})
		const handler = new EmptyResponseHandler(deps)
		const taskState = { autoRetryAttempts: 3 }

		const result = await handler.handle({
			taskState,
			modelInfo: { modelId: "gpt-5", providerId: "openai", mode: "act" as any },
			requestId: "req-123",
			taskMetrics: {
				cacheWriteTokens: 0,
				cacheReadTokens: 0,
				inputTokens: 10,
				outputTokens: 20,
				totalCost: 1,
			},
		})

		expect(result).to.be.false
		expect(taskState.autoRetryAttempts).to.equal(0)
	})
})
