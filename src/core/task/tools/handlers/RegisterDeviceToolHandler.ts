import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { DeviceRegistry } from "@services/iot/DeviceRegistry"
import type { DeviceProfile } from "@shared/iot/DeviceProfile"
import { DeviceProtocol, DeviceType } from "@shared/iot/DeviceProfile"
import { NexusAIDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

export class RegisterDeviceToolHandler implements IFullyManagedTool {
	readonly name = NexusAIDefaultTool.REGISTER_DEVICE

	constructor(_validator: ToolValidator) {}

	getDescription(block: ToolUse): string {
		return `[register_device ${block.params.name ?? "unnamed"}@${block.params.ip ?? "?"}]`
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const name: string | undefined = block.params.name
		const ip: string | undefined = block.params.ip
		const typeRaw: string | undefined = block.params.type
		const protocolRaw: string | undefined = block.params.protocol
		const credentialsRaw: string | undefined = block.params.credentials
		const capabilitiesRaw: string | undefined = block.params.capabilities
		const trustedLocal = block.params.trusted_local === "true"
		const notes: string | undefined = block.params.notes

		if (!name) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "name")
		}
		if (!ip) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "ip")
		}

		const deviceType: DeviceType = typeRaw
			? (DeviceType[typeRaw as keyof typeof DeviceType] ?? DeviceType.UNKNOWN)
			: DeviceType.UNKNOWN

		const protocol: DeviceProtocol = protocolRaw
			? (DeviceProtocol[protocolRaw as keyof typeof DeviceProtocol] ?? DeviceProtocol.UNKNOWN)
			: DeviceProtocol.UNKNOWN

		let credentials: Record<string, string> | undefined
		if (credentialsRaw) {
			try {
				credentials = JSON.parse(credentialsRaw)
			} catch {
				config.taskState.consecutiveMistakeCount++
				return formatResponse.toolError("Invalid JSON in credentials parameter.")
			}
		}

		const capabilities: string[] = capabilitiesRaw
			? capabilitiesRaw
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean)
			: []

		const existing = DeviceRegistry.getByIp(ip)
		const profile: DeviceProfile = {
			id: existing?.id ?? `device-${Date.now()}`,
			name,
			ip,
			type: deviceType,
			protocol,
			credentials,
			capabilities,
			lastSeen: Date.now(),
			trustedLocal,
			notes,
		}

		DeviceRegistry.upsert(profile)

		const sayContent = JSON.stringify({ tool: "register_device", content: `registered ${name} (${ip})` })
		await config.callbacks.say("tool", sayContent, undefined, undefined, false)

		const action = existing ? "updated" : "registered"
		return [
			{
				type: "text",
				text: `Device ${action}: ${name} (${ip}) — type=${deviceType as string}, protocol=${protocol as string}, trustedLocal=${trustedLocal}.`,
			},
		]
	}
}
