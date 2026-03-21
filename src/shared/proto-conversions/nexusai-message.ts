import { NexusAIAsk as AppClineAsk, NexusAIMessage as AppClineMessage, NexusAISay as AppClineSay } from "@shared/ExtensionMessage"
import { NexusAIAsk, NexusAIMessageType, NexusAISay, NexusAIMessage as ProtoClineMessage } from "@shared/proto/nexusai/ui"

// Helper function to convert NexusAIAsk string to enum
function convertClineAskToProtoEnum(ask: AppClineAsk | undefined): NexusAIAsk | undefined {
	if (!ask) {
		return undefined
	}

	const mapping: Record<AppClineAsk, NexusAIAsk> = {
		followup: NexusAIAsk.FOLLOWUP,
		plan_mode_respond: NexusAIAsk.PLAN_MODE_RESPOND,
		act_mode_respond: NexusAIAsk.ACT_MODE_RESPOND,
		command: NexusAIAsk.COMMAND,
		command_output: NexusAIAsk.COMMAND_OUTPUT,
		completion_result: NexusAIAsk.COMPLETION_RESULT,
		tool: NexusAIAsk.TOOL,
		api_req_failed: NexusAIAsk.API_REQ_FAILED,
		resume_task: NexusAIAsk.RESUME_TASK,
		resume_completed_task: NexusAIAsk.RESUME_COMPLETED_TASK,
		mistake_limit_reached: NexusAIAsk.MISTAKE_LIMIT_REACHED,
		browser_action_launch: NexusAIAsk.BROWSER_ACTION_LAUNCH,
		use_mcp_server: NexusAIAsk.USE_MCP_SERVER,
		new_task: NexusAIAsk.NEW_TASK,
		condense: NexusAIAsk.CONDENSE,
		summarize_task: NexusAIAsk.SUMMARIZE_TASK,
		report_bug: NexusAIAsk.REPORT_BUG,
		use_subagents: NexusAIAsk.USE_SUBAGENTS,
	}

	const result = mapping[ask]
	if (result === undefined) {
	}
	return result
}

// Helper function to convert NexusAIAsk enum to string
function convertProtoEnumToClineAsk(ask: NexusAIAsk): AppClineAsk | undefined {
	if (ask === NexusAIAsk.UNRECOGNIZED) {
		return undefined
	}

	const mapping: Record<Exclude<NexusAIAsk, NexusAIAsk.UNRECOGNIZED>, AppClineAsk> = {
		[NexusAIAsk.FOLLOWUP]: "followup",
		[NexusAIAsk.PLAN_MODE_RESPOND]: "plan_mode_respond",
		[NexusAIAsk.ACT_MODE_RESPOND]: "act_mode_respond",
		[NexusAIAsk.COMMAND]: "command",
		[NexusAIAsk.COMMAND_OUTPUT]: "command_output",
		[NexusAIAsk.COMPLETION_RESULT]: "completion_result",
		[NexusAIAsk.TOOL]: "tool",
		[NexusAIAsk.API_REQ_FAILED]: "api_req_failed",
		[NexusAIAsk.RESUME_TASK]: "resume_task",
		[NexusAIAsk.RESUME_COMPLETED_TASK]: "resume_completed_task",
		[NexusAIAsk.MISTAKE_LIMIT_REACHED]: "mistake_limit_reached",
		[NexusAIAsk.BROWSER_ACTION_LAUNCH]: "browser_action_launch",
		[NexusAIAsk.USE_MCP_SERVER]: "use_mcp_server",
		[NexusAIAsk.NEW_TASK]: "new_task",
		[NexusAIAsk.CONDENSE]: "condense",
		[NexusAIAsk.SUMMARIZE_TASK]: "summarize_task",
		[NexusAIAsk.REPORT_BUG]: "report_bug",
		[NexusAIAsk.USE_SUBAGENTS]: "use_subagents",
	}

	return mapping[ask]
}

// Helper function to convert NexusAISay string to enum
function convertClineSayToProtoEnum(say: AppClineSay | undefined): NexusAISay | undefined {
	if (!say) {
		return undefined
	}

	const mapping: Record<AppClineSay, NexusAISay> = {
		task: NexusAISay.TASK,
		error: NexusAISay.ERROR,
		api_req_started: NexusAISay.API_REQ_STARTED,
		api_req_finished: NexusAISay.API_REQ_FINISHED,
		text: NexusAISay.TEXT,
		reasoning: NexusAISay.REASONING,
		completion_result: NexusAISay.COMPLETION_RESULT_SAY,
		user_feedback: NexusAISay.USER_FEEDBACK,
		user_feedback_diff: NexusAISay.USER_FEEDBACK_DIFF,
		api_req_retried: NexusAISay.API_REQ_RETRIED,
		command: NexusAISay.COMMAND_SAY,
		command_output: NexusAISay.COMMAND_OUTPUT_SAY,
		tool: NexusAISay.TOOL_SAY,
		shell_integration_warning: NexusAISay.SHELL_INTEGRATION_WARNING,
		shell_integration_warning_with_suggestion: NexusAISay.SHELL_INTEGRATION_WARNING,
		browser_action_launch: NexusAISay.BROWSER_ACTION_LAUNCH_SAY,
		browser_action: NexusAISay.BROWSER_ACTION,
		browser_action_result: NexusAISay.BROWSER_ACTION_RESULT,
		mcp_server_request_started: NexusAISay.MCP_SERVER_REQUEST_STARTED,
		mcp_server_response: NexusAISay.MCP_SERVER_RESPONSE,
		mcp_notification: NexusAISay.MCP_NOTIFICATION,
		use_mcp_server: NexusAISay.USE_MCP_SERVER_SAY,
		diff_error: NexusAISay.DIFF_ERROR,
		deleted_api_reqs: NexusAISay.DELETED_API_REQS,
		clineignore_error: NexusAISay.CLINEIGNORE_ERROR,
		command_permission_denied: NexusAISay.COMMAND_PERMISSION_DENIED,
		checkpoint_created: NexusAISay.CHECKPOINT_CREATED,
		load_mcp_documentation: NexusAISay.LOAD_MCP_DOCUMENTATION,
		info: NexusAISay.INFO,
		task_progress: NexusAISay.TASK_PROGRESS,
		error_retry: NexusAISay.ERROR_RETRY,
		hook_status: NexusAISay.HOOK_STATUS,
		hook_output_stream: NexusAISay.HOOK_OUTPUT_STREAM,
		conditional_rules_applied: NexusAISay.CONDITIONAL_RULES_APPLIED,
		subagent: NexusAISay.SUBAGENT_STATUS,
		use_subagents: NexusAISay.USE_SUBAGENTS_SAY,
		subagent_usage: NexusAISay.SUBAGENT_USAGE,
		generate_explanation: NexusAISay.GENERATE_EXPLANATION,
		voice_speak: NexusAISay.VOICE_SPEAK,
		voice_listen: NexusAISay.VOICE_LISTEN,
	}

	const result = mapping[say]

	return result
}

// Helper function to convert NexusAISay enum to string
function convertProtoEnumToClineSay(say: NexusAISay): AppClineSay | undefined {
	if (say === NexusAISay.UNRECOGNIZED) {
		return undefined
	}

	const mapping: Record<Exclude<NexusAISay, NexusAISay.UNRECOGNIZED>, AppClineSay> = {
		[NexusAISay.TASK]: "task",
		[NexusAISay.ERROR]: "error",
		[NexusAISay.API_REQ_STARTED]: "api_req_started",
		[NexusAISay.API_REQ_FINISHED]: "api_req_finished",
		[NexusAISay.TEXT]: "text",
		[NexusAISay.REASONING]: "reasoning",
		[NexusAISay.COMPLETION_RESULT_SAY]: "completion_result",
		[NexusAISay.USER_FEEDBACK]: "user_feedback",
		[NexusAISay.USER_FEEDBACK_DIFF]: "user_feedback_diff",
		[NexusAISay.API_REQ_RETRIED]: "api_req_retried",
		[NexusAISay.COMMAND_SAY]: "command",
		[NexusAISay.COMMAND_OUTPUT_SAY]: "command_output",
		[NexusAISay.TOOL_SAY]: "tool",
		[NexusAISay.SHELL_INTEGRATION_WARNING]: "shell_integration_warning",
		[NexusAISay.BROWSER_ACTION_LAUNCH_SAY]: "browser_action_launch",
		[NexusAISay.BROWSER_ACTION]: "browser_action",
		[NexusAISay.BROWSER_ACTION_RESULT]: "browser_action_result",
		[NexusAISay.MCP_SERVER_REQUEST_STARTED]: "mcp_server_request_started",
		[NexusAISay.MCP_SERVER_RESPONSE]: "mcp_server_response",
		[NexusAISay.MCP_NOTIFICATION]: "mcp_notification",
		[NexusAISay.USE_MCP_SERVER_SAY]: "use_mcp_server",
		[NexusAISay.DIFF_ERROR]: "diff_error",
		[NexusAISay.DELETED_API_REQS]: "deleted_api_reqs",
		[NexusAISay.CLINEIGNORE_ERROR]: "clineignore_error",
		[NexusAISay.COMMAND_PERMISSION_DENIED]: "command_permission_denied",
		[NexusAISay.CHECKPOINT_CREATED]: "checkpoint_created",
		[NexusAISay.LOAD_MCP_DOCUMENTATION]: "load_mcp_documentation",
		[NexusAISay.INFO]: "info",
		[NexusAISay.TASK_PROGRESS]: "task_progress",
		[NexusAISay.ERROR_RETRY]: "error_retry",
		[NexusAISay.GENERATE_EXPLANATION]: "generate_explanation",
		[NexusAISay.HOOK_STATUS]: "hook_status",
		[NexusAISay.HOOK_OUTPUT_STREAM]: "hook_output_stream",
		[NexusAISay.CONDITIONAL_RULES_APPLIED]: "conditional_rules_applied",
		[NexusAISay.SUBAGENT_STATUS]: "subagent",
		[NexusAISay.USE_SUBAGENTS_SAY]: "use_subagents",
		[NexusAISay.SUBAGENT_USAGE]: "subagent_usage",
		[NexusAISay.VOICE_SPEAK]: "voice_speak",
		[NexusAISay.VOICE_LISTEN]: "voice_listen",
	}

	return mapping[say]
}

/**
 * Convert application NexusAIMessage to proto NexusAIMessage
 */
export function convertClineMessageToProto(message: AppClineMessage): ProtoClineMessage {
	// For sending messages, we need to provide values for required proto fields
	const askEnum = message.ask ? convertClineAskToProtoEnum(message.ask) : undefined
	const sayEnum = message.say ? convertClineSayToProtoEnum(message.say) : undefined

	// Determine appropriate enum values based on message type
	let finalAskEnum: NexusAIAsk = NexusAIAsk.FOLLOWUP // Proto default
	let finalSayEnum: NexusAISay = NexusAISay.TEXT // Proto default

	if (message.type === "ask") {
		finalAskEnum = askEnum ?? NexusAIAsk.FOLLOWUP // Use FOLLOWUP as default for ask messages
	} else if (message.type === "say") {
		finalSayEnum = sayEnum ?? NexusAISay.TEXT // Use TEXT as default for say messages
	}

	const protoMessage: ProtoClineMessage = {
		ts: message.ts,
		type: message.type === "ask" ? NexusAIMessageType.ASK : NexusAIMessageType.SAY,
		ask: finalAskEnum,
		say: finalSayEnum,
		text: message.text ?? "",
		reasoning: message.reasoning ?? "",
		images: message.images ?? [],
		files: message.files ?? [],
		partial: message.partial ?? false,
		lastCheckpointHash: message.lastCheckpointHash ?? "",
		isCheckpointCheckedOut: message.isCheckpointCheckedOut ?? false,
		isOperationOutsideWorkspace: message.isOperationOutsideWorkspace ?? false,
		conversationHistoryIndex: message.conversationHistoryIndex ?? 0,
		conversationHistoryDeletedRange: message.conversationHistoryDeletedRange
			? {
					startIndex: message.conversationHistoryDeletedRange[0],
					endIndex: message.conversationHistoryDeletedRange[1],
				}
			: undefined,
		// Additional optional fields for specific ask/say types
		sayTool: undefined,
		sayBrowserAction: undefined,
		browserActionResult: undefined,
		askUseMcpServer: undefined,
		planModeResponse: undefined,
		askQuestion: undefined,
		askNewTask: undefined,
		apiReqInfo: undefined,
		modelInfo: message.modelInfo ?? undefined,
	}

	return protoMessage
}

/**
 * Convert proto NexusAIMessage to application NexusAIMessage
 */
export function convertProtoToClineMessage(protoMessage: ProtoClineMessage): AppClineMessage {
	const message: AppClineMessage = {
		ts: protoMessage.ts,
		type: protoMessage.type === NexusAIMessageType.ASK ? "ask" : "say",
	}

	// Convert ask enum to string
	if (protoMessage.type === NexusAIMessageType.ASK) {
		const ask = convertProtoEnumToClineAsk(protoMessage.ask)
		if (ask !== undefined) {
			message.ask = ask
		}
	}

	// Convert say enum to string
	if (protoMessage.type === NexusAIMessageType.SAY) {
		const say = convertProtoEnumToClineSay(protoMessage.say)
		if (say !== undefined) {
			message.say = say
		}
	}

	// Convert other fields - preserve empty strings as they may be intentional
	if (protoMessage.text !== "") {
		message.text = protoMessage.text
	}
	if (protoMessage.reasoning !== "") {
		message.reasoning = protoMessage.reasoning
	}
	if (protoMessage.images.length > 0) {
		message.images = protoMessage.images
	}
	if (protoMessage.files.length > 0) {
		message.files = protoMessage.files
	}
	if (protoMessage.partial) {
		message.partial = protoMessage.partial
	}
	if (protoMessage.lastCheckpointHash !== "") {
		message.lastCheckpointHash = protoMessage.lastCheckpointHash
	}
	if (protoMessage.isCheckpointCheckedOut) {
		message.isCheckpointCheckedOut = protoMessage.isCheckpointCheckedOut
	}
	if (protoMessage.isOperationOutsideWorkspace) {
		message.isOperationOutsideWorkspace = protoMessage.isOperationOutsideWorkspace
	}
	if (protoMessage.conversationHistoryIndex !== 0) {
		message.conversationHistoryIndex = protoMessage.conversationHistoryIndex
	}

	// Convert conversationHistoryDeletedRange from object to tuple
	if (protoMessage.conversationHistoryDeletedRange) {
		message.conversationHistoryDeletedRange = [
			protoMessage.conversationHistoryDeletedRange.startIndex,
			protoMessage.conversationHistoryDeletedRange.endIndex,
		]
	}

	return message
}
