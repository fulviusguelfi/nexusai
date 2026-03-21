import { ModelFamily } from "@/shared/prompts"
import { NexusAIDefaultTool } from "@/shared/tools"
import type { NexusAIToolSpec } from "../spec"

// HACK: Placeholder to act as tool dependency
const generic: NexusAIToolSpec = {
	variant: ModelFamily.GENERIC,
	id: NexusAIDefaultTool.TODO,
	name: "focus_chain",
	description: "",
	contextRequirements: (context) => context.focusChainSettings?.enabled === true,
}

export const focus_chain_variants = [generic]
