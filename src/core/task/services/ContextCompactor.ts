import type { ApiHandler } from "@core/api"
import type { ContextManager } from "@core/context/context-management/ContextManager"
import { getHookModelContext } from "@core/hooks/hook-model-context"
import { getHooksEnabledSafe } from "@core/hooks/hooks-utils"
import { executePreCompactHookWithCleanup, HookCancellationError, HookExecution } from "@core/hooks/precompact-executor"
import { ensureTaskDirectoryExists } from "@core/storage/disk"
import { Logger } from "@shared/services/Logger"
import type { ClineStorageMessage } from "@/shared/messages"
import type { StateManager } from "../../storage/StateManager"
import type { MessageStateHandler } from "../message-state"
import type { TaskState } from "../TaskState"

export interface ContextCompactorDeps {
	taskId: string
	ulid: string
	taskState: TaskState
	messageStateHandler: MessageStateHandler
	stateManager: StateManager
	contextManager: ContextManager
	api: ApiHandler
	say: (...args: any[]) => Promise<any>
	setActiveHookExecution: (hookExecution: NonNullable<HookExecution>) => Promise<void>
	clearActiveHookExecution: () => Promise<void>
	postStateToWebview: () => Promise<void>
	cancelTask: () => Promise<void>
}

export class ContextCompactor {
	constructor(private deps: ContextCompactorDeps) {}

	calculatePreCompactDeletedRange(apiConversationHistory: ClineStorageMessage[]): [number, number] {
		const newDeletedRange = this.deps.contextManager.getNextTruncationRange(
			apiConversationHistory,
			this.deps.taskState.conversationHistoryDeletedRange,
			"quarter", // Force aggressive truncation on error
		)

		return newDeletedRange || [0, 0]
	}

	async handleContextWindowExceededError(): Promise<void> {
		const apiConversationHistory = this.deps.messageStateHandler.getApiConversationHistory()

		// Run PreCompact hook before truncation
		const hooksEnabled = getHooksEnabledSafe(this.deps.stateManager.getGlobalSettingsKey("hooksEnabled"))
		if (hooksEnabled) {
			try {
				// Calculate what the new deleted range will be
				const deletedRange = this.calculatePreCompactDeletedRange(apiConversationHistory)

				// Execute hook - throws HookCancellationError if cancelled
				await executePreCompactHookWithCleanup({
					taskId: this.deps.taskId,
					ulid: this.deps.ulid,
					modelContext: getHookModelContext(this.deps.api, this.deps.stateManager),
					apiConversationHistory,
					conversationHistoryDeletedRange: this.deps.taskState.conversationHistoryDeletedRange,
					contextManager: this.deps.contextManager,
					clineMessages: this.deps.messageStateHandler.getClineMessages(),
					messageStateHandler: this.deps.messageStateHandler,
					compactionStrategy: "standard-truncation-lastquarter",
					deletedRange,
					say: this.deps.say,
					setActiveHookExecution: async (hookExecution: HookExecution | undefined) => {
						if (hookExecution) {
							await this.deps.setActiveHookExecution(hookExecution)
						}
					},
					clearActiveHookExecution: this.deps.clearActiveHookExecution,
					postStateToWebview: this.deps.postStateToWebview,
					taskState: this.deps.taskState,
					cancelTask: this.deps.cancelTask,
					hooksEnabled,
				})
			} catch (error) {
				// If hook was cancelled, re-throw to stop compaction
				if (error instanceof HookCancellationError) {
					throw error
				}

				// Graceful degradation: Log error but continue with truncation
				Logger.error("[PreCompact] Hook execution failed:", error)
			}
		}

		// Proceed with standard truncation
		const newDeletedRange = this.deps.contextManager.getNextTruncationRange(
			apiConversationHistory,
			this.deps.taskState.conversationHistoryDeletedRange,
			"quarter", // Force aggressive truncation
		)

		this.deps.taskState.conversationHistoryDeletedRange = newDeletedRange

		await this.deps.messageStateHandler.saveClineMessagesAndUpdateHistory()
		await this.deps.contextManager.triggerApplyStandardContextTruncationNoticeChange(
			Date.now(),
			await ensureTaskDirectoryExists(this.deps.taskId),
			apiConversationHistory,
		)

		this.deps.taskState.didAutomaticallyRetryFailedApiRequest = true
	}
}
