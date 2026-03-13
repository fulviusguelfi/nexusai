import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import type { ClineToolSpec } from "../spec"

const id = ClineDefaultTool.SSH_CONNECT

const generic: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "ssh_connect",
	description:
		"Open an SSH connection to a remote host. Supports password and private-key authentication. The session persists for the duration of the task and can be used with ssh_execute, ssh_upload, ssh_download, and ssh_disconnect. Requires user approval.",
	parameters: [
		{
			name: "host",
			required: true,
			instruction: "Hostname or IP address of the remote SSH server.",
			usage: "192.168.1.10",
		},
		{
			name: "user",
			required: true,
			instruction: "SSH username.",
			usage: "ubuntu",
		},
		{
			name: "port",
			required: false,
			type: "integer",
			instruction: "SSH port. Defaults to 22.",
			usage: "22",
		},
		{
			name: "password",
			required: false,
			instruction: "Password for password-based authentication. Either password or private_key_path is required.",
			usage: "mypassword",
		},
		{
			name: "private_key_path",
			required: false,
			instruction: "Absolute path to a PEM-encoded private key file for key-based authentication.",
			usage: "/home/user/.ssh/id_rsa",
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

export const ssh_connect_variants = [generic, NATIVE_GPT_5, NATIVE_NEXT_GEN]
