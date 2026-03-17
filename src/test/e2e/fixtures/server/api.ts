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
	"/command": {
		GET: [],
		POST: ["/"],
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

/** Turn 1 for ssh_connect by saved server name (profile already persisted in registry). */
const SSH_CONNECT_BY_NAME_REQUEST = `I'll connect using the saved server profile.

<ssh_connect>
<server_name>testuser@127.0.0.1</server_name>
</ssh_connect>`

/** Completion after ssh_connect by name succeeds. */
const SSH_CONNECT_BY_NAME_COMPLETION = `Connected successfully using the saved server profile.

<attempt_completion>
<result>Connected to SSH server using saved profile testuser@127.0.0.1.</result>
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
const SSH_UPLOAD_COMPLETION = `File uploaded successfully to the remote server.

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
	SSH_CONNECT_BY_NAME_REQUEST,
	SSH_CONNECT_BY_NAME_COMPLETION,
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

// ── Voice mock responses ──────────────────────────────────────────────────

// ─ 1. speak_text ─────────────────────────────────────────────────────────

/** Turn 1 for speak_text — TTS is disabled by default so the tool returns a "TTS disabled" message. */
const VOICE_SPEAK_REQUEST = `I'll speak the text using text-to-speech.

<speak_text>
<text>Hello, NexusAI voice is working.</text>
</speak_text>`

/** Completion returned after speak_text tool result is in context. */
const VOICE_SPEAK_COMPLETION = `The text-to-speech attempt has been processed.

<attempt_completion>
<result>speak_text executed. TTS is disabled. The user can enable it in Settings → Voice. Text was: Hello, NexusAI voice is working.</result>
</attempt_completion>`

// ─ 2. listen_for_speech ──────────────────────────────────────────────────

/** Turn 1 for listen_for_speech — STT is disabled by default. */
const VOICE_LISTEN_REQUEST = `I'll listen for speech input from the user.

<listen_for_speech>
<prompt>Please speak now.</prompt>
</listen_for_speech>`

/** Completion returned after listen_for_speech tool result is in context. */
const VOICE_LISTEN_COMPLETION = `The speech-to-text attempt has been processed.

<attempt_completion>
<result>listen_for_speech executed. STT is disabled. The user can enable it in Settings → Voice.</result>
</attempt_completion>`

export const E2E_VOICE_MOCK_API_RESPONSES = {
	VOICE_SPEAK_REQUEST,
	VOICE_SPEAK_COMPLETION,
	VOICE_LISTEN_REQUEST,
	VOICE_LISTEN_COMPLETION,
}

// ── IoT mock responses ────────────────────────────────────────────────────

// ─ 1. discover_devices ───────────────────────────────────────────────────
const IOT_DISCOVER_REQUEST = `I'll scan the local network for devices using mDNS/Bonjour.

<discover_devices>
<timeout_ms>1000</timeout_ms>
</discover_devices>`

const IOT_DISCOVER_COMPLETION = `The mDNS scan completed. No devices were discovered on the local network at this time.

<attempt_completion>
<result>discover_devices complete. No devices discovered.</result>
</attempt_completion>`

// ─ 2. register_device ────────────────────────────────────────────────────
const IOT_REGISTER_REQUEST = `I'll register the test device in the IoT registry.

<register_device>
<name>TestBulb</name>
<ip>192.168.99.1</ip>
<type>SMART_BULB</type>
<protocol>HTTP_REST</protocol>
<trusted_local>false</trusted_local>
</register_device>`

const IOT_REGISTER_COMPLETION = `The device has been registered successfully.

<attempt_completion>
<result>Device TestBulb registered at 192.168.99.1.</result>
</attempt_completion>`

// ─ 3. get_device_info – list all ─────────────────────────────────────────
const IOT_GET_ALL_REGISTER = `I'll register a device first, then list all.

<register_device>
<name>BulbAlpha</name>
<ip>192.168.88.1</ip>
<type>SMART_BULB</type>
<protocol>HTTP_REST</protocol>
<trusted_local>false</trusted_local>
</register_device>`

const IOT_GET_ALL_REQUEST = `Now I'll list all registered devices.

<get_device_info>
</get_device_info>`

const IOT_GET_ALL_COMPLETION = `Retrieved all registered devices. Found 1 registered device.

<attempt_completion>
<result>Registered devices: BulbAlpha at 192.168.88.1.</result>
</attempt_completion>`

// ─ 4. get_device_info – by IP ────────────────────────────────────────────
const IOT_GET_BY_IP_REGISTER = `I'll register a device to query later by IP.

<register_device>
<name>SensorBeta</name>
<ip>192.168.88.2</ip>
<type>MQTT_SENSOR</type>
<protocol>MQTT</protocol>
<trusted_local>false</trusted_local>
</register_device>`

const IOT_GET_BY_IP_REQUEST = `I'll look up the device by its IP address.

<get_device_info>
<ip>192.168.88.2</ip>
</get_device_info>`

const IOT_GET_BY_IP_COMPLETION = `Found the device. Name: SensorBeta, IP: 192.168.88.2.

<attempt_completion>
<result>Device info retrieved for SensorBeta at 192.168.88.2.</result>
</attempt_completion>`

// ─ 5. http_request SSRF block ────────────────────────────────────────────
const IOT_HTTP_SSRF_REQUEST = `I'll attempt to request an internal IP to test SSRF protection.

<http_request>
<url>http://10.0.0.1/</url>
<method>GET</method>
</http_request>`

const IOT_HTTP_SSRF_COMPLETION = `The request was blocked by the SSRF protection for private addresses.

<attempt_completion>
<result>http_request SSRF protection blocked the request to 10.0.0.1.</result>
</attempt_completion>`

// ─ 6. http_request trusted (SSRF bypass) ─────────────────────────────────
const IOT_HTTP_TRUSTED_REGISTER = `I'll register localhost as a trusted local device first.

<register_device>
<name>LocalHealthEndpoint</name>
<ip>127.0.0.1</ip>
<type>COMPUTER</type>
<protocol>HTTP_REST</protocol>
<trusted_local>true</trusted_local>
</register_device>`

const IOT_HTTP_TRUSTED_REQUEST = `Now I'll make an HTTP GET request to the trusted local device.

<http_request>
<url>http://127.0.0.1:7777/health/</url>
<method>GET</method>
</http_request>`

const IOT_HTTP_TRUSTED_COMPLETION = `The HTTP request succeeded. The response contains {"status":"ok"}.

<attempt_completion>
<result>http_request GET http://127.0.0.1:7777/health/ returned status 200.</result>
</attempt_completion>`

// ─ 7. mqtt_connect ───────────────────────────────────────────────────────
const IOT_MQTT_CONNECT_REQUEST = `I'll connect to the local MQTT broker.

<mqtt_connect>
<broker>mqtt://127.0.0.1:1884</broker>
<client_id>nexusai-e2e-test</client_id>
</mqtt_connect>`

const IOT_MQTT_CONNECT_COMPLETION = `Connected successfully to the MQTT broker at 127.0.0.1:1884.

<attempt_completion>
<result>mqtt_connect established connection to 127.0.0.1:1884.</result>
</attempt_completion>`

// ─ 8. mqtt_publish ───────────────────────────────────────────────────────
const IOT_MQTT_PUBLISH_REQUEST = `I'll publish a message to the test topic.

<mqtt_publish>
<topic>test/e2e</topic>
<message>hello-from-nexusai</message>
<qos>0</qos>
</mqtt_publish>`

const IOT_MQTT_PUBLISH_COMPLETION = `Message published successfully to test/e2e.

<attempt_completion>
<result>mqtt_publish sent message to topic test/e2e.</result>
</attempt_completion>`

// ─ 9. mqtt_subscribe ─────────────────────────────────────────────────────
const IOT_MQTT_SUBSCRIBE_REQUEST = `I'll subscribe to the test topic with a short timeout.

<mqtt_subscribe>
<topic>test/e2e/sub</topic>
<timeout_ms>1500</timeout_ms>
<max_messages>10</max_messages>
</mqtt_subscribe>`

const IOT_MQTT_SUBSCRIBE_COMPLETION = `Subscription window closed. No messages received within the timeout.

<attempt_completion>
<result>mqtt_subscribe completed — timeout reached, 0 messages collected.</result>
</attempt_completion>`

// ─ 10. mqtt_disconnect ───────────────────────────────────────────────────
const IOT_MQTT_DISCONNECT_REQUEST = `I'll disconnect from the MQTT broker.

<mqtt_disconnect>
</mqtt_disconnect>`

const IOT_MQTT_DISCONNECT_COMPLETION = `MQTT session disconnected successfully.

<attempt_completion>
<result>mqtt_disconnect closed the MQTT session.</result>
</attempt_completion>`

// ─ 11. operate_device – MQTT path ────────────────────────────────────────
const IOT_OPERATE_MQTT_REGISTER = `I'll register an MQTT sensor device.

<register_device>
<name>MqttSensor1</name>
<ip>192.168.88.10</ip>
<type>MQTT_SENSOR</type>
<protocol>MQTT</protocol>
<capabilities>devices/sensor1/command</capabilities>
<trusted_local>false</trusted_local>
</register_device>`

const IOT_OPERATE_MQTT_CONNECT = `Now I'll connect to the MQTT broker.

<mqtt_connect>
<broker>mqtt://127.0.0.1:1884</broker>
<client_id>nexusai-operate-mqtt</client_id>
</mqtt_connect>`

const IOT_OPERATE_MQTT_OPERATE = `Now I'll send a command to the registered device.

<operate_device>
<ip>192.168.88.10</ip>
<command>on</command>
</operate_device>`

const IOT_OPERATE_MQTT_COMPLETION = `Command sent via MQTT. Device MqttSensor1 acknowledged.

<attempt_completion>
<result>operate_device MQTT path: command "on" sent to MqttSensor1 via MQTT.</result>
</attempt_completion>`

// ─ 12. operate_device – HTTP path ────────────────────────────────────────
const IOT_OPERATE_HTTP_REGISTER = `I'll register a trusted local HTTP device.

<register_device>
<name>LocalHttpDevice</name>
<ip>127.0.0.1</ip>
<type>COMPUTER</type>
<protocol>HTTP_REST</protocol>
<capabilities>http://127.0.0.1:7777</capabilities>
<trusted_local>true</trusted_local>
</register_device>`

const IOT_OPERATE_HTTP_OPERATE = `Now I'll operate the device via HTTP.

<operate_device>
<ip>127.0.0.1</ip>
<command>status</command>
</operate_device>`

const IOT_OPERATE_HTTP_COMPLETION = `HTTP command dispatched to the device. Response received.

<attempt_completion>
<result>operate_device HTTP path: command "status" dispatched to LocalHttpDevice.</result>
</attempt_completion>`

// ─ 13. operate_device – SSH path ─────────────────────────────────────────
const IOT_OPERATE_SSH_REGISTER = `I'll register a device that communicates via SSH.

<register_device>
<name>SshComputer</name>
<ip>192.168.88.20</ip>
<type>COMPUTER</type>
<protocol>SSH</protocol>
<trusted_local>false</trusted_local>
</register_device>`

const IOT_OPERATE_SSH_CONNECT = `I'll establish an SSH connection to the device.

<ssh_connect>
<host>127.0.0.1</host>
<port>2222</port>
<user>testuser</user>
<auth_method>password</auth_method>
<password>testpass</password>
</ssh_connect>`

const IOT_OPERATE_SSH_OPERATE = `I'll run a status command on the device using SSH.

<operate_device>
<ip>192.168.88.20</ip>
<command>status</command>
</operate_device>`

const IOT_OPERATE_SSH_COMPLETION = `SSH command executed on SshComputer. Uptime retrieved successfully.

<attempt_completion>
<result>operate_device SSH path: "status" executed on SshComputer via SSH.</result>
</attempt_completion>`

export const E2E_IOT_MOCK_API_RESPONSES = {
	// discover
	IOT_DISCOVER_REQUEST,
	IOT_DISCOVER_COMPLETION,
	// register
	IOT_REGISTER_REQUEST,
	IOT_REGISTER_COMPLETION,
	// get all
	IOT_GET_ALL_REGISTER,
	IOT_GET_ALL_REQUEST,
	IOT_GET_ALL_COMPLETION,
	// get by ip
	IOT_GET_BY_IP_REGISTER,
	IOT_GET_BY_IP_REQUEST,
	IOT_GET_BY_IP_COMPLETION,
	// http ssrf
	IOT_HTTP_SSRF_REQUEST,
	IOT_HTTP_SSRF_COMPLETION,
	// http trusted
	IOT_HTTP_TRUSTED_REGISTER,
	IOT_HTTP_TRUSTED_REQUEST,
	IOT_HTTP_TRUSTED_COMPLETION,
	// mqtt connect
	IOT_MQTT_CONNECT_REQUEST,
	IOT_MQTT_CONNECT_COMPLETION,
	// mqtt publish
	IOT_MQTT_PUBLISH_REQUEST,
	IOT_MQTT_PUBLISH_COMPLETION,
	// mqtt subscribe
	IOT_MQTT_SUBSCRIBE_REQUEST,
	IOT_MQTT_SUBSCRIBE_COMPLETION,
	// mqtt disconnect
	IOT_MQTT_DISCONNECT_REQUEST,
	IOT_MQTT_DISCONNECT_COMPLETION,
	// operate mqtt
	IOT_OPERATE_MQTT_REGISTER,
	IOT_OPERATE_MQTT_CONNECT,
	IOT_OPERATE_MQTT_OPERATE,
	IOT_OPERATE_MQTT_COMPLETION,
	// operate http
	IOT_OPERATE_HTTP_REGISTER,
	IOT_OPERATE_HTTP_OPERATE,
	IOT_OPERATE_HTTP_COMPLETION,
	// operate ssh
	IOT_OPERATE_SSH_REGISTER,
	IOT_OPERATE_SSH_CONNECT,
	IOT_OPERATE_SSH_OPERATE,
	IOT_OPERATE_SSH_COMPLETION,
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
