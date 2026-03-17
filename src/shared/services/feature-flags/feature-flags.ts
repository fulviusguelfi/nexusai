import type { FeatureFlagPayload } from "@/services/feature-flags/providers/IFeatureFlagsProvider"

export enum FeatureFlag {
	WEBTOOLS = "webtools",
	WORKTREES = "worktree-exp",
	// Feature flag for showing the new onboarding flow or old welcome view.
	ONBOARDING_MODELS = "onboarding_models",
	// Feature flag for upstream Cline recommended model cards
	CLINE_RECOMMENDED_MODELS_UPSTREAM = "cline-recommended-models-upstream",
	// Rollout flag for Cline provider model sourcing:
	// off => OpenRouter model list, on => Cline endpoint model list.
	EXTENSION_CLINE_MODELS_ENDPOINT = "extension_cline_models_endpoint",
	// Use the websocket mode for OpenAI native Responses API format
	OPENAI_RESPONSES_WEBSOCKET_MODE = "openai-responses-websocket-mode",
}

export const FeatureFlagDefaultValue: Partial<Record<FeatureFlag, FeatureFlagPayload>> = {
	[FeatureFlag.WEBTOOLS]: false,
	[FeatureFlag.WORKTREES]: false,
	[FeatureFlag.ONBOARDING_MODELS]: process.env.E2E_TEST === "true" ? { models: {} } : undefined,
	[FeatureFlag.CLINE_RECOMMENDED_MODELS_UPSTREAM]: false,
	[FeatureFlag.EXTENSION_CLINE_MODELS_ENDPOINT]: false,
	[FeatureFlag.OPENAI_RESPONSES_WEBSOCKET_MODE]: false,
}

export const FEATURE_FLAGS = Object.values(FeatureFlag)
