import { ModelFamily } from "@/shared/prompts"
import { NexusAIDefaultTool } from "@/shared/tools"
import type { NexusAIToolSpec } from "../spec"

const id = NexusAIDefaultTool.GET_DEVICE_INFO

const generic: NexusAIToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "get_device_info",
	description:
		"Retrieve the profile of a registered IoT device by ID or IP, or list all registered devices when no query is given.",
	parameters: [
		{
			name: "id",
			required: false,
			instruction: "Device ID returned by register_device or list all. Mutually exclusive with ip.",
			usage: "device-1714000000000",
		},
		{
			name: "ip",
			required: false,
			instruction: "Look up device by IP address. Mutually exclusive with id.",
			usage: "192.168.1.42",
		},
	],
}

const NATIVE_GPT_5: NexusAIToolSpec = {
	...generic,
	variant: ModelFamily.NATIVE_GPT_5,
}

const NATIVE_NEXT_GEN: NexusAIToolSpec = {
	...NATIVE_GPT_5,
	variant: ModelFamily.NATIVE_NEXT_GEN,
}

export const get_device_info_variants = [generic, NATIVE_GPT_5, NATIVE_NEXT_GEN]
