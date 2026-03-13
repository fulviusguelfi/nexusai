import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import type { ClineToolSpec } from "../spec"

const id = ClineDefaultTool.SSH_UPLOAD

const generic: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "ssh_upload",
	description:
		"Upload a local file to the remote host over the active SSH/SFTP session. Requires user approval. Use the absolute local path and the desired absolute remote destination path.",
	parameters: [
		{
			name: "local_path",
			required: true,
			instruction: "Absolute path of the local file to upload.",
			usage: "/home/user/script.sh",
		},
		{
			name: "remote_path",
			required: true,
			instruction: "Absolute destination path on the remote host.",
			usage: "/tmp/script.sh",
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

export const ssh_upload_variants = [generic, NATIVE_GPT_5, NATIVE_NEXT_GEN]
