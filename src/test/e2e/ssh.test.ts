import { expect } from "@playwright/test"
import { MockSshServer } from "./fixtures/ssh-server"
import { E2ETestHelper, e2e } from "./utils/helpers"

// Phase 3 — SSH Tools
//
// All handlers are in src/core/task/tools/handlers/ and use workspace-scoped sessions
// (keyed by config.cwd) so sessions persist across tasks in the same VS Code window.
//
// Mock server keyword → LLM response mappings are in fixtures/server/api.ts and
// fixtures/server/index.ts.

const sshServer = new MockSshServer()

e2e.describe("SSH Tools", () => {
	e2e.beforeAll(async () => {
		await sshServer.start(2222)
	})

	e2e.afterAll(async () => {
		await sshServer.stop()
	})

	// Reset accumulated credentials/handlers between tests to prevent state bleeding.
	e2e.beforeEach(() => {
		sshServer.reset()
	})

	// ── 1 ─────────────────────────────────────────────────────────────────────────
	e2e("discover_network_hosts — mock returns host list, UI displays them", async ({ helper, sidebar }) => {
		await helper.signin(sidebar)

		const inputbox = sidebar.getByTestId("chat-input")
		await expect(inputbox).toBeVisible()
		await inputbox.fill("discover_network_hosts_request")
		await sidebar.getByTestId("send-button").click()

		// Completion response always mentions 127.0.0.1 for reliable assertion
		await E2ETestHelper.waitForChatMessage(sidebar, "127.0.0.1", 60_000)
	})

	// ── 2 ─────────────────────────────────────────────────────────────────────────
	e2e("ssh_connect — key auth, chat confirms connection", async ({ helper, sidebar }) => {
		sshServer.acceptKey(Buffer.from("test-key"))
		// Also accept password so the mock LLM response (which uses password) succeeds
		sshServer.acceptPassword("testuser", "testpass")

		await helper.signin(sidebar)
		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("ssh_connect_key_request")
		await sidebar.getByTestId("send-button").click()

		await E2ETestHelper.waitForChatMessage(sidebar, "connected to", 60_000)
	})

	// ── 3 ─────────────────────────────────────────────────────────────────────────
	e2e("ssh_connect — password auth, chat confirms connection", async ({ helper, sidebar }) => {
		sshServer.acceptPassword("testuser", "testpass")

		await helper.signin(sidebar)
		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("ssh_connect_password_request")
		await sidebar.getByTestId("send-button").click()

		await E2ETestHelper.waitForChatMessage(sidebar, "connected to", 60_000)
	})

	// ── 4 ─────────────────────────────────────────────────────────────────────────
	e2e("ssh_execute — runs command on active session, chat shows stdout", async ({ helper, sidebar }) => {
		// Mock LLM will connect first then execute (see fixtures/server/index.ts routing)
		sshServer.acceptPassword("testuser", "testpass")
		sshServer.onExecute("echo hello", (ch) => {
			ch.write("hello\n")
			ch.exit(0)
			ch.end()
		})

		await helper.signin(sidebar)
		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("ssh_execute_request")
		await sidebar.getByTestId("send-button").click()

		await E2ETestHelper.waitForChatMessage(sidebar, "hello", 60_000)
	})

	// ── 5 ─────────────────────────────────────────────────────────────────────────
	e2e("ssh_upload — transfers local file to remote, chat confirms", async ({ helper, sidebar }) => {
		// Mock LLM will connect first then upload ./README.md via `cat > '<remote_path>' `.
		// We register an explicit exec handler so the mock server can respond immediately
		// without relying on the default stdin-drain handler (which has platform-level
		// stream-mode caveats in the ssh2 library).
		sshServer.acceptPassword("testuser", "testpass")
		sshServer.onExecute("cat > '/tmp/nexusai-remote-upload.txt' ", (ch) => {
			// Drain client stdin before responding, mirroring real `cat > file` behaviour.
			// Calling ch.exit(0)+ch.end() immediately (before the client writes) can cause
			// the ssh2 channel to close before the write buffers are flushed on Windows,
			// causing stream.on("close") on the client side to never fire.
			const s = ch as any
			s.on("data", () => {})
			// done guard prevents double exit(0)+end() if both 'end' and 'close' fire.
			// On Linux 'end' fires reliably; on Windows 'close' is the fallback.
			let uploadDone = false
			const uploadFinish = () => {
				if (!uploadDone) {
					uploadDone = true
					ch.exit(0)
					ch.end()
				}
			}
			s.on("end", uploadFinish)
			s.on("close", uploadFinish)
		})

		await helper.signin(sidebar)
		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("ssh_upload_request")
		await sidebar.getByTestId("send-button").click()

		await E2ETestHelper.waitForChatMessage(sidebar, "uploaded", 60_000)
	})

	// ── 6 ─────────────────────────────────────────────────────────────────────────
	e2e("ssh_download — fetches remote file, verifies local creation", async ({ helper, sidebar }) => {
		// Mock LLM will connect first then download /tmp/remote.txt via exec (cat)
		sshServer.acceptPassword("testuser", "testpass")
		sshServer.onExecute("cat '/tmp/remote.txt' ", (ch) => {
			ch.write("remote-content\n")
			ch.exit(0)
			ch.end()
		})

		await helper.signin(sidebar)
		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("ssh_download_request")
		await sidebar.getByTestId("send-button").click()

		await E2ETestHelper.waitForChatMessage(sidebar, "downloaded", 60_000)
	})

	// ── 7 ─────────────────────────────────────────────────────────────────────────
	e2e("ssh_disconnect — closes session, subsequent ssh_execute fails gracefully", async ({ helper, sidebar }) => {
		sshServer.acceptPassword("testuser", "testpass")

		await helper.signin(sidebar)
		const inputbox = sidebar.getByTestId("chat-input")

		// Use a distinct connect keyword so that the disconnect message (sent as
		// feedback in the same task) is not shadowed by ssh_connect routing.
		// "ssh_connect_for_disconnect_request" routes to the same SSH_CONNECT_REQUEST
		// response but is not matched by the ssh_connect check when the body only
		// contains "ssh_disconnect_request".
		await inputbox.fill("ssh_connect_for_disconnect_request")
		await sidebar.getByTestId("send-button").click()
		await E2ETestHelper.waitForChatMessage(sidebar, "connected to", 60_000)

		// Wait for the send button to become enabled, which signals that the task
		// is now blocked on ask("completion_result") and ready to accept feedback.
		// Sending a message while the button is still disabled (sendingDisabled=true)
		// silently drops the click in ChatTextArea's onClick handler.
		const sendBtn = sidebar.getByTestId("send-button")
		await sendBtn.waitFor({ state: "visible", timeout: 20_000 })
		await expect(sendBtn).not.toHaveClass(/\bdisabled\b/, { timeout: 20_000 })

		// Disconnect (sent as feedback to the same task — the distinct connect keyword
		// prevents routing conflicts).
		await inputbox.fill("ssh_disconnect_request")
		await sendBtn.click()
		await E2ETestHelper.waitForChatMessage(sidebar, "disconnected", 60_000)

		// Execute after disconnect should fail gracefully (no unhandled error)
		// Uses a dedicated keyword so the mock executes directly without re-connecting.
		// Wait for the send button to be enabled again before sending, as it is
		// briefly disabled while the disconnect completion is being processed.
		await expect(sendBtn).not.toHaveClass(/\bdisabled\b/, { timeout: 20_000 })
		await inputbox.fill("ssh_execute_no_session_request")
		await sendBtn.click()
		await E2ETestHelper.waitForChatMessage(sidebar, "no active SSH session", 60_000)
	})

	// ── 8 ─────────────────────────────────────────────────────────────────────────
	e2e("ssh_connect — by saved server name, resolves credentials from registry", async ({ helper, sidebar }) => {
		// The handler auto-saves every successful connection to SshServerProfileRegistry.
		// This test verifies that a follow-up task can connect using only server_name,
		// with credentials resolved transparently from SecretStorage.
		sshServer.acceptPassword("testuser", "testpass")

		await helper.signin(sidebar)
		const inputbox = sidebar.getByTestId("chat-input")
		const sendBtn = sidebar.getByTestId("send-button")

		// Task 1 — regular password connect (profile gets auto-saved).
		await inputbox.fill("ssh_connect_password_request")
		await sendBtn.click()
		await E2ETestHelper.waitForChatMessage(sidebar, "connected to", 60_000)

		// Wait for the task to complete and send button to re-enable.
		await sendBtn.waitFor({ state: "visible", timeout: 20_000 })
		await expect(sendBtn).not.toHaveClass(/\bdisabled\b/, { timeout: 20_000 })

		// Task 2 — connect by name only; registry resolves host/port/user/credential.
		await inputbox.fill("ssh_connect_by_name_request")
		await sendBtn.click()
		await E2ETestHelper.waitForChatMessage(sidebar, "saved profile", 60_000)
	})

	// ── 9 ─────────────────────────────────────────────────────────────────────────
	e2e("(SSH_CONNECT_REAL=true) real SSH connection to localhost", async ({ helper, sidebar }) => {
		e2e.skip(!process.env.SSH_CONNECT_REAL, "Set SSH_CONNECT_REAL=true to run this test")

		// Real test: requires a local SSH server accepting credentials from env vars
		// SSH_USER / SSH_PASS / SSH_HOST / SSH_PORT must be set alongside SSH_CONNECT_REAL
		await helper.signin(sidebar)
		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("ssh_connect_password_request")
		await sidebar.getByTestId("send-button").click()

		await E2ETestHelper.waitForChatMessage(sidebar, "connected to", 60_000)
	})
})
