import { isGPT5ModelFamily, isNextGenModelFamily, isNextGenModelProvider } from "@utils/model-utils"
import { ModelFamily } from "@/shared/prompts"
import { Logger } from "@/shared/services/Logger"
import { NexusAIDefaultTool } from "@/shared/tools"
import { SystemPromptSection } from "../../templates/placeholders"
import { createVariant } from "../variant-builder"
import { validateVariant } from "../variant-validator"
import { TEMPLATE_OVERRIDES } from "./template"

// Type-safe variant configuration using the builder pattern
export const config = createVariant(ModelFamily.NATIVE_NEXT_GEN)
	.description("Next gen models with native tool calling")
	.version(1)
	.tags("advanced", "production", "native_tools")
	.labels({
		stable: 1,
		production: 1,
		advanced: 1,
		use_native_tools: 1,
	})
	.matcher((context) => {
		if (!context.enableNativeToolCalls) {
			return false
		}
		const providerInfo = context.providerInfo
		if (!isNextGenModelProvider(providerInfo)) {
			return false
		}
		const modelId = providerInfo.model.id.toLowerCase()
		return !isGPT5ModelFamily(modelId) && isNextGenModelFamily(modelId)
	})
	.template(TEMPLATE_OVERRIDES.BASE)
	.components(
		SystemPromptSection.AGENT_ROLE,
		SystemPromptSection.TOOL_USE,
		SystemPromptSection.TODO,
		SystemPromptSection.ACT_VS_PLAN,
		SystemPromptSection.TASK_PROGRESS,
		SystemPromptSection.CAPABILITIES,
		SystemPromptSection.FEEDBACK,
		SystemPromptSection.RULES,
		SystemPromptSection.SYSTEM_INFO,
		SystemPromptSection.OBJECTIVE,
		SystemPromptSection.USER_INSTRUCTIONS,
		SystemPromptSection.SKILLS,
	)
	.tools(
		NexusAIDefaultTool.ASK,
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
		NexusAIDefaultTool.MCP_ACCESS,
		NexusAIDefaultTool.ATTEMPT,
		NexusAIDefaultTool.PLAN_MODE,
		NexusAIDefaultTool.MCP_DOCS,
		NexusAIDefaultTool.TODO,
		NexusAIDefaultTool.GENERATE_EXPLANATION,
		NexusAIDefaultTool.USE_SKILL,
		NexusAIDefaultTool.USE_SUBAGENTS,
	)
	.placeholders({
		MODEL_FAMILY: ModelFamily.NATIVE_NEXT_GEN,
	})
	.config({})
	// Override the RULES component with custom template
	.overrideComponent(SystemPromptSection.RULES, {
		template: TEMPLATE_OVERRIDES.RULES,
	})
	.overrideComponent(SystemPromptSection.TOOL_USE, {
		template: TEMPLATE_OVERRIDES.TOOL_USE,
	})
	.overrideComponent(SystemPromptSection.OBJECTIVE, {
		template: TEMPLATE_OVERRIDES.OBJECTIVE,
	})
	.overrideComponent(SystemPromptSection.ACT_VS_PLAN, {
		template: TEMPLATE_OVERRIDES.ACT_VS_PLAN,
	})
	.overrideComponent(SystemPromptSection.FEEDBACK, {
		template: TEMPLATE_OVERRIDES.FEEDBACK,
	})
	.build()

// Compile-time validation
const validationResult = validateVariant({ ...config, id: ModelFamily.NATIVE_NEXT_GEN }, { strict: true })
if (!validationResult.isValid) {
	Logger.error("Native Next Gen variant configuration validation failed:", validationResult.errors)
	throw new Error(`Invalid Native Next Gen variant configuration: ${validationResult.errors.join(", ")}`)
}

if (validationResult.warnings.length > 0) {
	Logger.warn("Native Next Gen variant configuration warnings:", validationResult.warnings)
}

// Export type information for better IDE support
export type NativeNextGenVariantConfig = typeof config
