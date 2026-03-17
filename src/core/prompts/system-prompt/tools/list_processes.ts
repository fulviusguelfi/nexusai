import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import type { ClineToolSpec } from "../spec"

const id = ClineDefaultTool.LIST_PROCESSES

const generic: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "list_processes",
	description:
		"List currently running OS processes. Returns PID, name, CPU%, and memory usage for each process. Useful for inspecting what is running before killing a process or diagnosing resource usage.",
	parameters: [
		{
			name: "filter",
			required: false,
			instruction: "Optional substring to filter process names. If omitted, returns all processes.",
			usage: "node",
		},
	],
}

const NATIVE_GPT_5: ClineToolSpec = {
	...generic,
	variant: ModelFamily.NATIVE_GPT_5,
}

const NATIVE_NEXT_GEN: ClineToolSpec = {
	...NATIVE_GPT_5,
	variant: ModelFamily.NATIVE_NEXT_GEN,
}

export const list_processes_variants = [generic, NATIVE_GPT_5, NATIVE_NEXT_GEN]
