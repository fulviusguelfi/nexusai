import { isTrinityModelFamily } from "@utils/model-utils"
import { ModelFamily } from "@/shared/prompts"
import { Logger } from "@/shared/services/Logger"
import { NexusAIDefaultTool } from "@/shared/tools"
import { SystemPromptSection } from "../../templates/placeholders"
import { createVariant } from "../variant-builder"
import { validateVariant } from "../variant-validator"
import { trinityComponentOverrides } from "./overrides"
import { baseTemplate } from "./template"

export const config = createVariant(ModelFamily.TRINITY)
	.description(
		"Prompt optimized for Trinity models with tool-use optimizations (explicit ask_followup_question question parameter, anti-looping reminder).",
	)
	.version(1)
	.tags("trinity", "stable")
	.labels({
		stable: 1,
		production: 1,
	})
	.matcher((context) => {
		return isTrinityModelFamily(context.providerInfo.model.id)
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
		MODEL_FAMILY: ModelFamily.TRINITY,
	})
	.config({})
	.overrideComponent(SystemPromptSection.TOOL_USE, trinityComponentOverrides[SystemPromptSection.TOOL_USE])
	.overrideComponent(SystemPromptSection.RULES, trinityComponentOverrides[SystemPromptSection.RULES])
	.build()

// Compile-time validation
const validationResult = validateVariant({ ...config, id: "trinity" }, { strict: true })
if (!validationResult.isValid) {
	Logger.error("Trinity variant configuration validation failed:", validationResult.errors)
	throw new Error(`Invalid Trinity variant configuration: ${validationResult.errors.join(", ")}`)
}

if (validationResult.warnings.length > 0) {
	Logger.warn("Trinity variant configuration warnings:", validationResult.warnings)
}

export type TrinityVariantConfig = typeof config
