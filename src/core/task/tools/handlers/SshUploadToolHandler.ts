import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { SshSessionRegistry } from "@services/ssh/SshSessionRegistry"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

export class SshUploadToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.SSH_UPLOAD

	constructor(_validator: ToolValidator) {}

	getDescription(block: ToolUse): string {
		return `[ssh_upload ${block.params.local_path} → ${block.params.remote_path}]`
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const localPath: string | undefined = block.params.local_path
		const remotePath: string | undefined = block.params.remote_path

		if (!localPath) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "local_path")
		}
		if (!remotePath) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "remote_path")
		}

		const client = SshSessionRegistry.get(config.taskId)
		if (!client) {
			return formatResponse.toolError("No active SSH session. Use ssh_connect first.")
		}

		const approval = await config.callbacks.ask("tool", JSON.stringify({ tool: "sshUpload", localPath, remotePath }))
		if (approval.response !== "yesButtonClicked") {
			return [{ type: "text", text: "User declined file upload." }]
		}

		try {
			await new Promise<void>((resolve, reject) => {
				// biome-ignore lint/suspicious/noExplicitAny: ssh2 sftp type
				client.sftp((err: Error | undefined, sftp: any) => {
					if (err) return reject(err)
					sftp.fastPut(localPath, remotePath, (putErr: Error | null) => {
						if (putErr) return reject(putErr)
						resolve()
					})
				})
			})

			await config.callbacks.say("tool", `[ssh_upload] uploaded ${localPath} → ${remotePath}`)
			return [{ type: "text", text: `File uploaded: ${localPath} → ${remotePath}` }]
		} catch (error: unknown) {
			return formatResponse.toolError(`SSH upload failed: ${error instanceof Error ? error.message : String(error)}`)
		}
	}
}
