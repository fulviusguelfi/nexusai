import { setTimeout as setTimeoutPromise } from "node:timers/promises"
import { telemetryService } from "@/services/telemetry"
import type { NexusAIMessageModelInfo } from "@/shared/messages"
import type { NexusAIAskResponse } from "@/shared/WebviewMessage"
import type { MessageStateHandler } from "../message-state"
import type { StreamTaskMetrics } from "./StreamMetricsCollector"

export interface EmptyResponseHandlerDeps {
	ulid: string
	useNativeToolCalls: () => boolean
	getCurrentProviderInfo: () => { model: { id: string }; providerId: string }
	getApiRequestIdSafe: () => string | undefined
	say: (type: any, text?: string, images?: string[], files?: string[], partial?: boolean) => Promise<any>
	ask: (type: any, text?: string, partial?: boolean) => Promise<{ response: NexusAIAskResponse }>
	messageStateHandler: MessageStateHandler
	captureProviderApiError?: (params: {
		ulid: string
		model: string
		provider: string
		errorMessage: string
		requestId?: string
		isNativeToolCall: boolean
	}) => Promise<void>
}

export interface HandleEmptyResponseParams {
	taskState: { autoRetryAttempts: number }
	modelInfo: NexusAIMessageModelInfo
	requestId?: string
	taskMetrics: StreamTaskMetrics
}

export class EmptyResponseHandler {
	constructor(private deps: EmptyResponseHandlerDeps) {}

	async handle(params: HandleEmptyResponseParams): Promise<boolean> {
		const { taskState, modelInfo, requestId, taskMetrics } = params
		const { model, providerId } = this.deps.getCurrentProviderInfo()
		const reqId = this.deps.getApiRequestIdSafe()
		const captureProviderApiError = this.deps.captureProviderApiError ?? telemetryService.captureProviderApiError

		await captureProviderApiError({
			ulid: this.deps.ulid,
			model: model.id,
			provider: providerId,
			errorMessage: "empty_assistant_message",
			requestId: reqId,
			isNativeToolCall: this.deps.useNativeToolCalls(),
		})

		const baseErrorMessage =
			"Invalid API Response: The provider returned an empty or unparsable response. This is a provider-side issue where the model failed to generate valid output or returned tool calls that Cline cannot process. Retrying the request may help resolve this issue."
		const errorText = reqId ? `${baseErrorMessage} (Request ID: ${reqId})` : baseErrorMessage

		await this.deps.say("error", errorText)
		await this.deps.messageStateHandler.addToApiConversationHistory({
			role: "assistant",
			content: [
				{
					type: "text",
					text: "Failure: I did not provide a response.",
				},
			],
			modelInfo,
			id: requestId,
			metrics: {
				tokens: {
					prompt: taskMetrics.inputTokens,
					completion: taskMetrics.outputTokens,
					cached: (taskMetrics.cacheWriteTokens ?? 0) + (taskMetrics.cacheReadTokens ?? 0),
				},
				cost: taskMetrics.totalCost,
			},
			ts: Date.now(),
		})

		let response: NexusAIAskResponse
		const noResponseErrorMessage =
			"No assistant message was received. " +
			"Possible fixes: try a different model, reduce context size, or check your API provider status."

		if (taskState.autoRetryAttempts < 3) {
			taskState.autoRetryAttempts++
			const delay = 2000 * 2 ** (taskState.autoRetryAttempts - 1)
			response = "yesButtonClicked"
			await this.deps.say(
				"error_retry",
				JSON.stringify({
					attempt: taskState.autoRetryAttempts,
					maxAttempts: 3,
					delaySeconds: delay / 1000,
					errorMessage: noResponseErrorMessage,
				}),
			)
			await setTimeoutPromise(delay)
		} else {
			await this.deps.say(
				"error_retry",
				JSON.stringify({
					attempt: 3,
					maxAttempts: 3,
					delaySeconds: 0,
					failed: true,
					errorMessage: noResponseErrorMessage,
				}),
			)
			const askResult = await this.deps.ask("api_req_failed", noResponseErrorMessage)
			response = askResult.response
			if (response === "yesButtonClicked") {
				taskState.autoRetryAttempts = 0
			}
		}

		if (response === "yesButtonClicked") {
			return false
		}

		return true
	}
}
