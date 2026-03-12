import { execSync } from "node:child_process"
import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

const MAX_PROCESS_LINES = 100

export class ListProcessesToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.LIST_PROCESSES

	constructor(_validator: ToolValidator) {}

	getDescription(_block: ToolUse): string {
		return "[list_processes]"
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const filter: string | undefined = block.params.filter

		try {
			let output: string
			const isWin = process.platform === "win32"

			if (isWin) {
				output = execSync("tasklist /fo csv /nh", { encoding: "utf8", timeout: 10_000 })
			} else {
				output = execSync("ps aux", { encoding: "utf8", timeout: 10_000 })
			}

			const lines = output.trim().split("\n")
			const filtered = filter ? lines.filter((l) => l.toLowerCase().includes(filter.toLowerCase())) : lines
			const result = filtered.slice(0, MAX_PROCESS_LINES).join("\n")

			await config.callbacks.say("tool", `[list_processes]`)
			return [{ type: "text", text: result || "No processes found." }]
		} catch (error: any) {
			return formatResponse.toolError(`Failed to list processes: ${error.message}`)
		}
	}
}
