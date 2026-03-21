import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { MqttConnectionRegistry } from "@services/iot/MqttConnectionRegistry"
import { NexusAIDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

export class MqttPublishToolHandler implements IFullyManagedTool {
	readonly name = NexusAIDefaultTool.MQTT_PUBLISH

	constructor(_validator: ToolValidator) {}

	getDescription(block: ToolUse): string {
		return `[mqtt_publish → ${block.params.topic}]`
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const topic: string | undefined = block.params.topic
		const message: string | undefined = block.params.message
		const qosRaw: string | undefined = block.params.qos
		const retain = block.params.retain === "true"

		if (!topic) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "topic")
		}
		if (message === undefined) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "message")
		}

		const client = MqttConnectionRegistry.get(config.cwd)
		if (!client) {
			config.taskState.consecutiveMistakeCount++
			return formatResponse.toolError("No active MQTT connection. Use mqtt_connect first.")
		}

		const qos = qosRaw ? (Number.parseInt(qosRaw, 10) as 0 | 1 | 2) : 0

		try {
			await new Promise<void>((resolve, reject) => {
				client.publish(topic, message, { qos, retain }, (err?: Error) => {
					if (err) reject(err)
					else resolve()
				})
			})

			const sayContent = JSON.stringify({ tool: "mqtt_publish", content: `published to ${topic}` })
			await config.callbacks.say("tool", sayContent, undefined, undefined, false)
			return [{ type: "text", text: `Message published to topic "${topic}" (QoS ${qos}, retain=${retain}).` }]
		} catch (error: unknown) {
			return formatResponse.toolError(`MQTT publish failed: ${error instanceof Error ? error.message : String(error)}`)
		}
	}
}
