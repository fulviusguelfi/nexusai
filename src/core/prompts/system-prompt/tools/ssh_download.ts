import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import type { ClineToolSpec } from "../spec"

const id = ClineDefaultTool.SSH_DOWNLOAD

const generic: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "ssh_download",
	description:
		"Download a file from the remote host to the local machine over the active SSH/SFTP session. Use the absolute remote source path and the desired local destination path.",
	parameters: [
		{
			name: "remote_path",
			required: true,
			instruction: "Absolute path of the file on the remote host to download.",
			usage: "/var/log/syslog",
		},
		{
			name: "local_path",
			required: true,
			instruction: "Absolute destination path on the local machine.",
			usage: "/tmp/syslog",
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

export const ssh_download_variants = [generic, NATIVE_GPT_5, NATIVE_NEXT_GEN]
