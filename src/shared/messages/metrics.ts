import { Mode } from "../storage/types"

export interface NexusAIMessageModelInfo {
	modelId: string
	providerId: string
	mode: Mode
}

interface NexusAITokensInfo {
	prompt: number // Total input tokens (includes cached + non-cached)
	completion: number // Total output tokens
	cached: number // Subset of prompt_tokens that were cache hits
}

export interface NexusAIMessageMetricsInfo {
	tokens?: NexusAITokensInfo
	cost?: number // Monetary cost for this turn
}
