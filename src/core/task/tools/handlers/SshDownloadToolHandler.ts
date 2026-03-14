import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { SshSessionRegistry } from "@services/ssh/SshSessionRegistry"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

export class SshDownloadToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.SSH_DOWNLOAD

	constructor(_validator: ToolValidator) {}

	getDescription(block: ToolUse): string {
		return `[ssh_download ${block.params.remote_path} → ${block.params.local_path}]`
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const remotePath: string | undefined = block.params.remote_path
		const localPath: string | undefined = block.params.local_path

		if (!remotePath) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "remote_path")
		}
		if (!localPath) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "local_path")
		}

		const client = SshSessionRegistry.get(config.cwd)
		if (!client) {
			return formatResponse.toolError("No active SSH session. Use ssh_connect first.")
		}

		try {
			const content = await new Promise<string>((resolveFn, reject) => {
				// biome-ignore lint/suspicious/noExplicitAny: ssh2 stream type
				client.exec(`cat '${remotePath.replace(/'/g, "'\\''")}' `, (err: Error | undefined, stream: any) => {
					if (err) return reject(err)
					let data = ""
					stream.on("data", (chunk: Buffer) => {
						data += chunk.toString()
					})
					stream.on("close", (code: number) => {
						if (code && code !== 0) return reject(new Error(`cat exited with code ${code}`))
						resolveFn(data)
					})
					stream.on("error", reject)
				})
			})

			const absoluteLocalPath = resolve(config.cwd, localPath)
			writeFileSync(absoluteLocalPath, content)

			const sayDl = JSON.stringify({ tool: "ssh_download", content: `downloaded ${remotePath} → ${localPath}` })
			await config.callbacks.say("tool", sayDl, undefined, undefined, false)
			return [{ type: "text", text: `File downloaded: ${remotePath} → ${localPath}` }]
		} catch (error: unknown) {
			return formatResponse.toolError(`SSH download failed: ${error instanceof Error ? error.message : String(error)}`)
		}
	}
}
