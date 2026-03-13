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
		if (!password && !privateKeyPath) {
			config.taskState.consecutiveMistakeCount++
			return formatResponse.toolError("Either password or private_key_path must be provided for ssh_connect.")
		}

		const port = portRaw ? Number.parseInt(portRaw, 10) : 22

		// Require user approval before opening a remote connection
		const approval = await config.callbacks.ask("tool", JSON.stringify({ tool: "sshConnect", host, port, user }))
		if (approval.response !== "yesButtonClicked") {
			return [{ type: "text", text: "User declined SSH connection." }]
		}

		// Close any existing session for this task
		if (SshSessionRegistry.has(config.taskId)) {
			SshSessionRegistry.delete(config.taskId)
		}

		try {
			// Dynamic import so the file compiles before `npm install` adds ssh2
			// biome-ignore lint/suspicious/noExplicitAny: ssh2 dynamic import
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-expect-error ssh2 package installed at runtime on feat/fase-3-ssh
			const ssh2: any = await import("ssh2")
			// biome-ignore lint/suspicious/noExplicitAny: ssh2 Client
			const client: any = new ssh2.Client()

			// biome-ignore lint/suspicious/noExplicitAny: ssh2 connect options
			const connectOpts: any = { host, port, username: user }
			if (password) {
				connectOpts.password = password
			} else if (privateKeyPath) {
				connectOpts.privateKey = readFileSync(privateKeyPath)
			}

			await new Promise<void>((resolve, reject) => {
				client.on("ready", resolve)
				client.on("error", reject)
				client.connect(connectOpts)
			})

			SshSessionRegistry.set(config.taskId, client)

			await config.callbacks.say("tool", `[ssh_connect] connected to ${user}@${host}:${port}`)
			return [{ type: "text", text: `Connected to ${user}@${host}:${port} successfully.` }]
		} catch (error: unknown) {
			return formatResponse.toolError(`SSH connection failed: ${error instanceof Error ? error.message : String(error)}`)
		}
	}
}
