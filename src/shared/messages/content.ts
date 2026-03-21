import { Anthropic } from "@anthropic-ai/sdk"
import { NexusAIMessageMetricsInfo, NexusAIMessageModelInfo } from "./metrics"

export type NexusAIPromptInputContent = string

export type NexusAIMessageRole = "user" | "assistant"

export interface NexusAIReasoningDetailParam {
	type: "reasoning.text" | string
	text: string
	signature: string
	format: "anthropic-claude-v1" | string
	index: number
}

interface NexusAISharedMessageParam {
	// The id of the response that the block belongs to
	call_id?: string
}

export const REASONING_DETAILS_PROVIDERS = ["cline", "openrouter"]

/**
 * An extension of Anthropic.MessageParam that includes Cline-specific fields: reasoning_details.
 * This ensures backward compatibility where the messages were stored in Anthropic format with additional
 * fields unknown to Anthropic SDK.
 */
export interface NexusAITextContentBlock extends Anthropic.TextBlockParam, NexusAISharedMessageParam {
	// reasoning_details only exists for providers listed in REASONING_DETAILS_PROVIDERS
	reasoning_details?: NexusAIReasoningDetailParam[]
	// Thought Signature associates with Gemini
	signature?: string
}

export interface NexusAIImageContentBlock extends Anthropic.ImageBlockParam, NexusAISharedMessageParam {}

export interface NexusAIDocumentContentBlock extends Anthropic.DocumentBlockParam, NexusAISharedMessageParam {}

export interface NexusAIUserToolResultContentBlock extends Anthropic.ToolResultBlockParam, NexusAISharedMessageParam {}

/**
 * Assistant only content types
 */
export interface NexusAIAssistantToolUseBlock extends Anthropic.ToolUseBlockParam, NexusAISharedMessageParam {
	// reasoning_details only exists for providers listed in REASONING_DETAILS_PROVIDERS
	reasoning_details?: unknown[] | NexusAIReasoningDetailParam[]
	// Thought Signature associates with Gemini
	signature?: string
}

export interface NexusAIAssistantThinkingBlock extends Anthropic.ThinkingBlock, NexusAISharedMessageParam {
	// The summary items returned by OpenAI response API
	// The reasoning details that will be moved to the text block when finalized
	summary?: unknown[] | NexusAIReasoningDetailParam[]
}

export interface NexusAIAssistantRedactedThinkingBlock extends Anthropic.RedactedThinkingBlockParam, NexusAISharedMessageParam {}

export type NexusAIToolResponseContent = NexusAIPromptInputContent | Array<NexusAITextContentBlock | NexusAIImageContentBlock>

export type NexusAIUserContent =
	| NexusAITextContentBlock
	| NexusAIImageContentBlock
	| NexusAIDocumentContentBlock
	| NexusAIUserToolResultContentBlock

export type NexusAIAssistantContent =
	| NexusAITextContentBlock
	| NexusAIImageContentBlock
	| NexusAIDocumentContentBlock
	| NexusAIAssistantToolUseBlock
	| NexusAIAssistantThinkingBlock
	| NexusAIAssistantRedactedThinkingBlock

export type NexusAIContent = NexusAIUserContent | NexusAIAssistantContent

/**
 * An extension of Anthropic.MessageParam that includes Cline-specific fields.
 * This ensures backward compatibility where the messages were stored in Anthropic format,
 * while allowing for additional metadata specific to Cline to avoid unknown fields in Anthropic SDK
 * added by ignoring the type checking for those fields.
 */
export interface NexusAIStorageMessage extends Anthropic.MessageParam {
	/**
	 * Response ID associated with this message
	 */
	id?: string
	role: NexusAIMessageRole
	content: NexusAIPromptInputContent | NexusAIContent[]
	/**
	 * NOTE: model information used when generating this message.
	 * Internal use for message conversion only.
	 * MUST be removed before sending message to any LLM provider.
	 */
	modelInfo?: NexusAIMessageModelInfo
	/**
	 * LLM operational and performance metrics for this message
	 * Includes token counts, costs.
	 */
	metrics?: NexusAIMessageMetricsInfo
	/**
	 * Timestamp of when the message was created
	 */
	ts?: number
}

/**
 * Converts NexusAIStorageMessage to Anthropic.MessageParam by removing Cline-specific fields
 * Cline-specific fields (like modelInfo, reasoning_details) are properly omitted.
 */
export function convertClineStorageToAnthropicMessage(
	clineMessage: NexusAIStorageMessage,
	provider = "anthropic",
): Anthropic.MessageParam {
	const { role, content } = clineMessage

	// Handle string content - fast path
	if (typeof content === "string") {
		return { role, content }
	}

	// Removes thinking block that has no signature (invalid thinking block that's incompatible with Anthropic API)
	const filteredContent = content.filter((b) => b.type !== "thinking" || !!b.signature)

	// Handle array content - strip Cline-specific fields for non-reasoning_details providers
	const shouldCleanContent = !REASONING_DETAILS_PROVIDERS.includes(provider)
	const cleanedContent = shouldCleanContent
		? filteredContent.map(cleanContentBlock)
		: (filteredContent as Anthropic.MessageParam["content"])

	return { role, content: cleanedContent }
}

/**
 * Clean a content block by removing Cline-specific fields and returning only Anthropic-compatible fields
 */
export function cleanContentBlock(block: NexusAIContent): Anthropic.ContentBlock {
	// Fast path: if no Cline-specific fields exist, return as-is
	const hasClineFields =
		"reasoning_details" in block ||
		"call_id" in block ||
		"summary" in block ||
		(block.type !== "thinking" && "signature" in block)

	if (!hasClineFields) {
		return block as Anthropic.ContentBlock
	}

	// Removes Cline-specific fields & the signature field that's added for Gemini.
	const { reasoning_details, call_id, summary, ...rest } = block as any

	// Remove signature from non-thinking blocks that were added for Gemini
	if (block.type !== "thinking" && rest.signature) {
		rest.signature = undefined
	}

	return rest satisfies Anthropic.ContentBlock
}
