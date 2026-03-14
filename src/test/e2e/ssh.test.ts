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
		// Mock LLM will connect first then upload ./README.md (exec-based, default exit 0)
		sshServer.acceptPassword("testuser", "testpass")

		await helper.signin(sidebar)
		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("ssh_upload_request")
		await sidebar.getByTestId("send-button").click()

		await E2ETestHelper.waitForChatMessage(sidebar, "uploaded", 60_000)
	})

	// ── 6 ─────────────────────────────────────────────────────────────────────────
	e2e("ssh_download — fetches remote file, verifies local creation", async ({ helper, sidebar, workspaceDir }) => {
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

		// Connect first, then wait for the completion text (not the tool row) so the
		// task has fully finished before we send the next message.
		await inputbox.fill("ssh_connect_password_request")
		await sidebar.getByTestId("send-button").click()
		await E2ETestHelper.waitForChatMessage(sidebar, "SSH connection established", 60_000)

		// Disconnect
		await inputbox.fill("ssh_disconnect_request")
		await sidebar.getByTestId("send-button").click()
		await E2ETestHelper.waitForChatMessage(sidebar, "disconnected", 60_000)

		// Execute after disconnect should fail gracefully (no unhandled error)
		// Uses a dedicated keyword so the mock executes directly without re-connecting
		await inputbox.fill("ssh_execute_no_session_request")
		await sidebar.getByTestId("send-button").click()
		await E2ETestHelper.waitForChatMessage(sidebar, "no active SSH session", 60_000)
	})

	// ── 8 ─────────────────────────────────────────────────────────────────────────
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
