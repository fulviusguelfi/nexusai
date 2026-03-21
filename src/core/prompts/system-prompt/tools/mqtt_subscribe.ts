import { ModelFamily } from "@/shared/prompts"
import { NexusAIDefaultTool } from "@/shared/tools"
import type { NexusAIToolSpec } from "../spec"

const id = NexusAIDefaultTool.MQTT_SUBSCRIBE

const generic: NexusAIToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "mqtt_subscribe",
	description:
		"Subscribe to an MQTT topic and capture incoming messages for a limited time window. Returns the received messages. Uses the active mqtt_connect session.",
	parameters: [
		{
			name: "topic",
			required: true,
			instruction: "MQTT topic filter to subscribe to. Supports wildcards (+, #).",
			usage: "home/sensors/#",
		},
		{
			name: "timeout_ms",
			required: false,
			type: "integer",
			instruction: "How long to wait for messages (ms). Defaults to 5000.",
			usage: "5000",
		},
		{
			name: "max_messages",
			required: false,
			type: "integer",
			instruction: "Stop early after this many messages. Defaults to 50.",
			usage: "10",
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

export const mqtt_subscribe_variants = [generic, NATIVE_GPT_5, NATIVE_NEXT_GEN]
