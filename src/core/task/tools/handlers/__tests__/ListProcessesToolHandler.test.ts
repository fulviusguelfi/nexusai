import { afterEach, describe, it } from "mocha"
import "should"
import type { ToolUse } from "@core/assistant-message"
import sinon from "sinon"
import { ClineDefaultTool } from "@/shared/tools"
import { TaskState } from "../../../TaskState"
import type { TaskConfig } from "../../types/TaskConfig"
import { ListProcessesToolHandler } from "../ListProcessesToolHandler"

function makeBlock(params: Record<string, string | undefined> = {}): ToolUse {
	return { type: "tool_use", name: ClineDefaultTool.LIST_PROCESSES, params, partial: false }
}

function makeConfig(taskState = new TaskState()): { config: TaskConfig; say: sinon.SinonStub } {
	const say = sinon.stub().resolves(undefined)
	const config = {
		taskId: "t1",
		ulid: "u1",
		cwd: "/tmp",
		mode: "act",
		taskState,
		callbacks: {
			say,
			ask: sinon.stub().resolves({ response: "yesButtonClicked" }),
			sayAndCreateMissingParamError: sinon.stub().resolves("missing"),
		},
	} as unknown as TaskConfig
	return { config, say }
}

function makeHandler(execResult: string | Error = ""): ListProcessesToolHandler {
	const execFn = execResult instanceof Error ? sinon.stub().throws(execResult) : sinon.stub().returns(execResult)
	return new ListProcessesToolHandler({} as any, execFn as any)
}

describe("ListProcessesToolHandler", () => {
	afterEach(() => sinon.restore())

	describe("execute()", () => {
		it("returns process list when no filter is given", async () => {
			const handler = makeHandler("proc1\nproc2\nproc3")
			const { config, say } = makeConfig()

			const result = await handler.execute(config, makeBlock())

			;(result as any[]).should.have.length(1)
			;(result as any[])[0].text.should.containEql("proc1")
			;(result as any[])[0].text.should.containEql("proc2")
			say.calledOnce.should.be.true()
		})

		it("filters results when filter param is provided", async () => {
			const handler = makeHandler("node server.js\nnginx\nchrome --headless\nnode worker.js")
			const { config } = makeConfig()

			const result = await handler.execute(config, makeBlock({ filter: "node" }))

			const text = (result as any[])[0].text as string
			text.should.containEql("node server.js")
			text.should.containEql("node worker.js")
			text.should.not.containEql("nginx")
			text.should.not.containEql("chrome")
		})

		it("filter is case-insensitive", async () => {
			const handler = makeHandler("MYSQLD\npostgres\nMySQLDaemon")
			const { config } = makeConfig()

			const result = await handler.execute(config, makeBlock({ filter: "mysql" }))

			const text = (result as any[])[0].text as string
			text.should.containEql("MYSQLD")
			text.should.containEql("MySQLDaemon")
			text.should.not.containEql("postgres")
		})

		it('returns "No processes found." when filter matches nothing', async () => {
			const handler = makeHandler("nginx\nredis\npostgres")
			const { config } = makeConfig()

			const result = await handler.execute(config, makeBlock({ filter: "xyzzy-not-real" }))

			;(result as any[])[0].text.should.equal("No processes found.")
		})

		it("caps output at 100 lines", async () => {
			const lines = Array.from({ length: 150 }, (_, i) => `process_${i}`)
			const handler = makeHandler(lines.join("\n"))
			const { config } = makeConfig()

			const result = await handler.execute(config, makeBlock())

			const outputLines = ((result as any[])[0].text as string).split("\n")
			outputLines.should.have.length(100)
		})

		it("returns toolError string when execSync throws", async () => {
			const handler = makeHandler(new Error("permission denied"))
			const { config } = makeConfig()

			const result = await handler.execute(config, makeBlock())

			;(result as string).should.containEql("Failed to list processes")
			;(result as string).should.containEql("permission denied")
		})

		it("calls say(tool) on success", async () => {
			const handler = makeHandler("proc1\nproc2")
			const { config, say } = makeConfig()

			await handler.execute(config, makeBlock())

			say.calledWith("tool", sinon.match.string).should.be.true()
		})
	})

	describe("getDescription()", () => {
		it("returns [list_processes]", () => {
			const handler = makeHandler("")
			handler.getDescription(makeBlock()).should.equal("[list_processes]")
		})
	})

	describe("name", () => {
		it("is list_processes", () => {
			const handler = makeHandler("")
			handler.name.should.equal(ClineDefaultTool.LIST_PROCESSES)
		})
	})
})
