import type { PromptVariant, SystemPromptContext } from "../types"

const TONE_INSTRUCTIONS: Record<string, string> = {
	formal: "Use formal language, avoid contractions, write in complete sentences.",
	casual: "Use conversational, friendly language with contractions.",
	technical: "Use precise technical vocabulary. Avoid analogies and simplifications.",
}

const RESPONSE_MODE_INSTRUCTIONS: Record<string, string> = {
	concise: "Keep voice responses under 2 sentences.",
	detailed: "Provide thorough explanations even in voice mode.",
	conversational: "Respond as in natural conversation — match the user's energy and tone.",
}

export async function getVoiceBehaviorSection(_variant: PromptVariant, context: SystemPromptContext): Promise<string> {
	const avatarName = context.avatarName ?? "NexusAI"
	const tone = context.avatarPersonalityTone ?? "casual"
	const responseMode = context.avatarPersonalityResponseMode ?? "concise"

	const toneInstruction = TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.casual
	const responseModeInstruction = RESPONSE_MODE_INSTRUCTIONS[responseMode] ?? RESPONSE_MODE_INSTRUCTIONS.concise

	return `## Voice Input Behavior

When a user message contains \`<voice_input_hint>\` tags, the message was sent via voice input (speech-to-text).

For voice messages: complete the task and call \`attempt_completion\` immediately when done. Do not ask follow-up questions or wait for confirmation — voice UX requires clean, single-shot completion to allow audio playback to proceed without interruption.

## Avatar Identity — ${avatarName}

You are the AI assistant named **${avatarName}**. The user is a human.
NEVER repeat back what the user said verbatim as if you are the user.
Responses must begin from the AI perspective — never echo the transcribed speech.

## Voice Personality

**Tone**: ${toneInstruction}
**Response mode**: ${responseModeInstruction}`
}
