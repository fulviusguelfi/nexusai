import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import type { ClineToolSpec } from "../spec"

const id = ClineDefaultTool.DISCOVER_DEVICES

const generic: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "discover_devices",
	description:
		"Scan the local network for devices using mDNS/Bonjour. Returns discovered hostnames, IPs, and inferred device types. " +
		"Use this as the first step before registering or operating a device.",
	parameters: [
		{
			name: "timeout_ms",
			required: false,
			type: "integer",
			instruction: "Duration to scan for mDNS announcements (ms). Defaults to 8000.",
			usage: "8000",
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

export const discover_devices_variants = [generic, NATIVE_GPT_5, NATIVE_NEXT_GEN]
