import type {
	NexusAIAssistantContent,
	NexusAIAssistantThinkingBlock,
	NexusAIReasoningDetailParam,
	NexusAITextContentBlock,
} from "@/shared/messages"
import type { NexusAIAssistantToolUseBlock } from "@/shared/messages/content"

interface ToolUseHandlerLike {
	getAllFinalizedToolUses(summary?: NexusAIAssistantToolUseBlock["reasoning_details"]): NexusAIAssistantToolUseBlock[]
}

interface ReasonsHandlerLike {
	getRedactedThinking(): NexusAIAssistantContent[]
	getCurrentReasoning(): NexusAIAssistantThinkingBlock | null | undefined
}

export interface AssistantResponseBuildParams {
	reasonsHandler: ReasonsHandlerLike
	toolUseHandler: ToolUseHandlerLike
	assistantTextOnly: string
	assistantTextSignature?: string
	assistantMessageId: string
}

export interface AssistantResponseBuildResult {
	assistantContent: NexusAIAssistantContent[]
	hasAssistantText: boolean
}

export class AssistantResponseBuilder {
	build(params: AssistantResponseBuildParams): AssistantResponseBuildResult {
		const { reasonsHandler, toolUseHandler, assistantTextOnly, assistantTextSignature, assistantMessageId } = params

		const assistantContent: NexusAIAssistantContent[] = [...reasonsHandler.getRedactedThinking()]

		const thinkingBlock = reasonsHandler.getCurrentReasoning()
		if (thinkingBlock) {
			assistantContent.push({ ...thinkingBlock })
		}

		const hasAssistantText = assistantTextOnly.trim().length > 0
		if (hasAssistantText) {
			assistantContent.push({
				type: "text",
				text: assistantTextOnly,
				reasoning_details: thinkingBlock?.summary as NexusAIReasoningDetailParam[] | undefined,
				signature: assistantTextSignature,
				call_id: assistantMessageId,
			} satisfies NexusAITextContentBlock)
		}

		const toolUseBlocks = toolUseHandler.getAllFinalizedToolUses(hasAssistantText ? undefined : thinkingBlock?.summary)
		if (toolUseBlocks.length > 0) {
			assistantContent.push(...toolUseBlocks)
		}

		return {
			assistantContent,
			hasAssistantText,
		}
	}
}
