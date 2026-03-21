import { AssistantMessageContent, ToolUse } from "@core/assistant-message"
import { sendPartialMessageEvent } from "@core/controller/ui/subscribeToPartialMessage"
import { convertClineMessageToProto } from "@shared/proto-conversions/nexusai-message"
import type { MessageStateHandler } from "../message-state"
import type { TaskState } from "../TaskState"

export class NativeToolCallProcessor {
	constructor(
		private taskState: TaskState,
		private messageStateHandler: MessageStateHandler,
	) {}

	async process(assistantTextOnly: string, toolBlocks: ToolUse[]): Promise<void> {
		if (!toolBlocks?.length) {
			return
		}
		// For native tool calls, mark all pending tool uses as complete
		const prevLength = this.taskState.assistantMessageContent.length

		// Get finalized tool uses and mark them as complete
		const textContent = assistantTextOnly.trim()
		const textBlocks: AssistantMessageContent[] = textContent ? [{ type: "text", content: textContent, partial: false }] : []

		// IMPORTANT: Finalize any partial text NexusAIMessage before we skip over it.
		//
		// When native tool calls are processed, we set currentStreamingContentIndex to skip
		// the text block (line below sets it to textBlocks.length). This means presentAssistantMessage
		// will never call say("text", content, false) for this text block.
		//
		// Without this fix, the partial text NexusAIMessage remains with partial=true. In the UI
		// (ChatView), partial messages that are not the last message don't get displayed anywhere:
		// - Not in completedMessages (because partial=true)
		// - Not in currentMessage (because it's not the last message - tool message came after)
		//
		// The text appears to "disappear" when tool calls start, even though it's still in the array.
		const clineMessages = this.messageStateHandler.getClineMessages()
		const lastMessage = clineMessages.at(-1)
		const shouldFinalizePartialText = textBlocks.length > 0
		if (shouldFinalizePartialText && lastMessage?.partial && lastMessage.type === "say" && lastMessage.say === "text") {
			lastMessage.text = textContent
			lastMessage.partial = false
			await this.messageStateHandler.saveClineMessagesAndUpdateHistory()
			const protoMessage = convertClineMessageToProto(lastMessage)
			await sendPartialMessageEvent(protoMessage)
		}

		this.taskState.assistantMessageContent = [...textBlocks, ...toolBlocks]

		// Reset index to the first tool block position so they can be executed
		// This fixes the issue where tools remain unexecuted because the index
		// advanced past them or was out of bounds during streaming
		if (toolBlocks.length > 0) {
			this.taskState.currentStreamingContentIndex = textBlocks.length
			this.taskState.userMessageContentReady = false
		} else if (this.taskState.assistantMessageContent.length > prevLength) {
			this.taskState.userMessageContentReady = false
		}
	}
}
