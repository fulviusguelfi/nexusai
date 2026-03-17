import { spawn } from "node:child_process"
import { expect } from "@playwright/test"
import { E2ETestHelper, e2e } from "./utils/helpers"

e2e.describe("Terminal Tools", () => {
	e2e("list_processes — tool executes and appears in chat", async ({ helper, sidebar }) => {
		await helper.signin(sidebar)

		const inputbox = sidebar.getByTestId("chat-input")
		await expect(inputbox).toBeVisible()

		await inputbox.fill("list_processes_request")
		await sidebar.getByTestId("send-button").click()

		// Handler calls say("tool", "[list_processes]") — verify it appears in chat
		await E2ETestHelper.waitForChatMessage(sidebar, "[list_processes]", 60_000)
	})

	e2e("execute_command — long-running command shows Proceed While Running button", async ({ helper, sidebar }) => {
		await helper.signin(sidebar)

		const inputbox = sidebar.getByTestId("chat-input")
		await expect(inputbox).toBeVisible()

		await inputbox.fill("execute_command_long")
		await sidebar.getByTestId("send-button").click()

		// Wait for command approval button (state: "command")
		await expect(sidebar.getByRole("button", { name: "Run Command" })).toBeVisible({ timeout: 60_000 })
		await sidebar.getByRole("button", { name: "Run Command" }).click()

		// After command starts, "Proceed While Running" button appears (state: "command_output")
		await expect(sidebar.getByRole("button", { name: "Proceed While Running" })).toBeVisible({ timeout: 60_000 })
	})

	e2e("kill_process — happy path terminates spawned process", async ({ helper, sidebar }) => {
		await helper.signin(sidebar)

		// Spawn a long-running process so we have a real PID to kill
		const proc = process.platform === "win32" ? spawn("ping", ["-n", "100", "127.0.0.1"]) : spawn("sleep", ["60"])

		const pid = proc.pid
		if (!pid) {
			throw new Error("Failed to spawn test process: pid is undefined")
		}

		try {
			const inputbox = sidebar.getByTestId("chat-input")
			await expect(inputbox).toBeVisible()

			// Mock server extracts PID via /kill_process_request\s+(\d+)/ and injects it into XML
			await inputbox.fill(`kill_process_request ${pid}`)
			await sidebar.getByTestId("send-button").click()

			// KillProcessToolHandler calls ask("tool", ...) → shows tool_approve buttons
			await expect(sidebar.getByRole("button", { name: "Approve" })).toBeVisible({ timeout: 60_000 })
			await sidebar.getByRole("button", { name: "Approve" }).click()

			// Handler returns "Process N terminated successfully."
			await E2ETestHelper.waitForChatMessage(sidebar, "terminated successfully", 60_000)
		} finally {
			// Belt-and-suspenders: ensure test process is cleaned up even if the test fails
			proc.kill()
		}
	})
})
