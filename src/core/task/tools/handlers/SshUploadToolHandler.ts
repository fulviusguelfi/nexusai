import { readFileSync } from "node:fs"
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

export class SshUploadToolHandler implements IFullyManagedTool {
	readonly name = NexusAIDefaultTool.SSH_UPLOAD

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

		const client = SshSessionRegistry.get(config.cwd)
		if (!client) {
			return formatResponse.toolError("No active SSH session. Use ssh_connect first.")
		}

		try {
			const absoluteLocalPath = resolve(config.cwd, localPath)
			const content = readFileSync(absoluteLocalPath)

			await new Promise<void>((resolveFn, reject) => {
				// biome-ignore lint/suspicious/noExplicitAny: ssh2 stream type
				client.exec(`cat > '${remotePath.replace(/'/g, "'\\''")}' `, (err: Error | undefined, stream: any) => {
					if (err) return reject(err)
					// Drain stdout and stderr so the "close" event fires
					stream.on("data", () => {})
					stream.stderr.on("data", () => {})
					stream.stderr.on("error", () => {})

					// Guard flag to prevent double-resolution
					let uploadDone = false
					const finalize = (code: number | null, error?: Error) => {
						if (uploadDone) return
						uploadDone = true
						if (error) {
							reject(error)
						} else if (code === 0 || code === undefined) {
							resolveFn()
						} else {
							reject(new Error(`upload exited with code ${code}`))
						}
					}

					stream.on("end", () => {
						// Windows behavior: 'end' fires but NO exit code available
						// Wait for 'close' with actual code. If only 'end' fires, timeout after 2s
						if (!uploadDone) {
							const timeoutId = setTimeout(() => {
								finalize(1, new Error("SSH upload stream ended without exit code (Windows timeout)"))
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
					stream.write(content)
					stream.end()
				})
			})

			const sayUpload = JSON.stringify({ tool: "ssh_upload", content: `uploaded ${localPath} → ${remotePath}` })
			await config.callbacks.say("tool", sayUpload, undefined, undefined, false)
			return [{ type: "text", text: `File uploaded: ${localPath} → ${remotePath}` }]
		} catch (error: unknown) {
			return formatResponse.toolError(`SSH upload failed: ${error instanceof Error ? error.message : String(error)}`)
		}
	}
}
