import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { DeviceCommandAdapter } from "@services/iot/DeviceCommandAdapter"
import { DeviceRegistry } from "@services/iot/DeviceRegistry"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

export class OperateDeviceToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.OPERATE_DEVICE

	constructor(_validator: ToolValidator) {}

	getDescription(block: ToolUse): string {
		return `[operate_device ${block.params.id ?? block.params.ip ?? "?"}: ${block.params.command ?? "?"}]`
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const id: string | undefined = block.params.id
		const ip: string | undefined = block.params.ip
		const command: string | undefined = block.params.command

		if (!id && !ip) {
			config.taskState.consecutiveMistakeCount++
			return formatResponse.toolError("Either id or ip is required for operate_device.")
		}
		if (!command) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "command")
		}

		const device = id ? DeviceRegistry.getById(id) : DeviceRegistry.getByIp(ip!)
		if (!device) {
			config.taskState.consecutiveMistakeCount++
			return formatResponse.toolError(
				`Device not found: ${id ? `id=${id}` : `ip=${ip}`}. Use register_device to add it first.`,
			)
		}

		try {
			const result = await DeviceCommandAdapter.execute(device, command, config.cwd)

			const sayContent = JSON.stringify({
				tool: "operate_device",
				content: `${command} → ${device.name} (${result.success ? "ok" : "failed"})`,
			})
			await config.callbacks.say("tool", sayContent, undefined, undefined, false)

			if (!result.success) {
				return formatResponse.toolError(`Command failed on device "${device.name}": ${result.output}`)
			}

			return [{ type: "text", text: result.output }]
		} catch (error: unknown) {
			return formatResponse.toolError(`operate_device failed: ${error instanceof Error ? error.message : String(error)}`)
		}
	}
}
