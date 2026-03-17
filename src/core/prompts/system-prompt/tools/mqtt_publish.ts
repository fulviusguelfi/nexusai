import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import type { ClineToolSpec } from "../spec"

const id = ClineDefaultTool.MQTT_PUBLISH

const generic: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "mqtt_publish",
	description:
		"Publish a message to an MQTT topic on the active broker connection (established with mqtt_connect). Requires user approval.",
	parameters: [
		{
			name: "topic",
			required: true,
			instruction: "MQTT topic to publish to.",
			usage: "home/livingroom/light/set",
		},
		{
			name: "message",
			required: true,
			instruction: "Message payload to publish (string or JSON).",
			usage: '{"state":"ON","brightness":200}',
		},
		{
			name: "qos",
			required: false,
			type: "integer",
			instruction: "Quality of service level: 0 (at most once), 1 (at least once), 2 (exactly once). Defaults to 0.",
			usage: "1",
		},
		{
			name: "retain",
			required: false,
			type: "boolean",
			instruction: "Whether the broker should retain the message. Defaults to false.",
			usage: "false",
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

export const mqtt_publish_variants = [generic, NATIVE_GPT_5, NATIVE_NEXT_GEN]
