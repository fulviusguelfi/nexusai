import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { MqttConnectionRegistry } from "@services/iot/MqttConnectionRegistry"
import { NexusAIDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

const DEFAULT_TIMEOUT_MS = 5_000
const MAX_MESSAGES = 50

export class MqttSubscribeToolHandler implements IFullyManagedTool {
	readonly name = NexusAIDefaultTool.MQTT_SUBSCRIBE

	constructor(_validator: ToolValidator) {}

	getDescription(block: ToolUse): string {
		return `[mqtt_subscribe ← ${block.params.topic}]`
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const topic: string | undefined = block.params.topic
		const timeoutRaw: string | undefined = block.params.timeout_ms
		const maxMsgRaw: string | undefined = block.params.max_messages

		if (!topic) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "topic")
		}

		const client = MqttConnectionRegistry.get(config.cwd)
		if (!client) {
			config.taskState.consecutiveMistakeCount++
			return formatResponse.toolError("No active MQTT connection. Use mqtt_connect first.")
		}

		const timeoutMs = timeoutRaw ? Number.parseInt(timeoutRaw, 10) : DEFAULT_TIMEOUT_MS
		const maxMessages = maxMsgRaw ? Number.parseInt(maxMsgRaw, 10) : MAX_MESSAGES

		try {
			const messages: Array<{ topic: string; payload: string; receivedAt: number }> = []

			await new Promise<void>((resolve, reject) => {
				const timer = setTimeout(resolve, timeoutMs)

				// biome-ignore lint/suspicious/noExplicitAny: mqtt message handler
				const messageHandler = (msgTopic: string, payload: any) => {
					messages.push({ topic: msgTopic, payload: payload.toString(), receivedAt: Date.now() })
					if (messages.length >= maxMessages) {
						clearTimeout(timer)
						resolve()
					}
				}

				client.subscribe(topic, { qos: 0 }, (err?: Error) => {
					if (err) {
						clearTimeout(timer)
						reject(err)
					}
				})

				client.on("message", messageHandler)

				// Clean up listener after timeout/completion
				setTimeout(() => {
					client.removeListener("message", messageHandler)
					client.unsubscribe(topic)
				}, timeoutMs + 100)
			})

			const sayContent = JSON.stringify({
				tool: "mqtt_subscribe",
				content: `received ${messages.length} messages from ${topic}`,
			})
			await config.callbacks.say("tool", sayContent, undefined, undefined, false)

			if (messages.length === 0) {
				return [{ type: "text", text: `No messages received on topic "${topic}" within ${timeoutMs}ms.` }]
			}

			const formatted = messages
				.map((m, i) => `[${i + 1}] topic=${m.topic} time=${new Date(m.receivedAt).toISOString()}\n${m.payload}`)
				.join("\n\n")
			return [{ type: "text", text: `Received ${messages.length} message(s):\n\n${formatted}` }]
		} catch (error: unknown) {
			return formatResponse.toolError(`MQTT subscribe failed: ${error instanceof Error ? error.message : String(error)}`)
		}
	}
}
