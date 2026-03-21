import { ModelFamily } from "@/shared/prompts"
import { NexusAIDefaultTool } from "@/shared/tools"
import type { NexusAIToolSpec } from "../spec"

const id = NexusAIDefaultTool.MQTT_CONNECT

const generic: NexusAIToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "mqtt_connect",
	description:
		"Connect to an MQTT broker. The session persists for the task and can be used with mqtt_publish, mqtt_subscribe, and mqtt_disconnect. Requires user approval.",
	parameters: [
		{
			name: "broker",
			required: true,
			instruction: "Hostname or IP address of the MQTT broker.",
			usage: "192.168.1.200",
		},
		{
			name: "port",
			required: false,
			type: "integer",
			instruction: "MQTT broker port. Defaults to 1883.",
			usage: "1883",
		},
		{
			name: "client_id",
			required: false,
			instruction: "MQTT client ID. Auto-generated if not provided.",
			usage: "nexusai-client-1",
		},
		{
			name: "username",
			required: false,
			instruction: "MQTT username for authentication.",
			usage: "mqttuser",
		},
		{
			name: "password",
			required: false,
			instruction: "MQTT password for authentication.",
			usage: "mypassword",
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

export const mqtt_connect_variants = [generic, NATIVE_GPT_5, NATIVE_NEXT_GEN]
