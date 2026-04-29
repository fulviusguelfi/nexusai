import { Empty } from "@shared/proto/cline/common"
import { AskResponseRequest } from "@shared/proto/cline/task"
import { Logger } from "@/shared/services/Logger"
import { ClineAskResponse } from "../../../shared/WebviewMessage"
import { Controller } from ".."

/**
 * Handles a response from the webview for a previous ask operation
 *
 * @param controller The controller instance
 * @param request The request containing response type, optional text and optional images
 * @returns Empty response
 */
export async function askResponse(controller: Controller, request: AskResponseRequest): Promise<Empty> {
	try {
		if (!controller.task) {
			Logger.warn("askResponse: No active task to receive response")
			return Empty.create()
		}

		// Map the string responseType to the ClineAskResponse enum
		let responseType: ClineAskResponse
		switch (request.responseType) {
			case "yesButtonClicked":
				responseType = "yesButtonClicked"
				break
			case "noButtonClicked":
				responseType = "noButtonClicked"
				break
			case "messageResponse":
				responseType = "messageResponse"
				break
			default:
				Logger.warn(`askResponse: Unknown response type: ${request.responseType}`)
				return Empty.create()
		}

		// If this message follows a voice transcription, mark it as voice input so the task
		// injects the <voice_input_hint> text block that the LLM sees
		if (controller.pendingVoiceInput) {
			controller.task.taskState.isVoiceInput = true
			controller.pendingVoiceInput = false
		}

		// Call the task's handler for webview responses
		await controller.task.handleWebviewAskResponse(responseType, request.text, request.images, request.files)

		// NOTE: Do NOT reset isVoiceInput here. The task's pWaitFor poll (100ms interval)
		// resumes in a future tick — resetting synchronously here would clear the flag
		// before the task loop drives the LLM call and TTS check.
		// isVoiceInput is consumed naturally inside task/index.ts say().

		return Empty.create()
	} catch (error) {
		Logger.error("Error in askResponse handler:", error)
		throw error
	}
}
