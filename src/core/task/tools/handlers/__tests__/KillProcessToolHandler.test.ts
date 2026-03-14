import { execSync } from "node:child_process"
import { afterEach, describe, it } from "mocha"
import "should"
import type { ToolUse } from "@core/assistant-message"
import sinon from "sinon"
import { ClineDefaultTool } from "@/shared/tools"
import { TaskState } from "../../../TaskState"
import type { ToolValidator } from "../../ToolValidator"
import type { TaskConfig } from "../../types/TaskConfig"
import { KillProcessToolHandler } from "../KillProcessToolHandler"

type TextResult = { type: string; text: string }

function makeBlock(params: Record<string, string | undefined> = {}): ToolUse {
	return { type: "tool_use", name: ClineDefaultTool.KILL_PROCESS, params, partial: false }
}

function makeConfig(options: { askResponse?: "yesButtonClicked" | "noButtonClicked"; taskState?: TaskState } = {}): {
	config: TaskConfig
	callbacks: Record<string, sinon.SinonStub>
	taskState: TaskState
} {
	const taskState = options.taskState ?? new TaskState()
	const callbacks = {
		say: sinon.stub().resolves(undefined),
		ask: sinon.stub().resolves({ response: options.askResponse ?? "yesButtonClicked" }),
		sayAndCreateMissingParamError: sinon.stub().resolves("missing-param-error"),
		saveCheckpoint: sinon.stub().resolves(),
	}
	const config = {
		taskId: "t1",
		ulid: "u1",
		cwd: "/tmp",
		mode: "act",
		taskState,
		callbacks,
	} as unknown as TaskConfig
	return { config, callbacks, taskState }
}

function makeHandler(execResult: string | Error = ""): KillProcessToolHandler {
	const execFn = execResult instanceof Error ? sinon.stub().throws(execResult) : sinon.stub().returns(execResult)
	return new KillProcessToolHandler({} as unknown as ToolValidator, execFn as typeof execSync)
}

describe("KillProcessToolHandler", () => {
	afterEach(() => sinon.restore())

	describe("execute() — parameter validation", () => {
		it("increments consecutiveMistakeCount when PID is missing", async () => {
			const { config, callbacks, taskState } = makeConfig()
			const handler = makeHandler()

			taskState.consecutiveMistakeCount = 0
			await handler.execute(config, makeBlock({}))

			taskState.consecutiveMistakeCount.should.equal(1)
			callbacks.sayAndCreateMissingParamError.calledOnce.should.be.true()
		})

		it("returns result of sayAndCreateMissingParamError when PID missing", async () => {
			const { config, callbacks } = makeConfig()
			callbacks.sayAndCreateMissingParamError.resolves("expected-error-response")
			const handler = makeHandler()

			const result = await handler.execute(config, makeBlock({}))

			result.should.equal("expected-error-response")
		})

		it("returns toolError when PID is not a valid integer", async () => {
			const { config } = makeConfig()
			const handler = makeHandler()

			const result = await handler.execute(config, makeBlock({ pid: "notAnumber" }))

			;(result as string).should.containEql("Invalid PID")
		})

		it("returns toolError when PID is zero", async () => {
			const { config } = makeConfig()
			const handler = makeHandler()

			const result = await handler.execute(config, makeBlock({ pid: "0" }))

			;(result as string).should.containEql("Invalid PID")
		})

		it("returns toolError when PID is negative", async () => {
			const { config } = makeConfig()
			const handler = makeHandler()

			const result = await handler.execute(config, makeBlock({ pid: "-1" }))

			;(result as string).should.containEql("Invalid PID")
		})
	})

	describe("execute() — user approval", () => {
		it('returns "User declined" text when user responds noButtonClicked', async () => {
			const { config } = makeConfig({ askResponse: "noButtonClicked" })
			const handler = makeHandler()

			const result = await handler.execute(config, makeBlock({ pid: "1234" }))

			;(result as TextResult[])[0].text.should.equal("User declined to kill process.")
		})

		it("prompts user with tool/pid/signal details before killing", async () => {
			const { config, callbacks } = makeConfig()
			const handler = makeHandler("") // success

			await handler.execute(config, makeBlock({ pid: "5678", signal: "SIGKILL" }))

			const askArg = callbacks.ask.firstCall.args[1]
			const payload = JSON.parse(askArg)
			payload.tool.should.equal("killProcess")
			payload.pid.should.equal(5678)
			payload.signal.should.equal("SIGKILL")
		})

		it("defaults signal to SIGTERM when not provided", async () => {
			const { config, callbacks } = makeConfig()
			const handler = makeHandler("") // success

			await handler.execute(config, makeBlock({ pid: "9999" }))

			const askArg = callbacks.ask.firstCall.args[1]
			const payload = JSON.parse(askArg)
			payload.signal.should.equal("SIGTERM")
		})
	})

	describe("execute() — successful kill", () => {
		it("returns success message with PID after approved kill", async () => {
			const { config } = makeConfig()
			const handler = makeHandler("") // execSync succeeds

			const result = await handler.execute(config, makeBlock({ pid: "1234" }))

			;(result as TextResult[])[0].text.should.equal("Process 1234 terminated successfully.")
		})

		it("returns toolError when the OS kill command throws", async () => {
			const { config } = makeConfig()
			const handler = makeHandler(new Error("Access denied"))

			const result = await handler.execute(config, makeBlock({ pid: "1234" }))

			;(result as string).should.containEql("Failed to kill process 1234")
			;(result as string).should.containEql("Access denied")
		})
	})

	describe("execute() — custom signal", () => {
		it("uses provided signal in ask payload", async () => {
			const { config, callbacks } = makeConfig()
			const handler = makeHandler("") // success

			await handler.execute(config, makeBlock({ pid: "42", signal: "SIGUSR1" }))

			const askArg = callbacks.ask.firstCall.args[1]
			JSON.parse(askArg).signal.should.equal("SIGUSR1")
		})
	})

	describe("getDescription()", () => {
		it("includes PID in description string", () => {
			const handler = makeHandler()
			const desc = handler.getDescription(makeBlock({ pid: "7777" }))
			desc.should.containEql("7777")
			desc.should.containEql("kill_process")
		})

		it("handles undefined pid gracefully", () => {
			const handler = makeHandler()
			const desc = handler.getDescription(makeBlock({}))
			desc.should.containEql("kill_process")
		})
	})

	describe("name", () => {
		it("is kill_process", () => {
			const handler = makeHandler()
			handler.name.should.equal(ClineDefaultTool.KILL_PROCESS)
		})
	})
})
