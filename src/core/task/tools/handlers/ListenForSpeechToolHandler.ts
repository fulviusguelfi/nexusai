import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { VoiceSessionManager } from "@services/voice/VoiceSessionManager"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

const LISTEN_TIMEOUT_MS = 30_000

export class ListenForSpeechToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.LISTEN_FOR_SPEECH

	constructor(_validator: ToolValidator) {}

	getDescription(_block: ToolUse): string {
		return "[listen_for_speech]"
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const voiceSttEnabled = config.services.stateManager.getGlobalStateKey("voiceSttEnabled")
		if (!voiceSttEnabled) {
			return formatResponse.toolResult("STT is disabled. The user can enable it in Settings → Voice.")
		}

		config.taskState.consecutiveMistakeCount = 0

		const prompt = block.params.prompt?.trim() ?? "Please speak now. Hold the microphone button."

		// Show the prompt in chat so the user knows the AI is waiting
		await config.callbacks.say("voice_listen", prompt, undefined, undefined, false)

		// Wait for the user to record and transcribe
		const transcription = await VoiceSessionManager.getInstance().waitForTranscription(LISTEN_TIMEOUT_MS)

		if (!transcription) {
			return formatResponse.toolResult("No speech was captured within the timeout window.")
		}

		return formatResponse.toolResult(`User said: "${transcription}"`)
	}
}
