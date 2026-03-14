export const E2E_REGISTERED_MOCK_ENDPOINTS = {
	"/api/v1": {
		GET: [
			"/generation",
			"/organizations/{orgId}/balance",
			"/organizations/{orgId}/members/{memberId}/usages",
			"/organizations/{orgId}/api-keys",
			"/organizations/{orgId}/remote-config",
			"/users/me",
			"/users/{userId}/balance",
			"/users/{userId}/usages",
			"/users/{userId}/payments",
		],
		POST: ["/chat/completions", "/auth/token"],
		PUT: ["/users/active-account"],
	},
	"/.test": {
		GET: [],
		POST: ["/auth", "/setUserBalance", "/setUserHasOrganization", "/setOrgBalance"],
		PUT: [],
	},
	"/health": {
		POST: [],
		GET: ["/", "/ping"],
		PUT: [],
	},
}

const replace_in_file = `I successfully replaced "john" with "cline" in the test.ts file. The change has been completed and the file now contains:

\`\`\`typescript
export const name = "cline"
\`\`\`

The TypeScript errors shown in the output are unrelated to this change - they appear to be existing issues in the broader codebase related to missing type definitions and dependencies. The specific task of updating the name in test.ts has been completed successfully.

<attempt_completion>
<result>
I have successfully replaced the name "john" with "cline" in the test.ts file. The file now exports:

\`\`\`typescript
export const name = "cline"
\`\`\`

The change has been applied and saved to the file.
</result>
</attempt_completion>`

const edit_request = `<thinking>
The user wants me to replace the name "john" with "cline" in the test.ts file. I can see the file content provided:

\`\`\`typescript
export const name = "john"
\`\`\`

I need to change "john" to "cline". This is a simple targeted edit, so I should use the replace_in_file tool rather than write_to_file since I'm only changing one small part of the file.

I need to:
1. Use replace_in_file to change "john" to "cline" in the test.ts file
2. The SEARCH block should match the exact content: \`export const name = "john"\`
3. The REPLACE block should be: \`export const name = "cline"\`
</thinking>

I'll replace "john" with "cline" in the test.ts file.

<replace_in_file>
<path>test.ts</path>
<diff>
------- SEARCH
export const name = "john"
=======
export const name = "cline"
+++++++ REPLACE
</diff>
</replace_in_file>`

const list_processes_request = `I'll list the running processes for you.

<list_processes>
</list_processes>`

// ── SSH mock responses ─────────────────────────────────────────────────────

/** Turn 1 for any test that needs to connect first (password auth on localhost:2222). */
const SSH_CONNECT_REQUEST = `I'll connect to the SSH server with the provided credentials.

<ssh_connect>
<host>127.0.0.1</host>
<port>2222</port>
<user>testuser</user>
<auth_method>password</auth_method>
<password>testpass</password>
</ssh_connect>`

/** Completion returned after ssh_connect tool result is in context. */
const SSH_CONNECT_COMPLETION = `SSH connection established successfully.

<attempt_completion>
<result>Connected to SSH server at 127.0.0.1:2222.</result>
</attempt_completion>`

/** Discover network hosts (single-turn). */
const SSH_DISCOVER_REQUEST = `I'll discover hosts on the local network.

<discover_network_hosts>
</discover_network_hosts>`

/** Completion after discover_network_hosts ran — always mentions 127.0.0.1 for test assertion. */
const SSH_DISCOVER_COMPLETION = `The network scan is complete. Found host 127.0.0.1 (loopback) on the local network.

<attempt_completion>
<result>Discovered hosts: 127.0.0.1</result>
</attempt_completion>`

/** Turn 2 for ssh_execute (after connect succeeds). */
const SSH_EXECUTE_REQUEST = `Now I'll execute the command on the remote host.

<ssh_execute>
<command>echo hello</command>
</ssh_execute>`

/** Completion after ssh_execute tool result is in context. */
const SSH_EXECUTE_COMPLETION = `Command executed successfully. Output: hello

<attempt_completion>
<result>Remote command output: hello</result>
</attempt_completion>`

/** Turn 1 for ssh_execute with no active session (expects failure). */
const SSH_EXECUTE_NO_SESSION_REQUEST = `I'll try to execute the command on the SSH session.

<ssh_execute>
<command>echo hello</command>
</ssh_execute>`

/** Completion after execute fails with "no active ssh session". */
const SSH_EXECUTE_NO_SESSION_COMPLETION = `The command failed because there is no active ssh session available.

<attempt_completion>
<result>no active SSH session — connection not established</result>
</attempt_completion>`

/** Disconnect the active SSH session. */
const SSH_DISCONNECT_REQUEST = `I'll disconnect the SSH session.

<ssh_disconnect>
</ssh_disconnect>`

/** Completion after ssh_disconnect ran. */
const SSH_DISCONNECT_COMPLETION = `SSH session disconnected successfully.

<attempt_completion>
<result>SSH session closed.</result>
</attempt_completion>`

/** Turn 2 for ssh_upload (after connect succeeds). */
const SSH_UPLOAD_REQUEST = `I'll upload the file to the remote server.

<ssh_upload>
<local_path>./README.md</local_path>
<remote_path>/tmp/nexusai-remote-upload.txt</remote_path>
</ssh_upload>`

/** Completion after ssh_upload ran. */
const SSH_UPLOAD_COMPLETION = `File upload completed successfully.

<attempt_completion>
<result>File uploaded to remote server.</result>
</attempt_completion>`

/** Turn 2 for ssh_download (after connect succeeds). */
const SSH_DOWNLOAD_REQUEST = `I'll download the file from the remote server.

<ssh_download>
<remote_path>/tmp/remote.txt</remote_path>
<local_path>./nexusai-downloaded.txt</local_path>
</ssh_download>`

/** Completion after ssh_download ran. */
const SSH_DOWNLOAD_COMPLETION = `File download completed successfully.

<attempt_completion>
<result>File downloaded from remote server.</result>
</attempt_completion>`

const execute_command_long = `I'll run a long-running command for you.

<execute_command>
<command>${process.platform === "win32" ? "ping -n 30 127.0.0.1" : "ping -c 30 127.0.0.1"}</command>
<requires_approval>true</requires_approval>
</execute_command>`

export const E2E_MOCK_API_RESPONSES = {
	DEFAULT: "Hello! I'm a mock Cline API response.",
	REPLACE_REQUEST: replace_in_file,
	EDIT_REQUEST: edit_request,
	LIST_PROCESSES_REQUEST: list_processes_request,
	EXECUTE_COMMAND_LONG: execute_command_long,
	// SSH responses
	SSH_CONNECT_REQUEST,
	SSH_CONNECT_COMPLETION,
	SSH_DISCOVER_REQUEST,
	SSH_DISCOVER_COMPLETION,
	SSH_EXECUTE_REQUEST,
	SSH_EXECUTE_COMPLETION,
	SSH_EXECUTE_NO_SESSION_REQUEST,
	SSH_EXECUTE_NO_SESSION_COMPLETION,
	SSH_DISCONNECT_REQUEST,
	SSH_DISCONNECT_COMPLETION,
	SSH_UPLOAD_REQUEST,
	SSH_UPLOAD_COMPLETION,
	SSH_DOWNLOAD_REQUEST,
	SSH_DOWNLOAD_COMPLETION,
}

/**
 * Builds a mock LLM response that calls kill_process with the given PID.
 * Used by terminal.test.ts to inject the real PID of the spawned test process.
 */
export function buildKillProcessResponse(pid: number): string {
	return `I'll terminate process ${pid} for you.

<kill_process>
<pid>${pid}</pid>
</kill_process>`
}

/**
 * Builds the follow-up LLM response after kill_process has already succeeded.
 * The tool result ("terminated successfully") is already in the conversation context,
 * so the mock returns a completion response that echoes the success.
 */
export function buildKillProcessCompletionResponse(pid: number): string {
	return `Process ${pid} terminated successfully.

<attempt_completion>
<result>Process ${pid} terminated successfully.</result>
</attempt_completion>`
}
