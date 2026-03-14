import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { DeviceIdentificationService } from "@services/iot/DeviceIdentificationService"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

const SCAN_TIMEOUT_MS = 8_000

export class DiscoverDevicesToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.DISCOVER_DEVICES

	constructor(_validator: ToolValidator) {}

	getDescription(_block: ToolUse): string {
		return "[discover_devices]"
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const timeoutRaw: string | undefined = block.params.timeout_ms
		const timeoutMs = timeoutRaw ? Number.parseInt(timeoutRaw, 10) : SCAN_TIMEOUT_MS

		try {
			const found: Array<{ name: string; ip: string; type: string; protocol: string; serviceType?: string }> = []

			// mDNS discovery via bonjour-service
			try {
				// biome-ignore lint/suspicious/noExplicitAny: bonjour dynamic import
				const bonjourMod: any = await import("bonjour-service")
				const Bonjour = bonjourMod.default ?? bonjourMod.Bonjour ?? bonjourMod
				const bonjour = new Bonjour()

				await new Promise<void>((resolve) => {
					const browser = bonjour.findAll(
						{},
						(svc: { name: string; host: string; type: string; referer: { address: string } }) => {
							const ip = svc.referer?.address ?? svc.host
							const identified = DeviceIdentificationService.identifyFromMdnsType(svc.type)
							found.push({
								name: svc.name,
								ip,
								type: identified.type as string,
								protocol: identified.protocol as string,
								serviceType: svc.type,
							})
						},
					)
					setTimeout(() => {
						browser.stop()
						bonjour.destroy()
						resolve()
					}, timeoutMs)
				})
			} catch (_bonjourErr) {
				// bonjour not available — skip mDNS, continue with empty results
			}

			const sayContent = JSON.stringify({ tool: "discover_devices", content: `found ${found.length} devices` })
			await config.callbacks.say("tool", sayContent, undefined, undefined, false)

			if (found.length === 0) {
				return [{ type: "text", text: "No devices discovered on the local network within the scan window." }]
			}

			const lines = found.map(
				(d) => `• ${d.name} — ${d.ip} [${d.type} / ${d.protocol}]${d.serviceType ? ` (${d.serviceType})` : ""}`,
			)
			return [{ type: "text", text: `Discovered ${found.length} device(s):\n\n${lines.join("\n")}` }]
		} catch (error: unknown) {
			return formatResponse.toolError(`Device discovery failed: ${error instanceof Error ? error.message : String(error)}`)
		}
	}
}
