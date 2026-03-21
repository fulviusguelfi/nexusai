import {
	isGLMModelFamily,
	isLocalModel,
	isNextGenModelFamily,
	isNextGenModelProvider,
	isTrinityModelFamily,
} from "@utils/model-utils"
import { ModelFamily } from "@/shared/prompts"
import { Logger } from "@/shared/services/Logger"
import { NexusAIDefaultTool } from "@/shared/tools"
import { SystemPromptSection } from "../../templates/placeholders"
import { createVariant } from "../variant-builder"
import { validateVariant } from "../variant-validator"
import { baseTemplate } from "./template"

export const config = createVariant(ModelFamily.GENERIC)
	.description("The fallback prompt for generic use cases and models.")
	.version(1)
	.tags("fallback", "stable")
	.labels({
		stable: 1,
		fallback: 1,
	})
	// Generic matcher - fallback for everything that doesn't match other variants
	// This will match anything that doesn't match the other specific variants
	.matcher((context) => {
		const providerInfo = context.providerInfo
		if (!providerInfo.providerId || !providerInfo.model.id) {
			return true
		}
		const modelId = providerInfo.model.id.toLowerCase()
		return (
			// Not a local model with compact prompt enabled
			!(providerInfo.customPrompt === "compact" && isLocalModel(providerInfo)) &&
			// Not a next-gen model
			!(isNextGenModelProvider(providerInfo) && isNextGenModelFamily(modelId)) &&
			// Not a GLM model
			!isGLMModelFamily(modelId) &&
			// Not a Trinity model
			!isTrinityModelFamily(modelId)
		)
	})
	.template(baseTemplate)
	.components(
		SystemPromptSection.AGENT_ROLE,
		SystemPromptSection.TOOL_USE,
		SystemPromptSection.TASK_PROGRESS,
		SystemPromptSection.MCP,
		SystemPromptSection.EDITING_FILES,
		SystemPromptSection.ACT_VS_PLAN,
		SystemPromptSection.CAPABILITIES,
		SystemPromptSection.RULES,
		SystemPromptSection.SYSTEM_INFO,
		SystemPromptSection.OBJECTIVE,
		SystemPromptSection.USER_INSTRUCTIONS,
		SystemPromptSection.SKILLS,
	)
	.tools(
		NexusAIDefaultTool.BASH,
		NexusAIDefaultTool.LIST_PROCESSES,
		NexusAIDefaultTool.KILL_PROCESS,
		NexusAIDefaultTool.DISCOVER_NETWORK_HOSTS,
		NexusAIDefaultTool.SSH_CONNECT,
		NexusAIDefaultTool.SSH_EXECUTE,
		NexusAIDefaultTool.SSH_UPLOAD,
		NexusAIDefaultTool.SSH_DOWNLOAD,
		NexusAIDefaultTool.SSH_DISCONNECT,
		NexusAIDefaultTool.HTTP_REQUEST,
		NexusAIDefaultTool.MQTT_CONNECT,
		NexusAIDefaultTool.MQTT_PUBLISH,
		NexusAIDefaultTool.MQTT_SUBSCRIBE,
		NexusAIDefaultTool.MQTT_DISCONNECT,
		NexusAIDefaultTool.DISCOVER_DEVICES,
		NexusAIDefaultTool.REGISTER_DEVICE,
		NexusAIDefaultTool.GET_DEVICE_INFO,
		NexusAIDefaultTool.OPERATE_DEVICE,
		NexusAIDefaultTool.SPEAK_TEXT,
		NexusAIDefaultTool.LISTEN_FOR_SPEECH,
		NexusAIDefaultTool.FILE_READ,
		NexusAIDefaultTool.FILE_NEW,
		NexusAIDefaultTool.FILE_EDIT,
		NexusAIDefaultTool.SEARCH,
		NexusAIDefaultTool.LIST_FILES,
		NexusAIDefaultTool.LIST_CODE_DEF,
		NexusAIDefaultTool.BROWSER,
		NexusAIDefaultTool.MCP_USE,
		NexusAIDefaultTool.MCP_ACCESS,
		NexusAIDefaultTool.ASK,
		NexusAIDefaultTool.ATTEMPT,
		NexusAIDefaultTool.PLAN_MODE,
		NexusAIDefaultTool.MCP_DOCS,
		NexusAIDefaultTool.TODO,
		NexusAIDefaultTool.GENERATE_EXPLANATION,
		NexusAIDefaultTool.USE_SKILL,
		NexusAIDefaultTool.USE_SUBAGENTS,
	)
	.placeholders({
		MODEL_FAMILY: "generic",
	})
	.config({})
	.build()

// Compile-time validation
const validationResult = validateVariant({ ...config, id: "generic" }, { strict: true })
if (!validationResult.isValid) {
	Logger.error("Generic variant configuration validation failed:", validationResult.errors)
	throw new Error(`Invalid generic variant configuration: ${validationResult.errors.join(", ")}`)
}

if (validationResult.warnings.length > 0) {
	Logger.warn("Generic variant configuration warnings:", validationResult.warnings)
}

// Export type information for better IDE support
export type GenericVariantConfig = typeof config
