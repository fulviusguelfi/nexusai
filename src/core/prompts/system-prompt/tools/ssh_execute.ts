import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import type { ClineToolSpec } from "../spec"

const id = ClineDefaultTool.SSH_EXECUTE

const generic: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "ssh_execute",
	description:
		"Execute a shell command on the active SSH session established by ssh_connect. Returns combined stdout and stderr. The session must be open; use ssh_connect first.",
	parameters: [
		{
			name: "command",
			required: true,
			instruction: "The shell command to execute on the remote host.",
			usage: "ls -la /var/log",
		},
		{
			name: "requires_approval",
			required: false,
			instruction:
				"Whether to ask the user for approval before running the command. Defaults to true. Set to false only for read-only commands.",
			usage: "false",
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

export const ssh_execute_variants = [generic, NATIVE_GPT_5, NATIVE_NEXT_GEN]
