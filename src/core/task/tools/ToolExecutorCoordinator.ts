import type { ToolUse } from "@core/assistant-message"
import { NEXUSAI_MCP_TOOL_IDENTIFIER } from "@/shared/mcp"
import { NexusAIDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../index"
import { AccessMcpResourceHandler } from "./handlers/AccessMcpResourceHandler"
import { ActModeRespondHandler } from "./handlers/ActModeRespondHandler"
import { ApplyPatchHandler } from "./handlers/ApplyPatchHandler"
import { AskFollowupQuestionToolHandler } from "./handlers/AskFollowupQuestionToolHandler"
import { AttemptCompletionHandler } from "./handlers/AttemptCompletionHandler"
import { BrowserToolHandler } from "./handlers/BrowserToolHandler"
import { CondenseHandler } from "./handlers/CondenseHandler"
import { DiscoverDevicesToolHandler } from "./handlers/DiscoverDevicesToolHandler"
import { DiscoverNetworkHostsToolHandler } from "./handlers/DiscoverNetworkHostsToolHandler"
import { ExecuteCommandToolHandler } from "./handlers/ExecuteCommandToolHandler"
import { GenerateExplanationToolHandler } from "./handlers/GenerateExplanationToolHandler"
import { GetDeviceInfoToolHandler } from "./handlers/GetDeviceInfoToolHandler"
import { HttpRequestToolHandler } from "./handlers/HttpRequestToolHandler"
import { KillProcessToolHandler } from "./handlers/KillProcessToolHandler"
import { ListCodeDefinitionNamesToolHandler } from "./handlers/ListCodeDefinitionNamesToolHandler"
import { ListenForSpeechToolHandler } from "./handlers/ListenForSpeechToolHandler"
import { ListFilesToolHandler } from "./handlers/ListFilesToolHandler"
import { ListProcessesToolHandler } from "./handlers/ListProcessesToolHandler"
import { LoadMcpDocumentationHandler } from "./handlers/LoadMcpDocumentationHandler"
import { MqttConnectToolHandler } from "./handlers/MqttConnectToolHandler"
import { MqttDisconnectToolHandler } from "./handlers/MqttDisconnectToolHandler"
import { MqttPublishToolHandler } from "./handlers/MqttPublishToolHandler"
import { MqttSubscribeToolHandler } from "./handlers/MqttSubscribeToolHandler"
import { NewTaskHandler } from "./handlers/NewTaskHandler"
import { OperateDeviceToolHandler } from "./handlers/OperateDeviceToolHandler"
import { PlanModeRespondHandler } from "./handlers/PlanModeRespondHandler"
import { ReadFileToolHandler } from "./handlers/ReadFileToolHandler"
import { RegisterDeviceToolHandler } from "./handlers/RegisterDeviceToolHandler"
import { ReportBugHandler } from "./handlers/ReportBugHandler"
import { SearchFilesToolHandler } from "./handlers/SearchFilesToolHandler"
import { SpeakTextToolHandler } from "./handlers/SpeakTextToolHandler"
import { SshConnectToolHandler } from "./handlers/SshConnectToolHandler"
import { SshDisconnectToolHandler } from "./handlers/SshDisconnectToolHandler"
import { SshDownloadToolHandler } from "./handlers/SshDownloadToolHandler"
import { SshExecuteToolHandler } from "./handlers/SshExecuteToolHandler"
import { SshUploadToolHandler } from "./handlers/SshUploadToolHandler"
import { UseSubagentsToolHandler } from "./handlers/SubagentToolHandler"
import { SummarizeTaskHandler } from "./handlers/SummarizeTaskHandler"
import { UseMcpToolHandler } from "./handlers/UseMcpToolHandler"
import { UseSkillToolHandler } from "./handlers/UseSkillToolHandler"
import { WebFetchToolHandler } from "./handlers/WebFetchToolHandler"
import { WebSearchToolHandler } from "./handlers/WebSearchToolHandler"
import { WriteToFileToolHandler } from "./handlers/WriteToFileToolHandler"
import { AgentConfigLoader } from "./subagent/AgentConfigLoader"
import { ToolValidator } from "./ToolValidator"
import type { TaskConfig } from "./types/TaskConfig"
import type { StronglyTypedUIHelpers } from "./types/UIHelpers"

export interface IToolHandler {
	readonly name: NexusAIDefaultTool
	execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse>
	getDescription(block: ToolUse): string
}

export interface IPartialBlockHandler {
	handlePartialBlock(block: ToolUse, uiHelpers: StronglyTypedUIHelpers): Promise<void>
}

export interface IFullyManagedTool extends IToolHandler, IPartialBlockHandler {
	// Marker interface for tools that handle their own complete approval flow
}

/**
 * A wrapper class that allows a single tool handler to be registered under multiple names.
 * This provides proper typing for tools that share the same implementation logic.
 */
export class SharedToolHandler implements IFullyManagedTool {
	constructor(
		public readonly name: NexusAIDefaultTool,
		private baseHandler: IFullyManagedTool,
	) {}

	getDescription(block: ToolUse): string {
		return this.baseHandler.getDescription(block)
	}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		return this.baseHandler.execute(config, block)
	}

	async handlePartialBlock(block: ToolUse, uiHelpers: StronglyTypedUIHelpers): Promise<void> {
		return this.baseHandler.handlePartialBlock(block, uiHelpers)
	}
}

/**
 * Coordinates tool execution by routing to registered handlers.
 * Falls back to legacy switch for unregistered tools.
 */
export class ToolExecutorCoordinator {
	private handlers = new Map<string, IToolHandler>()
	private dynamicSubagentHandlers = new Map<string, IToolHandler>()

	private readonly toolHandlersMap: Record<NexusAIDefaultTool, (v: ToolValidator) => IToolHandler | undefined> = {
		[NexusAIDefaultTool.ASK]: (_v: ToolValidator) => new AskFollowupQuestionToolHandler(),
		[NexusAIDefaultTool.ATTEMPT]: (_v: ToolValidator) => new AttemptCompletionHandler(),
		[NexusAIDefaultTool.BASH]: (v: ToolValidator) => new ExecuteCommandToolHandler(v),
		[NexusAIDefaultTool.FILE_EDIT]: (v: ToolValidator) =>
			new SharedToolHandler(NexusAIDefaultTool.FILE_EDIT, new WriteToFileToolHandler(v)),
		[NexusAIDefaultTool.FILE_READ]: (v: ToolValidator) => new ReadFileToolHandler(v),
		[NexusAIDefaultTool.FILE_NEW]: (v: ToolValidator) => new WriteToFileToolHandler(v),
		[NexusAIDefaultTool.SEARCH]: (v: ToolValidator) => new SearchFilesToolHandler(v),
		[NexusAIDefaultTool.LIST_FILES]: (v: ToolValidator) => new ListFilesToolHandler(v),
		[NexusAIDefaultTool.LIST_CODE_DEF]: (v: ToolValidator) => new ListCodeDefinitionNamesToolHandler(v),
		[NexusAIDefaultTool.BROWSER]: (_v: ToolValidator) => new BrowserToolHandler(),
		[NexusAIDefaultTool.MCP_USE]: (_v: ToolValidator) => new UseMcpToolHandler(),
		[NexusAIDefaultTool.MCP_ACCESS]: (_v: ToolValidator) => new AccessMcpResourceHandler(),
		[NexusAIDefaultTool.MCP_DOCS]: (_v: ToolValidator) => new LoadMcpDocumentationHandler(),
		[NexusAIDefaultTool.NEW_TASK]: (_v: ToolValidator) => new NewTaskHandler(),
		[NexusAIDefaultTool.PLAN_MODE]: (_v: ToolValidator) => new PlanModeRespondHandler(),
		[NexusAIDefaultTool.ACT_MODE]: (_v: ToolValidator) => new ActModeRespondHandler(),
		[NexusAIDefaultTool.TODO]: (_v: ToolValidator) => undefined,
		[NexusAIDefaultTool.WEB_FETCH]: (_v: ToolValidator) => new WebFetchToolHandler(),
		[NexusAIDefaultTool.WEB_SEARCH]: (_v: ToolValidator) => new WebSearchToolHandler(),
		[NexusAIDefaultTool.CONDENSE]: (_v: ToolValidator) => new CondenseHandler(),
		[NexusAIDefaultTool.SUMMARIZE_TASK]: (_v: ToolValidator) => new SummarizeTaskHandler(_v),
		[NexusAIDefaultTool.REPORT_BUG]: (_v: ToolValidator) => new ReportBugHandler(),
		[NexusAIDefaultTool.NEW_RULE]: (v: ToolValidator) =>
			new SharedToolHandler(NexusAIDefaultTool.NEW_RULE, new WriteToFileToolHandler(v)),
		[NexusAIDefaultTool.APPLY_PATCH]: (_v: ToolValidator) => new ApplyPatchHandler(_v),
		[NexusAIDefaultTool.GENERATE_EXPLANATION]: (_v: ToolValidator) => new GenerateExplanationToolHandler(),
		[NexusAIDefaultTool.USE_SKILL]: (_v: ToolValidator) => new UseSkillToolHandler(),
		[NexusAIDefaultTool.USE_SUBAGENTS]: (_v: ToolValidator) => new UseSubagentsToolHandler(),
		[NexusAIDefaultTool.LIST_PROCESSES]: (v: ToolValidator) => new ListProcessesToolHandler(v),
		[NexusAIDefaultTool.KILL_PROCESS]: (v: ToolValidator) => new KillProcessToolHandler(v),
		[NexusAIDefaultTool.DISCOVER_NETWORK_HOSTS]: (v: ToolValidator) => new DiscoverNetworkHostsToolHandler(v),
		[NexusAIDefaultTool.SSH_CONNECT]: (v: ToolValidator) => new SshConnectToolHandler(v),
		[NexusAIDefaultTool.SSH_EXECUTE]: (v: ToolValidator) => new SshExecuteToolHandler(v),
		[NexusAIDefaultTool.SSH_UPLOAD]: (v: ToolValidator) => new SshUploadToolHandler(v),
		[NexusAIDefaultTool.SSH_DOWNLOAD]: (v: ToolValidator) => new SshDownloadToolHandler(v),
		[NexusAIDefaultTool.SSH_DISCONNECT]: (v: ToolValidator) => new SshDisconnectToolHandler(v),
		[NexusAIDefaultTool.HTTP_REQUEST]: (v: ToolValidator) => new HttpRequestToolHandler(v),
		[NexusAIDefaultTool.MQTT_CONNECT]: (v: ToolValidator) => new MqttConnectToolHandler(v),
		[NexusAIDefaultTool.MQTT_PUBLISH]: (v: ToolValidator) => new MqttPublishToolHandler(v),
		[NexusAIDefaultTool.MQTT_SUBSCRIBE]: (v: ToolValidator) => new MqttSubscribeToolHandler(v),
		[NexusAIDefaultTool.MQTT_DISCONNECT]: (v: ToolValidator) => new MqttDisconnectToolHandler(v),
		[NexusAIDefaultTool.DISCOVER_DEVICES]: (v: ToolValidator) => new DiscoverDevicesToolHandler(v),
		[NexusAIDefaultTool.REGISTER_DEVICE]: (v: ToolValidator) => new RegisterDeviceToolHandler(v),
		[NexusAIDefaultTool.GET_DEVICE_INFO]: (v: ToolValidator) => new GetDeviceInfoToolHandler(v),
		[NexusAIDefaultTool.OPERATE_DEVICE]: (v: ToolValidator) => new OperateDeviceToolHandler(v),
		[NexusAIDefaultTool.SPEAK_TEXT]: (v: ToolValidator) => new SpeakTextToolHandler(v),
		[NexusAIDefaultTool.LISTEN_FOR_SPEECH]: (v: ToolValidator) => new ListenForSpeechToolHandler(v),
	}

	/**
	 * Register a tool handler
	 */
	register(handler: IToolHandler): void {
		this.handlers.set(handler.name, handler)
	}

	registerByName(toolName: NexusAIDefaultTool, validator: ToolValidator): void {
		const handler = this.toolHandlersMap[toolName]?.(validator)
		if (handler) {
			this.register(handler)
		}
	}

	/**
	 * Check if a handler is registered for the given tool
	 */
	has(toolName: string): boolean {
		return this.getHandler(toolName) !== undefined
	}

	/**
	 * Get a handler for the given tool name
	 */
	getHandler(toolName: string): IToolHandler | undefined {
		// HACK: Normalize MCP tool names to the standard handler
		if (toolName.includes(NEXUSAI_MCP_TOOL_IDENTIFIER)) {
			toolName = NexusAIDefaultTool.MCP_USE
		}

		const staticHandler = this.handlers.get(toolName)
		if (staticHandler) {
			return staticHandler
		}

		if (AgentConfigLoader.getInstance().isDynamicSubagentTool(toolName)) {
			const existingHandler = this.dynamicSubagentHandlers.get(toolName)
			if (existingHandler) {
				return existingHandler
			}
			const handler = new SharedToolHandler(toolName as NexusAIDefaultTool, new UseSubagentsToolHandler())
			this.dynamicSubagentHandlers.set(toolName, handler)
			return handler
		}

		return undefined
	}

	/**
	 * Execute a tool through its registered handler
	 */
	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const handler = this.getHandler(block.name)
		if (!handler) {
			throw new Error(`No handler registered for tool: ${block.name}`)
		}
		return handler.execute(config, block)
	}
}
