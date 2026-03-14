import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import type { ClineToolSpec } from "../spec"

const id = ClineDefaultTool.DISCOVER_NETWORK_HOSTS

const generic: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "discover_network_hosts",
	description:
		"Discover machines currently reachable on the local network by querying the system ARP table. Returns IP addresses, MAC addresses, and interface information for known hosts. Useful before attempting SSH connections to identify available targets.",
	parameters: [
		{
			name: "subnet",
			required: false,
			instruction: "Optional subnet prefix to filter results, e.g. '192.168.1'. If omitted, returns all ARP table entries.",
			usage: "192.168.1",
		},
	],
}

const NATIVE_GPT_5: ClineToolSpec = {
	...generic,
	variant: ModelFamily.NATIVE_GPT_5,
}

const NATIVE_NEXT_GEN: ClineToolSpec = {
	...NATIVE_GPT_5,
	variant: ModelFamily.NATIVE_NEXT_GEN,
}

export const discover_network_hosts_variants = [generic, NATIVE_GPT_5, NATIVE_NEXT_GEN]
