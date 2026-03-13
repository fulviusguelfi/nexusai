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
