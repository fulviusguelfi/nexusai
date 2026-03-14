import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import type { ClineToolSpec } from "../spec"

const id = ClineDefaultTool.REGISTER_DEVICE

const generic: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "register_device",
	description:
		"Save or update a device profile in the persistent IoT device registry. " +
		"Registered devices can be operated with operate_device and are queryable with get_device_info. " +
		"Set trusted_local=true to allow http_request to call this device's local IP. Requires user approval.",
	parameters: [
		{
			name: "name",
			required: true,
			instruction: "Human-readable name for the device.",
			usage: "Living Room Bulb",
		},
		{
			name: "ip",
			required: true,
			instruction: "IP address of the device.",
			usage: "192.168.1.42",
		},
		{
			name: "type",
			required: false,
			instruction: "Device type enum: COMPUTER, SMART_BULB, SMART_SPEAKER, MQTT_SENSOR, ROUTER, UNKNOWN.",
			usage: "SMART_BULB",
		},
		{
			name: "protocol",
			required: false,
			instruction: "Primary protocol: SSH, MQTT, HTTP_REST, UPNP, UNKNOWN.",
			usage: "HTTP_REST",
		},
		{
			name: "credentials",
			required: false,
			instruction: "JSON object of credential key-value pairs (e.g. API key, username/password).",
			usage: '{"api_key":"abc123"}',
		},
		{
			name: "capabilities",
			required: false,
			instruction: "Comma-separated list of capability strings or API base URLs.",
			usage: "http://192.168.1.42,brightness,color",
		},
		{
			name: "trusted_local",
			required: false,
			type: "boolean",
			instruction: "When true, http_request is allowed to call this device's IP (exempts SSRF guard). Defaults to false.",
			usage: "true",
		},
		{
			name: "notes",
			required: false,
			instruction: "Free-form notes about the device.",
			usage: "Philips Hue bulb in bedroom",
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

export const register_device_variants = [generic, NATIVE_GPT_5, NATIVE_NEXT_GEN]
