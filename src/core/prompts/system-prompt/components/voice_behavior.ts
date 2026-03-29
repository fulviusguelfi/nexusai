import type { PromptVariant, SystemPromptContext } from "../types"

const VOICE_BEHAVIOR_TEXT = `## Voice Input Behavior

When a user message contains \`<voice_input_hint>\` tags, the message was sent via voice input (speech-to-text).

For voice messages: complete the task and call \`attempt_completion\` immediately when done. Do not ask follow-up questions or wait for confirmation — voice UX requires clean, single-shot completion to allow audio playback to proceed without interruption.`

export async function getVoiceBehaviorSection(_variant: PromptVariant, _context: SystemPromptContext): Promise<string> {
	return VOICE_BEHAVIOR_TEXT
}
