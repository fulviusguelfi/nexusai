import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { VoiceSessionManager } from "@services/voice/VoiceSessionManager"
import { Logger } from "@/shared/services/Logger"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

export class SpeakTextToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.SPEAK_TEXT

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
			Logger.log("[SpeakText] Skipped — TTS is disabled")
			return formatResponse.toolResult("TTS is disabled. The user can enable it in Settings → Voice. Text was: " + text)
		}

		Logger.log(`[SpeakText] ▶ ${text.length} chars → requestSpeak`)
		Logger.log(`[SpeakText] ─── Full text:\n${text}`)

		config.taskState.consecutiveMistakeCount = 0

		// Create an initial empty "Speaking..." bubble — it will grow sentence by sentence
		await config.callbacks.say("voice_speak", "", undefined, undefined, true)

		// Request audio synthesis via VoiceSessionManager → VscodeWebviewProvider → EdgeTtsService
		// The onSentenceSpoken callback updates the chat bubble only once at the end
		const say = config.callbacks.say
		VoiceSessionManager.getInstance().requestSpeak(
			text,
			async (spokenSoFar: string, isFinal: boolean) => {
				if (!isFinal) {
					return
				}
				try {
					await say("voice_speak", spokenSoFar, undefined, undefined, !isFinal)
				} catch (err) {
					Logger.warn("[SpeakText] onSentenceSpoken say error:", err)
				}
			},
			"speak_text_tool",
		)

		Logger.log("[SpeakText] requestSpeak dispatched")
		return formatResponse.toolResult(`Speaking: "${text}"`)
	}
}
