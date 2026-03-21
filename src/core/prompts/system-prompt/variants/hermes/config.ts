import { ModelFamily } from "@/shared/prompts"
import { Logger } from "@/shared/services/Logger"
import { NexusAIDefaultTool } from "@/shared/tools"
import { isHermesModelFamily } from "@/utils/model-utils"
import { SystemPromptSection } from "../../templates/placeholders"
import { createVariant } from "../variant-builder"
import { validateVariant } from "../variant-validator"
import { hermesComponentOverrides } from "./overrides"
import { baseTemplate } from "./template"

export const config = createVariant(ModelFamily.HERMES)
	.description("Prompt optimized for Hermes-4 model with advanced agentic capabilities.")
	.version(1)
	.tags("hermes", "stable")
	.labels({
		stable: 1,
		production: 1,
	})
	.matcher((context) => {
		const modelId = context.providerInfo.model.id
		return isHermesModelFamily(modelId)
	})
	.template(baseTemplate)
	.components(
		SystemPromptSection.AGENT_ROLE,
		SystemPromptSection.TOOL_USE,
		SystemPromptSection.RULES,
		SystemPromptSection.ACT_VS_PLAN,
		SystemPromptSection.CAPABILITIES,
		SystemPromptSection.EDITING_FILES,
		SystemPromptSection.TODO,
		SystemPromptSection.MCP,
		SystemPromptSection.TASK_PROGRESS,
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
		NexusAIDefaultTool.NEW_TASK,
		NexusAIDefaultTool.PLAN_MODE,
		NexusAIDefaultTool.MCP_DOCS,
		NexusAIDefaultTool.TODO,
		NexusAIDefaultTool.GENERATE_EXPLANATION,
		NexusAIDefaultTool.USE_SKILL,
		NexusAIDefaultTool.USE_SUBAGENTS,
	)
	.placeholders({
		MODEL_FAMILY: "hermes",
	})
	.config({})
	// Apply Hermes-specific component overrides
	.overrideComponent(SystemPromptSection.AGENT_ROLE, hermesComponentOverrides[SystemPromptSection.AGENT_ROLE])
	.overrideComponent(SystemPromptSection.TOOL_USE, hermesComponentOverrides[SystemPromptSection.TOOL_USE])
	.overrideComponent(SystemPromptSection.OBJECTIVE, hermesComponentOverrides[SystemPromptSection.OBJECTIVE])
	.overrideComponent(SystemPromptSection.RULES, hermesComponentOverrides[SystemPromptSection.RULES])
	.overrideComponent(SystemPromptSection.TASK_PROGRESS, hermesComponentOverrides[SystemPromptSection.TASK_PROGRESS])
	.overrideComponent(SystemPromptSection.MCP, hermesComponentOverrides[SystemPromptSection.MCP])
	.build()

// Compile-time validation
const validationResult = validateVariant({ ...config, id: "hermes" }, { strict: true })
if (!validationResult.isValid) {
	Logger.error("Hermes variant configuration validation failed:", validationResult.errors)
	throw new Error(`Invalid Hermes variant configuration: ${validationResult.errors.join(", ")}`)
}

if (validationResult.warnings.length > 0) {
	Logger.warn("Hermes variant configuration warnings:", validationResult.warnings)
}

// Export type information for better IDE support
export type HermesVariantConfig = typeof config
