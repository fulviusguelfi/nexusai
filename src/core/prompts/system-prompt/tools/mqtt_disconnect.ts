import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import type { ClineToolSpec } from "../spec"

const id = ClineDefaultTool.MQTT_DISCONNECT

const generic: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "mqtt_disconnect",
	description: "Close the active MQTT broker connection opened by mqtt_connect. Always call this when MQTT work is complete.",
	parameters: [],
}

const NATIVE_GPT_5: ClineToolSpec = {
	...generic,
	variant: ModelFamily.NATIVE_GPT_5,
}

const NATIVE_NEXT_GEN: ClineToolSpec = {
	...NATIVE_GPT_5,
	variant: ModelFamily.NATIVE_NEXT_GEN,
}

export const mqtt_disconnect_variants = [generic, NATIVE_GPT_5, NATIVE_NEXT_GEN]
