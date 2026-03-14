import { readFileSync } from "node:fs"
import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { SshSessionRegistry } from "@services/ssh/SshSessionRegistry"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

export class SshConnectToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.SSH_CONNECT

	constructor(_validator: ToolValidator) {}

	getDescription(block: ToolUse): string {
		return `[ssh_connect ${block.params.user}@${block.params.host}:${block.params.port ?? 22}]`
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const host: string | undefined = block.params.host
		const portRaw: string | undefined = block.params.port
		const user: string | undefined = block.params.user
		const password: string | undefined = block.params.password
		const privateKeyPath: string | undefined = block.params.private_key_path

		if (!host) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "host")
		}
		if (!user) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "user")
		}
		const privateKeyContent: string | undefined = block.params.private_key_content

		if (!password && !privateKeyPath && !privateKeyContent) {
			config.taskState.consecutiveMistakeCount++
			return formatResponse.toolError(
				"Either password, private_key_content, or private_key_path must be provided for ssh_connect.",
			)
		}

		const port = portRaw ? Number.parseInt(portRaw, 10) : 22

		// Close any existing session for this workspace
		if (SshSessionRegistry.has(config.cwd)) {
			SshSessionRegistry.delete(config.cwd)
		}

		try {
			// biome-ignore lint/suspicious/noExplicitAny: ssh2 dynamic import
			const ssh2Module: any = await import("ssh2")
			const ssh2: any = ssh2Module.default ?? ssh2Module
			// biome-ignore lint/suspicious/noExplicitAny: ssh2 Client
			const client: any = new ssh2.Client()

			// biome-ignore lint/suspicious/noExplicitAny: ssh2 connect options
			const connectOpts: any = { host, port, username: user }
			if (password) {
				connectOpts.password = password
			} else if (privateKeyContent) {
				connectOpts.privateKey = privateKeyContent
			} else if (privateKeyPath) {
				connectOpts.privateKey = readFileSync(privateKeyPath)
			}

			await new Promise<void>((resolve, reject) => {
				client.on("ready", resolve)
				client.on("error", reject)
				client.connect(connectOpts)
			})

			SshSessionRegistry.set(config.cwd, client)
			SshSessionRegistry.setMetadata(config.cwd, { host, port, user, connectedAt: Date.now() })

			const sayContent = JSON.stringify({ tool: "ssh_connect", content: `connected to ${user}@${host}:${port}` })
			await config.callbacks.say("tool", sayContent, undefined, undefined, false)
			return [{ type: "text", text: `Connected to ${user}@${host}:${port} successfully.` }]
		} catch (error: unknown) {
			return formatResponse.toolError(`SSH connection failed: ${error instanceof Error ? error.message : String(error)}`)
		}
	}
}
