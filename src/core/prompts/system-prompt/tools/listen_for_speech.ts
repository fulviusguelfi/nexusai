import { ModelFamily } from "@/shared/prompts"
import { NexusAIDefaultTool } from "@/shared/tools"
import type { NexusAIToolSpec } from "../spec"

const id = NexusAIDefaultTool.LISTEN_FOR_SPEECH

const generic: NexusAIToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "listen_for_speech",
	description:
		"Activate the microphone and transcribe the user's speech using the local Whisper STT engine. " +
		"Use this when you need clarification, additional input, or confirmation from the user via voice.",
	parameters: [
		{
			name: "prompt",
			required: false,
			type: "string",
			instruction: "Optional prompt shown to the user before recording starts (≤ 80 chars).",
			usage: "Please describe the error you are seeing.",
		},
	],
}

const NATIVE_GPT_5: NexusAIToolSpec = { ...generic, variant: ModelFamily.NATIVE_GPT_5 }
const NATIVE_NEXT_GEN: NexusAIToolSpec = { ...generic, variant: ModelFamily.NATIVE_NEXT_GEN }

export const listen_for_speech_variants = [generic, NATIVE_GPT_5, NATIVE_NEXT_GEN]
