import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { VoiceSessionManager } from "@services/voice/VoiceSessionManager"
import { NexusAIDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

export class SpeakTextToolHandler implements IFullyManagedTool {
	readonly name = NexusAIDefaultTool.SPEAK_TEXT

	constructor(_validator: ToolValidator) {}

	getDescription(_block: ToolUse): string {
		return "[speak_text]"
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const text = block.params.text?.trim()

		if (!text) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(block.name, "text")
		}

		const voiceTtsEnabled = config.services.stateManager.getGlobalStateKey("voiceTtsEnabled")
		if (!voiceTtsEnabled) {
			return formatResponse.toolResult("TTS is disabled. The user can enable it in Settings → Voice. Text was: " + text)
		}

		config.taskState.consecutiveMistakeCount = 0

		// Show in chat
		await config.callbacks.say("voice_speak", text, undefined, undefined, false)

		// Request audio synthesis via VoiceSessionManager → VscodeWebviewProvider → PiperService
		VoiceSessionManager.getInstance().requestSpeak(text)

		return formatResponse.toolResult(`Speaking: "${text}"`)
	}
}
