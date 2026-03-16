import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { DeviceRegistry } from "@services/iot/DeviceRegistry"
import type { DeviceProfile } from "@shared/iot/DeviceProfile"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

export class GetDeviceInfoToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.GET_DEVICE_INFO

	constructor(_validator: ToolValidator) {}

	getDescription(block: ToolUse): string {
		return `[get_device_info ${block.params.id ?? block.params.ip ?? "all"}]`
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const id: string | undefined = block.params.id
		const ip: string | undefined = block.params.ip

		if (!id && !ip) {
			// Return all devices
			const devices = DeviceRegistry.getAll()
			if (devices.length === 0) {
				return [{ type: "text", text: "No devices registered. Use discover_devices or register_device first." }]
			}
			const lines = devices.map((d) => formatDeviceLine(d))

			return [{ type: "text", text: `${devices.length} registered device(s):\n\n${lines.join("\n")}` }]
		}

		const device = id ? DeviceRegistry.getById(id) : DeviceRegistry.getByIp(ip!)
		if (!device) {
			config.taskState.consecutiveMistakeCount++
			return formatResponse.toolError(
				`Device not found: ${id ? `id=${id}` : `ip=${ip}`}. Use register_device to add it first.`,
			)
		}

		const sayContent = JSON.stringify({ tool: "get_device_info", content: `retrieved info for ${device.name}` })
		await config.callbacks.say("tool", sayContent, undefined, undefined, false)

		const detail = [
			`Name: ${device.name}`,
			`ID: ${device.id}`,
			`IP: ${device.ip}`,
			device.mac ? `MAC: ${device.mac}` : null,
			device.vendor ? `Vendor: ${device.vendor}` : null,
			`Type: ${device.type}`,
			`Protocol: ${device.protocol}`,
			`Capabilities: ${device.capabilities.join(", ") || "(none)"}`,
			`Trusted local: ${device.trustedLocal}`,
			`Last seen: ${new Date(device.lastSeen).toISOString()}`,
			device.notes ? `Notes: ${device.notes}` : null,
		]
			.filter(Boolean)
			.join("\n")

		return [{ type: "text", text: detail }]
	}
}

function formatDeviceLine(d: DeviceProfile): string {
	return `• [${d.id}] ${d.name} — ${d.ip} [${d.type} / ${d.protocol}]`
}
