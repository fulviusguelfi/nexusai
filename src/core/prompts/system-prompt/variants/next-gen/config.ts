import { isGPT5ModelFamily, isLocalModel, isNextGenModelFamily, isNextGenModelProvider } from "@utils/model-utils"
import { ModelFamily } from "@/shared/prompts"
import { Logger } from "@/shared/services/Logger"
import { NexusAIDefaultTool } from "@/shared/tools"
import { SystemPromptSection } from "../../templates/placeholders"
import { createVariant } from "../variant-builder"
import { validateVariant } from "../variant-validator"
import { baseTemplate, rules_template } from "./template"

// Type-safe variant configuration using the builder pattern
export const config = createVariant(ModelFamily.NEXT_GEN)
	.description("Prompt tailored to newer frontier models with smarter agentic capabilities.")
	.version(1)
	.tags("next-gen", "advanced", "production")
	.labels({
		stable: 1,
		production: 1,
		advanced: 1,
	})
	.matcher((context) => {
		// Match next-gen models
		const providerInfo = context.providerInfo
		if (isNextGenModelFamily(providerInfo.model.id) && !context.enableNativeToolCalls) {
			return true
		}
		const modelId = providerInfo.model.id
		return (
			!(providerInfo.customPrompt === "compact" && isLocalModel(providerInfo)) &&
			!isNextGenModelProvider(providerInfo) &&
			isNextGenModelFamily(modelId) &&
			!(isGPT5ModelFamily(modelId) && !modelId.includes("chat"))
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
		SystemPromptSection.FEEDBACK,
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
		NexusAIDefaultTool.WEB_FETCH,
		NexusAIDefaultTool.WEB_SEARCH,
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
		MODEL_FAMILY: ModelFamily.NEXT_GEN,
	})
	.config({})
	// Override the RULES component with custom template
	.overrideComponent(SystemPromptSection.RULES, {
		template: rules_template,
	})
	.build()

// Compile-time validation
const validationResult = validateVariant({ ...config, id: ModelFamily.NEXT_GEN }, { strict: true })
if (!validationResult.isValid) {
	Logger.error("Next-gen variant configuration validation failed:", validationResult.errors)
	throw new Error(`Invalid next-gen variant configuration: ${validationResult.errors.join(", ")}`)
}

if (validationResult.warnings.length > 0) {
	Logger.warn("Next-gen variant configuration warnings:", validationResult.warnings)
}

// Export type information for better IDE support
export type NextGenVariantConfig = typeof config
