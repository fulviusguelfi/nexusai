import { ModelFamily } from "@/shared/prompts"
import { NexusAIDefaultTool } from "@/shared/tools"
import type { NexusAIToolSpec } from "../spec"

const id = NexusAIDefaultTool.MQTT_DISCONNECT

const generic: NexusAIToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "mqtt_disconnect",
	description: "Close the active MQTT broker connection opened by mqtt_connect. Always call this when MQTT work is complete.",
	parameters: [],
}

const NATIVE_GPT_5: NexusAIToolSpec = {
	...generic,
	variant: ModelFamily.NATIVE_GPT_5,
}

const NATIVE_NEXT_GEN: NexusAIToolSpec = {
	...NATIVE_GPT_5,
	variant: ModelFamily.NATIVE_NEXT_GEN,
}

export const mqtt_disconnect_variants = [generic, NATIVE_GPT_5, NATIVE_NEXT_GEN]
