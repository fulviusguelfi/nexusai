import type { ApiHandler } from "@core/api"
import type { ApiStreamUsageChunk } from "@core/api/transform/stream"
import { telemetryService } from "@/services/telemetry"
import { type NexusAIApiReqCancelReason } from "@/shared/ExtensionMessage"
import { Logger } from "@/shared/services/Logger"
import type { MessageStateHandler } from "../message-state"
import { updateApiReqMsg } from "../utils"

export interface StreamTaskMetrics {
	cacheWriteTokens: number
	cacheReadTokens: number
	inputTokens: number
	outputTokens: number
	totalCost: number | undefined
}

export interface StreamMetricsCollectorDeps {
	taskId: string
	ulid: string
	modelId: string
	api: ApiHandler
	messageStateHandler: MessageStateHandler
	lastApiReqIndex: number
	postStateToWebview: () => Promise<void>
	isTaskAborted: () => boolean
	captureTokenUsage?: (
		ulid: string,
		inputTokens: number,
		outputTokens: number,
		modelId: string,
		chunkOptions?: { cacheWriteTokens?: number; cacheReadTokens?: number; totalCost?: number },
	) => Promise<void>
}

export class StreamMetricsCollector {
	readonly metrics: StreamTaskMetrics = {
		cacheWriteTokens: 0,
		cacheReadTokens: 0,
		inputTokens: 0,
		outputTokens: 0,
		totalCost: undefined,
	}

	private didReceiveUsageChunk = false
	private didFinalizeApiReqMsg = false
	private usageChunkSideEffectsQueue = Promise.resolve()

	constructor(private deps: StreamMetricsCollectorDeps) {}

	hasReceivedUsageChunk(): boolean {
		return this.didReceiveUsageChunk
	}

	handleUsageChunk(chunk: ApiStreamUsageChunk): void {
		this.didReceiveUsageChunk = true
		this.metrics.inputTokens += chunk.inputTokens
		this.metrics.outputTokens += chunk.outputTokens
		this.metrics.cacheWriteTokens += chunk.cacheWriteTokens ?? 0
		this.metrics.cacheReadTokens += chunk.cacheReadTokens ?? 0
		this.metrics.totalCost = chunk.totalCost ?? this.metrics.totalCost

		this.queueUsageChunkSideEffects(chunk.inputTokens, chunk.outputTokens, {
			cacheWriteTokens: chunk.cacheWriteTokens,
			cacheReadTokens: chunk.cacheReadTokens,
			totalCost: chunk.totalCost,
		})
	}

	async flushQueuedSideEffects(): Promise<void> {
		await this.usageChunkSideEffectsQueue
	}

	async finalizeApiReqMsg(cancelReason?: NexusAIApiReqCancelReason, streamingFailedMessage?: string): Promise<void> {
		this.didFinalizeApiReqMsg = true
		await this.usageChunkSideEffectsQueue
		await this.updateApiReqMsgFromMetrics(cancelReason, streamingFailedMessage)
	}

	private async updateApiReqMsgFromMetrics(
		cancelReason?: NexusAIApiReqCancelReason,
		streamingFailedMessage?: string,
	): Promise<void> {
		await updateApiReqMsg({
			messageStateHandler: this.deps.messageStateHandler,
			lastApiReqIndex: this.deps.lastApiReqIndex,
			inputTokens: this.metrics.inputTokens,
			outputTokens: this.metrics.outputTokens,
			cacheWriteTokens: this.metrics.cacheWriteTokens,
			cacheReadTokens: this.metrics.cacheReadTokens,
			api: this.deps.api,
			totalCost: this.metrics.totalCost,
			cancelReason,
			streamingFailedMessage,
		})
	}

	private queueUsageChunkSideEffects(
		usageInputTokens: number,
		usageOutputTokens: number,
		chunkOptions?: { cacheWriteTokens?: number; cacheReadTokens?: number; totalCost?: number },
	): void {
		this.usageChunkSideEffectsQueue = this.usageChunkSideEffectsQueue
			.then(async () => {
				if (this.didFinalizeApiReqMsg || this.deps.isTaskAborted()) {
					return
				}

				await this.updateApiReqMsgFromMetrics()
				await this.deps.postStateToWebview()
				const captureTokenUsage = this.deps.captureTokenUsage ?? telemetryService.captureTokenUsage
				await captureTokenUsage(this.deps.ulid, usageInputTokens, usageOutputTokens, this.deps.modelId, chunkOptions)
			})
			.catch((error) => {
				Logger.debug(`[Task ${this.deps.taskId}] Failed to process usage chunk side effects: ${error}`)
			})
	}
}
