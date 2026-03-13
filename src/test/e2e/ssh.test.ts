import { expect } from "@playwright/test"
import { MockSshServer } from "./fixtures/ssh-server"
import { E2ETestHelper, e2e } from "./utils/helpers"

// Phase 3 — SSH Tools (TDD)
//
// All scenarios are test.skip until the corresponding SSH tool handlers are implemented in
// src/core/task/tools/handlers/. When implementing a handler, remove the matching skip.
//
// Dependencies:
//   - `ssh2` npm package (run `npm install` on branch feat/fase-3-ssh)
//   - SSH tool handlers: ssh_connect, ssh_execute, ssh_upload, ssh_download, ssh_disconnect
//   - discover_network_hosts handler
//   - Mock server keyword matcher for each tool (add to fixtures/server/api.ts + index.ts)

const sshServer = new MockSshServer()

e2e.describe("SSH Tools", () => {
	e2e.beforeAll(async () => {
		// Only starts if ssh2 is installed; all tests are test.skip otherwise
		try {
			await sshServer.start(2222)
		} catch {
			// ssh2 not yet installed — tests remain skipped
		}
	})

	e2e.afterAll(async () => {
		await sshServer.stop()
	})

	// ── 1 ─────────────────────────────────────────────────────────────────────────
	e2e.skip("discover_network_hosts — mock returns host list, UI displays them", async ({ helper, sidebar }) => {
		// TODO when implementing handler:
		// Add keyword "discover_network_hosts_request" to fixtures/server/api.ts
		// Returns LLM response: <discover_network_hosts></discover_network_hosts>
		await helper.signin(sidebar)

		const inputbox = sidebar.getByTestId("chat-input")
		await expect(inputbox).toBeVisible()
		await inputbox.fill("discover_network_hosts_request")
		await sidebar.getByTestId("send-button").click()

		// Tool result rendered in chat — adjust selector to match actual UI
		await E2ETestHelper.waitForChatMessage(sidebar, "127.0.0.1", 60_000)
	})

	// ── 2 ─────────────────────────────────────────────────────────────────────────
	e2e.skip("ssh_connect — key auth, chat confirms connection", async ({ helper, sidebar }) => {
		// TODO: add "ssh_connect_key_request" keyword to mock server
		// Returns: <ssh_connect><host>127.0.0.1</host><port>2222</port><user>testuser</user><auth_method>key</auth_method></ssh_connect>
		sshServer.acceptKey(Buffer.from("test-key"))

		await helper.signin(sidebar)
		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("ssh_connect_key_request")
		await sidebar.getByTestId("send-button").click()

		await E2ETestHelper.waitForChatMessage(sidebar, "connected to", 60_000)
	})

	// ── 3 ─────────────────────────────────────────────────────────────────────────
	e2e.skip("ssh_connect — password auth, chat confirms connection", async ({ helper, sidebar }) => {
		// TODO: add "ssh_connect_password_request" keyword to mock server
		sshServer.acceptPassword("testuser", "testpass")

		await helper.signin(sidebar)
		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("ssh_connect_password_request")
		await sidebar.getByTestId("send-button").click()

		await E2ETestHelper.waitForChatMessage(sidebar, "connected to", 60_000)
	})

	// ── 4 ─────────────────────────────────────────────────────────────────────────
	e2e.skip("ssh_execute — runs command on active session, chat shows stdout", async ({ helper, sidebar }) => {
		// TODO: add "ssh_execute_request" keyword; session must already be established
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
	e2e.skip("ssh_upload — transfers local file to remote, chat confirms", async ({ helper, sidebar }) => {
		// TODO: add "ssh_upload_request" keyword
		sshServer.acceptPassword("testuser", "testpass")

		await helper.signin(sidebar)
		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("ssh_upload_request")
		await sidebar.getByTestId("send-button").click()

		await E2ETestHelper.waitForChatMessage(sidebar, "uploaded", 60_000)
	})

	// ── 6 ─────────────────────────────────────────────────────────────────────────
	e2e.skip("ssh_download — fetches remote file, verifies local creation", async ({ helper, sidebar, workspaceDir }) => {
		// TODO: add "ssh_download_request" keyword
		sshServer.acceptPassword("testuser", "testpass")
		sshServer.onExecute("cat /tmp/remote.txt", (ch) => {
			ch.write("remote-content\n")
			ch.exit(0)
			ch.end()
		})

		await helper.signin(sidebar)
		const inputbox = sidebar.getByTestId("chat-input")
		await inputbox.fill("ssh_download_request")
		await sidebar.getByTestId("send-button").click()

		await E2ETestHelper.waitForChatMessage(sidebar, "downloaded", 60_000)
		// TODO: also verify the downloaded file exists in workspaceDir
	})

	// ── 7 ─────────────────────────────────────────────────────────────────────────
	e2e.skip("ssh_disconnect — closes session, subsequent ssh_execute fails gracefully", async ({ helper, sidebar }) => {
		// TODO: add "ssh_disconnect_request" keyword
		sshServer.acceptPassword("testuser", "testpass")

		await helper.signin(sidebar)
		const inputbox = sidebar.getByTestId("chat-input")

		// Connect first
		await inputbox.fill("ssh_connect_password_request")
		await sidebar.getByTestId("send-button").click()
		await E2ETestHelper.waitForChatMessage(sidebar, "connected to", 60_000)

		// Disconnect
		await inputbox.fill("ssh_disconnect_request")
		await sidebar.getByTestId("send-button").click()
		await E2ETestHelper.waitForChatMessage(sidebar, "disconnected", 60_000)

		// Execute after disconnect should fail gracefully (no unhandled error)
		await inputbox.fill("ssh_execute_request")
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
