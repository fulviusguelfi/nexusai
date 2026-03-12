import { execSync } from "node:child_process"
import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

export class KillProcessToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.KILL_PROCESS

	constructor(private validator: ToolValidator) {}

	getDescription(block: ToolUse): string {
		return `[kill_process PID=${block.params.pid}]`
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const pidRaw: string | undefined = block.params.pid
		const signal: string = block.params.signal || "SIGTERM"

		if (!pidRaw) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "pid")
		}

		const pid = Number.parseInt(pidRaw, 10)
		if (!Number.isInteger(pid) || pid <= 0) {
			return formatResponse.toolError(`Invalid PID: ${pidRaw}`)
		}

		const approval = await config.callbacks.ask("tool", JSON.stringify({ tool: "killProcess", pid, signal }))

		if (approval.response !== "yesButtonClicked") {
			return [{ type: "text", text: "User declined to kill process." }]
		}

		try {
			const isWin = process.platform === "win32"

			if (isWin) {
				execSync(`taskkill /PID ${pid} /F`, { encoding: "utf8", timeout: 10_000 })
			} else {
				process.kill(pid, signal as NodeJS.Signals)
			}

			return [{ type: "text", text: `Process ${pid} terminated successfully.` }]
		} catch (error: any) {
			return formatResponse.toolError(`Failed to kill process ${pid}: ${error.message}`)
		}
	}
}
