import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import type { ClineToolSpec } from "../spec"

const id = ClineDefaultTool.SPEAK_TEXT

const generic: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "speak_text",
	description:
		"Synthesize text to speech using the local Piper TTS engine and play it through the user's speakers. " +
		"Use this to narrate responses, read results aloud, or provide audio confirmation of completed actions.",
	parameters: [
		{
			name: "text",
			required: true,
			type: "string",
			instruction: "The text to speak. Keep it concise (≤ 200 words) for best latency.",
			usage: "Hello! I have completed the task you requested.",
		},
	],
}

const NATIVE_GPT_5: ClineToolSpec = { ...generic, variant: ModelFamily.NATIVE_GPT_5 }
const NATIVE_NEXT_GEN: ClineToolSpec = { ...generic, variant: ModelFamily.NATIVE_NEXT_GEN }

export const speak_text_variants = [generic, NATIVE_GPT_5, NATIVE_NEXT_GEN]
