import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { SshSessionRegistry } from "@services/ssh/SshSessionRegistry"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

const EXEC_TIMEOUT_MS = 30_000

export class SshExecuteToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.SSH_EXECUTE

	constructor(_validator: ToolValidator) {}

	getDescription(block: ToolUse): string {
		return `[ssh_execute: ${block.params.command}]`
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const command: string | undefined = block.params.command

		if (!command) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "command")
		}

		const client = SshSessionRegistry.get(config.cwd)
		if (!client) {
			return formatResponse.toolError("no active SSH session. Use ssh_connect first.")
		}

		try {
			const { stdout, stderr, exitCode } = await new Promise<{
				stdout: string
				stderr: string
				exitCode: number
			}>((resolve, reject) => {
				const timeout = setTimeout(
					() => reject(new Error(`Command timed out after ${EXEC_TIMEOUT_MS}ms`)),
					EXEC_TIMEOUT_MS,
				)

				// biome-ignore lint/suspicious/noExplicitAny: ssh2 stream type
				client.exec(command, (err: Error | undefined, stream: any) => {
					if (err) {
						clearTimeout(timeout)
						return reject(err)
					}
					let stdout = ""
					let stderr = ""
					stream.on("data", (data: Buffer) => {
						stdout += data.toString()
					})
					stream.stderr.on("data", (data: Buffer) => {
						stderr += data.toString()
					})
					stream.on("close", (code: number) => {
						clearTimeout(timeout)
						resolve({ stdout, stderr, exitCode: code ?? 0 })
					})
					stream.on("error", (e: Error) => {
						clearTimeout(timeout)
						reject(e)
					})
				})
			})

			const output = [stdout, stderr].filter(Boolean).join("\n").trim()
			const saySsh = JSON.stringify({ tool: "ssh_execute", content: output || `(exit ${exitCode})` })
			await config.callbacks.say("tool", saySsh, undefined, undefined, false)
			return [{ type: "text", text: output || `(exit ${exitCode})` }]
		} catch (error: unknown) {
			return formatResponse.toolError(`SSH execute failed: ${error instanceof Error ? error.message : String(error)}`)
		}
	}
}
