import { ModelFamily } from "@/shared/prompts"
import { NexusAIDefaultTool } from "@/shared/tools"
import type { NexusAIToolSpec } from "../spec"
import { TASK_PROGRESS_PARAMETER } from "../types"

const id = NexusAIDefaultTool.LIST_CODE_DEF

const generic: NexusAIToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "list_code_definition_names",
	description:
		"Request to list definition names (classes, functions, methods, etc.) used in source code files at the top level of the specified directory. This tool provides insights into the codebase structure and important constructs, encapsulating high-level concepts and relationships that are crucial for understanding the overall architecture.",
	parameters: [
		{
			name: "path",
			required: true,
			instruction: `The path of a directory (not a file) relative to the current working directory {{CWD}}{{MULTI_ROOT_HINT}}. Lists definitions across all source files in that directory. To inspect a single file, use read_file instead.`,
			usage: "Directory path here",
		},
		TASK_PROGRESS_PARAMETER,
	],
}

const NATIVE_GPT_5: NexusAIToolSpec = {
	variant: ModelFamily.NATIVE_GPT_5,
	id,
	name: "list_code_definition_names",
	description:
		"Request to list definition names (classes, functions, methods, etc.) used in source code files at the top level of the specified directory. This tool provides insights into the codebase structure and important constructs, encapsulating high-level concepts and relationships that are crucial for understanding the overall architecture.",
	parameters: [
		{
			name: "path",
			required: true,
			instruction: `The path of a directory (not a file) relative to the current working directory {{CWD}}{{MULTI_ROOT_HINT}}. Lists definitions across all source files in that directory. To inspect a single file, use read_file instead.`,
		},
		TASK_PROGRESS_PARAMETER,
	],
}

const NATIVE_NEXT_GEN: NexusAIToolSpec = {
	...NATIVE_GPT_5,
	variant: ModelFamily.NATIVE_NEXT_GEN,
}

export const list_code_definition_names_variants = [generic, NATIVE_GPT_5, NATIVE_NEXT_GEN]
