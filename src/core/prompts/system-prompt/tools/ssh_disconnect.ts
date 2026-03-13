import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import type { ClineToolSpec } from "../spec"

const id = ClineDefaultTool.SSH_DISCONNECT

const generic: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "ssh_disconnect",
	description:
		"Close the active SSH session opened by ssh_connect. Always call this when the SSH work is complete to free the remote connection.",
	parameters: [],
}

const NATIVE_GPT_5: ClineToolSpec = {
	...generic,
	variant: ModelFamily.NATIVE_GPT_5,
}

const NATIVE_NEXT_GEN: ClineToolSpec = {
	...NATIVE_GPT_5,
	variant: ModelFamily.NATIVE_NEXT_GEN,
}

export const ssh_disconnect_variants = [generic, NATIVE_GPT_5, NATIVE_NEXT_GEN]
