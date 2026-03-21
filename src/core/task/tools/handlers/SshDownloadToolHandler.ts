import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { SshSessionRegistry } from "@services/ssh/SshSessionRegistry"
import { NexusAIDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

export class SshDownloadToolHandler implements IFullyManagedTool {
	readonly name = NexusAIDefaultTool.SSH_DOWNLOAD

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

					// Guard flag to prevent double-resolution
					let downloadDone = false
					const finalize = (code: number | null, error?: Error) => {
						if (downloadDone) return
						downloadDone = true
						if (error) {
							reject(error)
						} else if (code === 0 || code === undefined) {
							resolveFn(data)
						} else {
							reject(new Error(`cat exited with code ${code}`))
						}
					}

					stream.on("data", (chunk: Buffer) => {
						data += chunk.toString()
					})

					stream.on("end", () => {
						// Windows behavior: 'end' fires but NO exit code available
						// Wait for 'close' with actual code. If only 'end' fires, timeout after 2s
						if (!downloadDone) {
							const timeoutId = setTimeout(() => {
								finalize(1, new Error("SSH download stream ended without exit code (Windows timeout)"))
							}, 2000)
							stream.once("close", (code: number) => {
								clearTimeout(timeoutId)
								finalize(code)
							})
						}
					})

					stream.on("close", (code: number) => {
						finalize(code)
					})
					stream.on("error", (err: Error) => {
						finalize(1, err)
					})
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
