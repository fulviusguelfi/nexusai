import { readFileSync } from "node:fs"
import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { SshServerProfileRegistry } from "@services/ssh/SshServerProfileRegistry"
import { SshSessionRegistry } from "@services/ssh/SshSessionRegistry"
import type { SshAuthType } from "@shared/ssh/SshServerProfile"
import { NexusAIDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

export class SshConnectToolHandler implements IFullyManagedTool {
	readonly name = NexusAIDefaultTool.SSH_CONNECT

	constructor(_validator: ToolValidator) {}

	getDescription(block: ToolUse): string {
		const serverName: string | undefined = block.params.server_name
		if (serverName) return `[ssh_connect "${serverName}"]`
		return `[ssh_connect ${block.params.user}@${block.params.host}:${block.params.port ?? 22}]`
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const serverName: string | undefined = block.params.server_name

		// Read raw params (may be undefined when server_name is used)
		let resolvedHost: string | undefined = block.params.host
		let resolvedUser: string | undefined = block.params.user
		const portRaw: string | undefined = block.params.port
		let resolvedPort = portRaw ? Number.parseInt(portRaw, 10) : 22
		let resolvedPassword: string | undefined = block.params.password
		let resolvedPrivateKeyPath: string | undefined = block.params.private_key_path
		let resolvedPrivateKeyContent: string | undefined = block.params.private_key_content
		let resolvedAuthType: SshAuthType = resolvedPassword ? "password" : resolvedPrivateKeyContent ? "key_content" : "key_path"

		// Resolve connection details from saved profile when server_name is provided
		if (serverName) {
			const profile = SshServerProfileRegistry.getByName(serverName)
			if (!profile) {
				config.taskState.consecutiveMistakeCount++
				return formatResponse.toolError(
					`No saved server found with name "${serverName}". Use host/user/password parameters to connect and save a new server.`,
				)
			}
			const credential = await SshServerProfileRegistry.getCredential(profile.id)
			if (!credential) {
				config.taskState.consecutiveMistakeCount++
				return formatResponse.toolError(
					`Credentials for server "${serverName}" are missing from secure storage. Please reconnect using host/user/password parameters.`,
				)
			}
			resolvedHost = profile.host
			resolvedPort = profile.port
			resolvedUser = profile.user
			resolvedAuthType = profile.authType
			if (profile.authType === "password") resolvedPassword = credential
			else if (profile.authType === "key_content") resolvedPrivateKeyContent = credential
			else if (profile.authType === "key_path") resolvedPrivateKeyPath = credential
		}

		// Validate required parameters
		if (!resolvedHost) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "host")
		}
		if (!resolvedUser) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "user")
		}
		if (!resolvedPassword && !resolvedPrivateKeyPath && !resolvedPrivateKeyContent) {
			config.taskState.consecutiveMistakeCount++
			return formatResponse.toolError(
				"Either password, private_key_content, or private_key_path must be provided for ssh_connect.",
			)
		}

		// Close any existing session for this workspace
		if (SshSessionRegistry.has(config.cwd)) {
			SshSessionRegistry.delete(config.cwd)
		}

		try {
			// biome-ignore lint/suspicious/noExplicitAny: ssh2 dynamic import
			// @ts-expect-error -- ssh2 is an optional runtime dependency
			const ssh2Module: any = await import("ssh2")
			const ssh2: any = ssh2Module.default ?? ssh2Module
			// biome-ignore lint/suspicious/noExplicitAny: ssh2 Client
			const client: any = new ssh2.Client()

			// biome-ignore lint/suspicious/noExplicitAny: ssh2 connect options
			const connectOpts: any = { host: resolvedHost, port: resolvedPort, username: resolvedUser }
			if (resolvedPassword) {
				connectOpts.password = resolvedPassword
			} else if (resolvedPrivateKeyContent) {
				connectOpts.privateKey = resolvedPrivateKeyContent
			} else if (resolvedPrivateKeyPath) {
				connectOpts.privateKey = readFileSync(resolvedPrivateKeyPath)
			}

			await new Promise<void>((resolve, reject) => {
				client.on("ready", resolve)
				client.on("error", reject)
				client.connect(connectOpts)
			})

			// Attach a permanent no-op error listener after the promise settles so
			// abrupt socket close after the test (ECONNRESET) does not propagate as
			// an uncaught exception in the extension host on Linux (Ubuntu CI).
			client.on("error", () => {})

			SshSessionRegistry.set(config.cwd, client)
			SshSessionRegistry.setMetadata(config.cwd, {
				host: resolvedHost,
				port: resolvedPort,
				user: resolvedUser,
				connectedAt: Date.now(),
			})

			// Auto-save server profile after every successful connection
			const saveId = serverName
				? serverName
						.toLowerCase()
						.replace(/\s+/g, "-")
						.replace(/[^a-z0-9-]/g, "")
				: `${resolvedUser}-${resolvedHost}-${resolvedPort}`.toLowerCase().replace(/[^a-z0-9-]/g, "-")
			const saveName = serverName ?? `${resolvedUser}@${resolvedHost}`
			const credentialToSave = resolvedPassword ?? resolvedPrivateKeyContent ?? resolvedPrivateKeyPath ?? ""
			await SshServerProfileRegistry.upsert(
				{
					id: saveId,
					name: saveName,
					host: resolvedHost,
					port: resolvedPort,
					user: resolvedUser,
					authType: resolvedAuthType,
					lastConnectedAt: Date.now(),
				},
				credentialToSave,
			).catch(() => {}) // don't fail the task on save error

			const sayContent = JSON.stringify({
				tool: "ssh_connect",
				content: `connected to ${resolvedUser}@${resolvedHost}:${resolvedPort}`,
			})
			await config.callbacks.say("tool", sayContent, undefined, undefined, false)
			return [{ type: "text", text: `Connected to ${resolvedUser}@${resolvedHost}:${resolvedPort} successfully.` }]
		} catch (error: unknown) {
			// Surface the failure in the chat UI so Playwright recordings capture the
			// exact error message, making future CI diagnosis trivial.
			const errorMsg = error instanceof Error ? error.message : String(error)
			await config.callbacks
				.say("tool", JSON.stringify({ tool: "ssh_connect", content: `failed: ${errorMsg}` }), undefined, undefined, false)
				.catch(() => {})
			return formatResponse.toolError(`SSH connection failed: ${errorMsg}`)
		}
	}
}
