import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { MqttConnectionRegistry } from "@services/iot/MqttConnectionRegistry"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

export class MqttDisconnectToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.MQTT_DISCONNECT

	constructor(_validator: ToolValidator) {}

	getDescription(_block: ToolUse): string {
		return "[mqtt_disconnect]"
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {}

	async execute(config: TaskConfig, _block: ToolUse): Promise<ToolResponse> {
		if (!MqttConnectionRegistry.has(config.cwd)) {
			return formatResponse.toolError("No active MQTT connection to disconnect.")
		}

		try {
			MqttConnectionRegistry.delete(config.cwd)
			const sayContent = JSON.stringify({ tool: "mqtt_disconnect", content: "disconnected from broker" })
			await config.callbacks.say("tool", sayContent, undefined, undefined, false)
			return [{ type: "text", text: "MQTT connection disconnected." }]
		} catch (error: unknown) {
			return formatResponse.toolError(`MQTT disconnect failed: ${error instanceof Error ? error.message : String(error)}`)
		}
	}
}
