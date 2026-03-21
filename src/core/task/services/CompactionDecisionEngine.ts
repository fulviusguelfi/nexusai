import type { ApiHandler, ApiProviderInfo } from "@core/api"
import type { ContextManager } from "@core/context/context-management/ContextManager"
import { ensureTaskDirectoryExists } from "@core/storage/disk"
import { Logger } from "@shared/services/Logger"
import { isLocalModel, isNextGenModelFamily } from "@utils/model-utils"
import type { StateManager } from "../../storage/StateManager"
import type { MessageStateHandler } from "../message-state"
import type { TaskState } from "../TaskState"

export interface CompactionDecisionDeps {
	taskId: string
	taskState: TaskState
	messageStateHandler: MessageStateHandler
	contextManager: ContextManager
	stateManager: StateManager
	api: ApiHandler
	getCurrentProviderInfo: () => ApiProviderInfo
}

export interface CompactionResult {
	shouldCompact: boolean
	useCompactPrompt: boolean
}

export class CompactionDecisionEngine {
	constructor(private deps: CompactionDecisionDeps) {}

	/**
	 * Determine whether the context window should be compacted before the next API request.
	 * Also handles post-summarization deleted-range expansion when needed.
	 * Returns { shouldCompact, useCompactPrompt } to drive context loading in the caller.
	 */
	async decide(previousApiReqIndex: number): Promise<CompactionResult> {
		const { taskState, messageStateHandler, contextManager, stateManager, api, getCurrentProviderInfo } = this.deps

		const providerInfo = getCurrentProviderInfo()
		const useCompactPrompt = providerInfo.customPrompt === "compact" && isLocalModel(providerInfo)
		let shouldCompact = false

		const useAutoCondense = stateManager.getGlobalSettingsKey("useAutoCondense")

		if (useAutoCondense && isNextGenModelFamily(api.getModel().id)) {
			if (taskState.currentlySummarizing) {
				taskState.currentlySummarizing = false

				if (taskState.conversationHistoryDeletedRange) {
					const [start, end] = taskState.conversationHistoryDeletedRange
					const apiHistory = messageStateHandler.getApiConversationHistory()

					const safeEnd = Math.min(end + 2, apiHistory.length - 1)
					if (end + 2 <= safeEnd) {
						taskState.conversationHistoryDeletedRange = [start, end + 2]
						await messageStateHandler.saveClineMessagesAndUpdateHistory()
					}
				}
			} else {
				shouldCompact = contextManager.shouldCompactContextWindow(
					messageStateHandler.getClineMessages(),
					api,
					previousApiReqIndex,
				)

				if (shouldCompact && taskState.conversationHistoryDeletedRange) {
					const apiHistory = messageStateHandler.getApiConversationHistory()
					const activeMessageCount = apiHistory.length - taskState.conversationHistoryDeletedRange[1] - 1

					if (activeMessageCount <= 2) {
						shouldCompact = false
					}
				}

				if (shouldCompact) {
					try {
						const taskDir = await ensureTaskDirectoryExists(this.deps.taskId)
						shouldCompact = await contextManager.attemptFileReadOptimization(
							messageStateHandler.getApiConversationHistory(),
							taskState.conversationHistoryDeletedRange,
							messageStateHandler.getClineMessages(),
							previousApiReqIndex,
							taskDir,
						)
					} catch (error) {
						Logger.error("[CompactionDecisionEngine] attemptFileReadOptimization failed:", error)
					}
				}
			}
		}

		return { shouldCompact, useCompactPrompt }
	}
}
