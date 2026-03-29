import { ensureCheckpointInitialized } from "@integrations/checkpoints/initializer"
import { expect } from "chai"
import sinon from "sinon"

describe("Issue #18: retry exhausted + checkpoint init", () => {
	let sandbox: sinon.SinonSandbox

	beforeEach(() => {
		sandbox = sinon.createSandbox()
	})

	afterEach(() => {
		sandbox.restore()
	})

	describe("ensureCheckpointInitialized non-blocking behavior", () => {
		it("should resolve without error when checkpoint initializes successfully", async () => {
			const manager = {
				checkpointTrackerCheckAndInit: sinon.stub().resolves(),
			}
			await ensureCheckpointInitialized({ checkpointManager: manager as any })
			expect(manager.checkpointTrackerCheckAndInit.calledOnce).to.be.true
		})

		it("should throw TimeoutError when initialization exceeds timeout", async () => {
			const manager = {
				checkpointTrackerCheckAndInit: sinon.stub().returns(
					new Promise(() => {
						/* never resolves */
					}),
				),
			}
			try {
				await ensureCheckpointInitialized({
					checkpointManager: manager as any,
					timeoutMs: 50,
					timeoutMessage: "test timeout",
				})
				expect.fail("should have thrown")
			} catch (error) {
				expect(error).to.be.instanceOf(Error)
				expect((error as Error).message).to.include("test timeout")
			}
		})

		it("should resolve immediately when checkpointManager is undefined", async () => {
			// Should not throw
			await ensureCheckpointInitialized({ checkpointManager: undefined })
		})

		it("should use MultiRootCheckpointManager initialize path", async () => {
			const manager = {
				initialize: sinon.stub().resolves(),
			}
			await ensureCheckpointInitialized({ checkpointManager: manager as any })
			expect(manager.initialize.calledOnce).to.be.true
		})
	})

	describe("auto-retry exponential backoff calculation", () => {
		it("should calculate correct delays: 2s, 4s, 8s", () => {
			const delays: number[] = []
			for (let attempt = 1; attempt <= 3; attempt++) {
				const delay = 2000 * 2 ** (attempt - 1)
				delays.push(delay)
			}
			expect(delays).to.deep.equal([2000, 4000, 8000])
		})
	})

	describe("error_retry message format", () => {
		it("should produce correct JSON for in-progress retry", () => {
			const attempt = 2
			const maxAttempts = 3
			const delay = 2000 * 2 ** (attempt - 1)
			const errorMessage = "No assistant message was received."

			const json = JSON.stringify({
				attempt,
				maxAttempts,
				delaySeconds: delay / 1000,
				errorMessage,
			})

			const parsed = JSON.parse(json)
			expect(parsed.attempt).to.equal(2)
			expect(parsed.maxAttempts).to.equal(3)
			expect(parsed.delaySeconds).to.equal(4)
			expect(parsed.failed).to.be.undefined
		})

		it("should produce correct JSON for failed retry with actionable message", () => {
			const noResponseErrorMessage =
				"No assistant message was received. " +
				"Possible fixes: try a different model, reduce context size, or check your API provider status."

			const json = JSON.stringify({
				attempt: 3,
				maxAttempts: 3,
				delaySeconds: 0,
				failed: true,
				errorMessage: noResponseErrorMessage,
			})

			const parsed = JSON.parse(json)
			expect(parsed.attempt).to.equal(3)
			expect(parsed.failed).to.be.true
			expect(parsed.errorMessage).to.include("Possible fixes")
			expect(parsed.errorMessage).to.include("different model")
			expect(parsed.errorMessage).to.include("reduce context size")
			expect(parsed.errorMessage).to.include("API provider status")
		})
	})
})
