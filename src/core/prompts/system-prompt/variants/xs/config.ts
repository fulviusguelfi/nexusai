import { isLocalModel } from "@utils/model-utils"
import { ModelFamily } from "@/shared/prompts"
import { Logger } from "@/shared/services/Logger"
import { NexusAIDefaultTool } from "@/shared/tools"
import { SystemPromptSection } from "../../templates/placeholders"
import { createVariant } from "../variant-builder"
import { validateVariant } from "../variant-validator"
import { xsComponentOverrides } from "./overrides"
import { baseTemplate } from "./template"

// Type-safe variant configuration using the builder pattern
export const config = createVariant(ModelFamily.XS)
	.description("Prompt for models with a small context window.")
	.version(1)
	.tags("local", "xs", "compact", "native_tools")
	.labels({
		stable: 1,
		production: 1,
		advanced: 1,
		use_native_tools: 1,
	})
	.matcher((context) => {
		const providerInfo = context.providerInfo
		if (!isLocalModel(providerInfo)) {
			return false
		}
		// Match compact local models
		return providerInfo.customPrompt === "compact"
	})
	.template(baseTemplate)
	.components(
		SystemPromptSection.AGENT_ROLE,
		SystemPromptSection.TOOL_USE,
		SystemPromptSection.RULES,
		SystemPromptSection.ACT_VS_PLAN,
		SystemPromptSection.CAPABILITIES,
		SystemPromptSection.EDITING_FILES,
		SystemPromptSection.OBJECTIVE,
		SystemPromptSection.SYSTEM_INFO,
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
		NexusAIDefaultTool.ASK,
		NexusAIDefaultTool.ATTEMPT,
		NexusAIDefaultTool.PLAN_MODE,
		NexusAIDefaultTool.USE_SUBAGENTS,
	)
	.placeholders({
		MODEL_FAMILY: ModelFamily.XS,
	})
	.overrideComponent(SystemPromptSection.AGENT_ROLE, {
		template: xsComponentOverrides.AGENT_ROLE,
	})
	.overrideComponent(SystemPromptSection.TOOL_USE, {
		template: xsComponentOverrides.TOOL_USE,
	})
	.overrideComponent(SystemPromptSection.RULES, {
		template: xsComponentOverrides.RULES,
	})
	.overrideComponent(SystemPromptSection.ACT_VS_PLAN, {
		template: xsComponentOverrides.ACT_VS_PLAN,
	})
	.overrideComponent(SystemPromptSection.CAPABILITIES, {
		template: xsComponentOverrides.CAPABILITIES,
	})
	.overrideComponent(SystemPromptSection.OBJECTIVE, {
		template: xsComponentOverrides.OBJECTIVE,
	})
	.overrideComponent(SystemPromptSection.EDITING_FILES, {
		template: xsComponentOverrides.EDITING_FILES,
	})
	.config({})
	.build()

// Compile-time validation
const validationResult = validateVariant({ ...config, id: ModelFamily.XS }, { strict: true })
if (!validationResult.isValid) {
	Logger.error("XS variant configuration validation failed:", validationResult.errors)
	throw new Error(`Invalid XS variant configuration: ${validationResult.errors.join(", ")}`)
}

if (validationResult.warnings.length > 0) {
	Logger.warn("XS variant configuration warnings:", validationResult.warnings)
}

// Export type information for better IDE support
export type XsVariantConfig = typeof config
