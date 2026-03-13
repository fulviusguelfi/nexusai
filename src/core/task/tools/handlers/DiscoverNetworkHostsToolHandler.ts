import { execSync } from "node:child_process"
import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

const MAX_HOST_LINES = 200

export class DiscoverNetworkHostsToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.DISCOVER_NETWORK_HOSTS

	constructor(
		_validator: ToolValidator,
		private readonly _execSync: typeof execSync = execSync,
	) {}

	getDescription(_block: ToolUse): string {
		return "[discover_network_hosts]"
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const subnet: string | undefined = block.params.subnet

		try {
			let output: string
			const isWin = process.platform === "win32"

			// Use ARP table to list known hosts on the local network.
			// On Windows: arp -a; on Unix: try arp -n first, fall back to arp -a
			try {
				if (isWin) {
					output = this._execSync("arp -a", { encoding: "utf8", timeout: 10_000 })
				} else {
					try {
						output = this._execSync("arp -n", { encoding: "utf8", timeout: 10_000 })
					} catch {
						output = this._execSync("arp -a", { encoding: "utf8", timeout: 10_000 })
					}
				}
			} catch {
				output = ""
			}

			// If a subnet filter was requested, apply it
			const lines = output.trim().split("\n")
			const filtered = subnet
				? lines.filter((l) => l.includes(subnet.split("/")[0].split(".").slice(0, 3).join(".")))
				: lines

			const result = filtered
				.filter((l) => l.trim().length > 0)
				.slice(0, MAX_HOST_LINES)
				.join("\n")

			await config.callbacks.say("tool", "[discover_network_hosts]")
			return [{ type: "text", text: result || "No hosts discovered in ARP table." }]
		} catch (error: unknown) {
			return formatResponse.toolError(
				`Failed to discover network hosts: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}
}
