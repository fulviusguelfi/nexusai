import { ModelFamily } from "@/shared/prompts"
import { NexusAIDefaultTool } from "@/shared/tools"
import type { NexusAIToolSpec } from "../spec"

const id = NexusAIDefaultTool.KILL_PROCESS

const generic: NexusAIToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "kill_process",
	description:
		"Terminate a running OS process by PID. Use list_processes first to find the correct PID. Requires user approval since this is a potentially destructive operation.",
	parameters: [
		{
			name: "pid",
			required: true,
			type: "integer",
			instruction: "The process ID (PID) to terminate.",
			usage: "12345",
		},
		{
			name: "signal",
			required: false,
			instruction:
				"The signal to send. Defaults to SIGTERM (graceful). Use SIGKILL to force-kill. On Windows, SIGKILL is used regardless.",
			usage: "SIGTERM",
		},
	],
}

const NATIVE_GPT_5: NexusAIToolSpec = {
	...generic,
	variant: ModelFamily.NATIVE_GPT_5,
}

const NATIVE_NEXT_GEN: NexusAIToolSpec = {
	...NATIVE_GPT_5,
	variant: ModelFamily.NATIVE_NEXT_GEN,
}

export const kill_process_variants = [generic, NATIVE_GPT_5, NATIVE_NEXT_GEN]
