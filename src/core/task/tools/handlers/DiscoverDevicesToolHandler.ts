import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { IotDiscoveryService } from "@services/iot/IotDiscoveryService"
import { NexusAIDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

const SCAN_TIMEOUT_MS = 8_000

export class DiscoverDevicesToolHandler implements IFullyManagedTool {
	readonly name = NexusAIDefaultTool.DISCOVER_DEVICES

	constructor(_validator: ToolValidator) {}

	getDescription(_block: ToolUse): string {
		return "[discover_devices]"
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const timeoutRaw: string | undefined = block.params.timeout_ms
		const timeoutMs = timeoutRaw ? Number.parseInt(timeoutRaw, 10) : SCAN_TIMEOUT_MS

		try {
			const found = await IotDiscoveryService.scan(timeoutMs)

			const sayContent = JSON.stringify({ tool: "discover_devices", content: `found ${found.length} devices` })
			await config.callbacks.say("tool", sayContent, undefined, undefined, false)

			if (found.length === 0) {
				return [{ type: "text", text: "No devices discovered on the local network within the scan window." }]
			}

			const lines = found.map((d) => `\u2022 ${d.name} \u2014 ${d.ip} [${d.type} / ${d.protocol}]`)
			return [{ type: "text", text: `Discovered ${found.length} device(s):\n\n${lines.join("\n")}` }]
		} catch (error: unknown) {
			return formatResponse.toolError(`Device discovery failed: ${error instanceof Error ? error.message : String(error)}`)
		}
	}
}
