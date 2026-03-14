import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { SshSessionRegistry } from "@services/ssh/SshSessionRegistry"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

export class SshDisconnectToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.SSH_DISCONNECT

	constructor(_validator: ToolValidator) {}

	getDescription(_block: ToolUse): string {
		return "[ssh_disconnect]"
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {}

	async execute(config: TaskConfig, _block: ToolUse): Promise<ToolResponse> {
		if (!SshSessionRegistry.has(config.cwd)) {
			return formatResponse.toolError("No active SSH session to disconnect.")
		}

		try {
			SshSessionRegistry.delete(config.cwd)
			const sayDisc = JSON.stringify({ tool: "ssh_disconnect", content: "disconnected from session" })
			await config.callbacks.say("tool", sayDisc, undefined, undefined, false)
			return [{ type: "text", text: "SSH session disconnected." }]
		} catch (error: unknown) {
			return formatResponse.toolError(`SSH disconnect failed: ${error instanceof Error ? error.message : String(error)}`)
		}
	}
}
