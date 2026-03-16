import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import type { ClineToolSpec } from "../spec"

const id = ClineDefaultTool.OPERATE_DEVICE

const generic: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "operate_device",
	description:
		"Send a natural-language command to a registered IoT device. The command is automatically translated to the device's native protocol (MQTT, HTTP REST, or SSH). " +
		"The device must be registered first with register_device. Requires user approval.",
	parameters: [
		{
			name: "id",
			required: false,
			instruction: "Device ID. Provide either id or ip.",
			usage: "device-1714000000000",
		},
		{
			name: "ip",
			required: false,
			instruction: "Device IP address. Provide either id or ip.",
			usage: "192.168.1.42",
		},
		{
			name: "command",
			required: true,
			instruction:
				"Natural-language command to send to the device, e.g. 'turn on', 'set brightness 80%', 'reboot', 'get status'.",
			usage: "turn on",
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

export const operate_device_variants = [generic, NATIVE_GPT_5, NATIVE_NEXT_GEN]
