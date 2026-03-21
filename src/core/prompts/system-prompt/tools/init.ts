// Import all tool variants
import { NexusAIToolSet } from "../registry/NexusAIToolSet"
import { access_mcp_resource_variants } from "./access_mcp_resource"
import { act_mode_respond_variants } from "./act_mode_respond"
import { apply_patch_variants } from "./apply_patch"
import { ask_followup_question_variants } from "./ask_followup_question"
import { attempt_completion_variants } from "./attempt_completion"
import { browser_action_variants } from "./browser_action"
import { discover_devices_variants } from "./discover_devices"
import { discover_network_hosts_variants } from "./discover_network_hosts"
import { execute_command_variants } from "./execute_command"
import { focus_chain_variants } from "./focus_chain"
import { generate_explanation_variants } from "./generate_explanation"
import { get_device_info_variants } from "./get_device_info"
import { http_request_variants } from "./http_request"
import { kill_process_variants } from "./kill_process"
import { list_code_definition_names_variants } from "./list_code_definition_names"
import { list_files_variants } from "./list_files"
import { list_processes_variants } from "./list_processes"
import { listen_for_speech_variants } from "./listen_for_speech"
import { load_mcp_documentation_variants } from "./load_mcp_documentation"
import { mqtt_connect_variants } from "./mqtt_connect"
import { mqtt_disconnect_variants } from "./mqtt_disconnect"
import { mqtt_publish_variants } from "./mqtt_publish"
import { mqtt_subscribe_variants } from "./mqtt_subscribe"
import { new_task_variants } from "./new_task"
import { operate_device_variants } from "./operate_device"
import { plan_mode_respond_variants } from "./plan_mode_respond"
import { read_file_variants } from "./read_file"
import { register_device_variants } from "./register_device"
import { replace_in_file_variants } from "./replace_in_file"
import { search_files_variants } from "./search_files"
import { speak_text_variants } from "./speak_text"
import { ssh_connect_variants } from "./ssh_connect"
import { ssh_disconnect_variants } from "./ssh_disconnect"
import { ssh_download_variants } from "./ssh_download"
import { ssh_execute_variants } from "./ssh_execute"
import { ssh_upload_variants } from "./ssh_upload"
import { subagent_variants } from "./subagent"
import { use_mcp_tool_variants } from "./use_mcp_tool"
import { use_skill_variants } from "./use_skill"
import { web_fetch_variants } from "./web_fetch"
import { web_search_variants } from "./web_search"
import { write_to_file_variants } from "./write_to_file"

/**
 * Registers all tool variants with the NexusAIToolSet provider.
 * This function must be called at prompt registry
 * to allow all tool sets be available at build time.
 */
export function registerClineToolSets(): void {
	// Collect all variants from all tools
	const allToolVariants = [
		...access_mcp_resource_variants,
		...act_mode_respond_variants,
		...ask_followup_question_variants,
		...attempt_completion_variants,
		...browser_action_variants,
		...execute_command_variants,
		...focus_chain_variants,
		...generate_explanation_variants,
		...list_code_definition_names_variants,
		...list_files_variants,
		...load_mcp_documentation_variants,
		...new_task_variants,
		...plan_mode_respond_variants,
		...read_file_variants,
		...replace_in_file_variants,
		...search_files_variants,
		...subagent_variants,
		...use_mcp_tool_variants,
		...use_skill_variants,
		...web_fetch_variants,
		...web_search_variants,
		...write_to_file_variants,
		...apply_patch_variants,
		...list_processes_variants,
		...kill_process_variants,
		...discover_network_hosts_variants,
		...ssh_connect_variants,
		...ssh_execute_variants,
		...ssh_upload_variants,
		...ssh_download_variants,
		...ssh_disconnect_variants,
		...http_request_variants,
		...mqtt_connect_variants,
		...mqtt_publish_variants,
		...mqtt_subscribe_variants,
		...mqtt_disconnect_variants,
		...discover_devices_variants,
		...register_device_variants,
		...get_device_info_variants,
		...operate_device_variants,
		...speak_text_variants,
		...listen_for_speech_variants,
	]

	// Register each variant
	allToolVariants.forEach((v) => {
		NexusAIToolSet.register(v)
	})
}
