import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { MqttConnectionRegistry } from "@services/iot/MqttConnectionRegistry"
import { NexusAIDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

export class MqttConnectToolHandler implements IFullyManagedTool {
	readonly name = NexusAIDefaultTool.MQTT_CONNECT

	constructor(_validator: ToolValidator) {}

	getDescription(block: ToolUse): string {
		return `[mqtt_connect ${block.params.broker}:${block.params.port ?? 1883}]`
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const broker: string | undefined = block.params.broker
		const portRaw: string | undefined = block.params.port
		const clientId: string | undefined = block.params.client_id
		const username: string | undefined = block.params.username
		const password: string | undefined = block.params.password

		if (!broker) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "broker")
		}

		const port = portRaw ? Number.parseInt(portRaw, 10) : 1883
		const resolvedClientId = clientId ?? `nexusai-${Date.now()}`

		// Close existing session if any
		if (MqttConnectionRegistry.has(config.cwd)) {
			MqttConnectionRegistry.delete(config.cwd)
		}

		try {
			// biome-ignore lint/suspicious/noExplicitAny: mqtt dynamic import
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-expect-error
			const mqtt: any = await import("mqtt")
			const mqttLib = mqtt.default ?? mqtt

			const connectUrl = `mqtt://${broker}:${port}`
			// biome-ignore lint/suspicious/noExplicitAny: mqtt connect options
			const connectOpts: Record<string, any> = { clientId: resolvedClientId }
			if (username) connectOpts.username = username
			if (password) connectOpts.password = password

			// biome-ignore lint/suspicious/noExplicitAny: mqtt client
			const client: any = await new Promise((resolve, reject) => {
				const c = mqttLib.connect(connectUrl, connectOpts)
				c.once("connect", () => resolve(c))
				c.once("error", reject)
				setTimeout(() => reject(new Error("MQTT connection timed out after 10s")), 10_000)
			})

			MqttConnectionRegistry.set(config.cwd, client)
			MqttConnectionRegistry.setMetadata(config.cwd, {
				broker,
				port,
				clientId: resolvedClientId,
				connectedAt: Date.now(),
			})

			const sayContent = JSON.stringify({ tool: "mqtt_connect", content: `connected to ${broker}:${port}` })
			await config.callbacks.say("tool", sayContent, undefined, undefined, false)
			return [{ type: "text", text: `Connected to MQTT broker ${broker}:${port} with client ID ${resolvedClientId}.` }]
		} catch (error: unknown) {
			return formatResponse.toolError(`MQTT connection failed: ${error instanceof Error ? error.message : String(error)}`)
		}
	}
}
