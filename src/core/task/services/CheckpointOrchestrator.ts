import { FileContextTracker } from "@core/context/context-tracking/FileContextTracker"
import { WorkspaceRootManager } from "@core/workspace/WorkspaceRootManager"
import { buildCheckpointManager, shouldUseMultiRoot } from "@integrations/checkpoints/factory"
import { ensureCheckpointInitialized } from "@integrations/checkpoints/initializer"
import { ICheckpointManager } from "@integrations/checkpoints/types"
import { DiffViewProvider } from "@integrations/editor/DiffViewProvider"
import { findLastIndex } from "@shared/array"
import { HistoryItem } from "@shared/HistoryItem"
import { Logger } from "@shared/services/Logger"
import { READ_ONLY_TOOLS } from "@shared/tools"
import { HostProvider } from "@/hosts/host-provider"
import { ShowMessageType } from "@/shared/proto/index.host"
import type { StateManager } from "../../storage/StateManager"
import type { MessageStateHandler } from "../message-state"
import type { TaskState } from "../TaskState"

export interface CheckpointOrchestratorDeps {
	taskId: string
	taskState: TaskState
	messageStateHandler: MessageStateHandler
	fileContextTracker: FileContextTracker
	diffViewProvider: DiffViewProvider
	workspaceManager: WorkspaceRootManager | undefined
	stateManager: StateManager
	updateTaskHistory: (historyItem: HistoryItem) => Promise<HistoryItem[]>
	say: (...args: any[]) => Promise<any>
	cancelTask: () => Promise<void>
	postStateToWebview: () => Promise<void>
	initialConversationHistoryDeletedRange?: [number, number]
	initialCheckpointManagerErrorMessage?: string
}

export class CheckpointOrchestrator {
	private _checkpointManager?: ICheckpointManager
	private _initialCheckpointCommitPromise?: Promise<string | undefined>

	constructor(private deps: CheckpointOrchestratorDeps) {
		this._initialize()
	}

	private _initialize(): void {
		const { taskState, workspaceManager, stateManager } = this.deps
		const isMultiRootWorkspace = workspaceManager && workspaceManager.getRoots().length > 1
		const checkpointsEnabled = stateManager.getGlobalSettingsKey("enableCheckpointsSetting")

		if (isMultiRootWorkspace && checkpointsEnabled) {
			taskState.checkpointManagerErrorMessage = "Checkpoints are not currently supported in multi-root workspaces."
		}

		if (!isMultiRootWorkspace) {
			try {
				this._checkpointManager = buildCheckpointManager({
					taskId: this.deps.taskId,
					messageStateHandler: this.deps.messageStateHandler,
					fileContextTracker: this.deps.fileContextTracker,
					diffViewProvider: this.deps.diffViewProvider,
					taskState,
					workspaceManager,
					updateTaskHistory: this.deps.updateTaskHistory,
					say: this.deps.say,
					cancelTask: this.deps.cancelTask,
					postStateToWebview: this.deps.postStateToWebview,
					initialConversationHistoryDeletedRange: this.deps.initialConversationHistoryDeletedRange,
					initialCheckpointManagerErrorMessage: this.deps.initialCheckpointManagerErrorMessage,
					stateManager,
				})

				if (
					shouldUseMultiRoot({
						workspaceManager,
						enableCheckpoints: stateManager.getGlobalSettingsKey("enableCheckpointsSetting"),
						stateManager,
					})
				) {
					this._checkpointManager.initialize?.().catch((error: Error) => {
						Logger.error("Failed to initialize multi-root checkpoint manager:", error)
						taskState.checkpointManagerErrorMessage = error?.message || String(error)
					})
				}
			} catch (error) {
				Logger.error("Failed to initialize checkpoint manager:", error)
				if (stateManager.getGlobalSettingsKey("enableCheckpointsSetting")) {
					const errorMessage = error instanceof Error ? error.message : "Unknown error"
					HostProvider.window.showMessage({
						type: ShowMessageType.ERROR,
						message: `Failed to initialize checkpoint manager: ${errorMessage}`,
					})
				}
			}
		}
	}

	get checkpointManager(): ICheckpointManager | undefined {
		return this._checkpointManager
	}

	get initialCheckpointCommitPromise(): Promise<string | undefined> | undefined {
		return this._initialCheckpointCommitPromise
	}

	async saveCheckpoint(isAttemptCompletionMessage?: boolean, completionMessageTs?: number): Promise<void> {
		return this._checkpointManager?.saveCheckpoint(isAttemptCompletionMessage, completionMessageTs) ?? Promise.resolve()
	}

	/**
	 * Block unsafe (write) tools until the initial checkpoint commit finishes.
	 * Read-only tools are allowed through immediately.
	 */
	async waitForInitialCommitIfNeeded(blockName: string): Promise<void> {
		if (this._initialCheckpointCommitPromise && !READ_ONLY_TOOLS.includes(blockName as any)) {
			await this._initialCheckpointCommitPromise
			this._initialCheckpointCommitPromise = undefined
		}
	}

	/**
	 * On the first API request, kick off non-blocking checkpoint initialization.
	 * Stores a promise so that write-tools can await it before executing.
	 */
	maybeRunFirstRequestInit(isFirstRequest: boolean): void {
		const { taskState, stateManager, messageStateHandler } = this.deps

		if (
			!isFirstRequest ||
			!stateManager.getGlobalSettingsKey("enableCheckpointsSetting") ||
			!this._checkpointManager ||
			taskState.checkpointManagerErrorMessage
		) {
			return
		}

		const checkpointInitPromise = ensureCheckpointInitialized({ checkpointManager: this._checkpointManager })
			.then(async () => {
				await this.deps.say("checkpoint_created")
				const lastCheckpointMessageIndex = findLastIndex(
					messageStateHandler.getClineMessages(),
					(m) => m.say === "checkpoint_created",
				)
				if (lastCheckpointMessageIndex !== -1) {
					const commitPromise = this._checkpointManager?.commit()
					this._initialCheckpointCommitPromise = commitPromise
					commitPromise
						?.then(async (commitHash) => {
							if (commitHash) {
								await messageStateHandler.updateClineMessage(lastCheckpointMessageIndex, {
									lastCheckpointHash: commitHash,
								})
							}
						})
						.catch((error) => {
							Logger.error(
								`[TaskCheckpointManager] Failed to create checkpoint commit for task ${this.deps.taskId}:`,
								error,
							)
						})
				}
			})
			.catch((error) => {
				const errorMessage = error instanceof Error ? error.message : "Unknown error"
				Logger.error("Failed to initialize checkpoint manager:", errorMessage)
				taskState.checkpointManagerErrorMessage = errorMessage
				HostProvider.window.showMessage({
					type: ShowMessageType.WARNING,
					message: `Checkpoint initialization timed out: ${errorMessage}`,
				})
			})

		this._initialCheckpointCommitPromise = checkpointInitPromise.then(() => undefined)
	}
}
