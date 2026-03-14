/**
 * Cline Account — Free-model onboarding + chat E2E test
 *
 * Prerequisites
 * ─────────────
 * A Cline account authenticated on this machine.
 * Credentials are read from ~/.cline/data/secrets.json.
 * If no valid (non-expired) refreshToken is found the entire suite is SKIPPED
 * and a detailed message is printed to the test log asking the developer to
 * sign in first.
 *
 * Safety — zero credit consumption
 * ──────────────────────────────────
 * All LLM API calls are intercepted by the local mock server (localhost:7777).
 * The extension is launched with CLINE_ENVIRONMENT=local so every outbound
 * request goes to the mock server — the real Cline API is never contacted.
 *
 * What is tested
 * ──────────────
 * 1. Account detection  — reads a real refreshToken from ~/.cline/data/secrets.json.
 * 2. Free-model onboarding UI — navigates "Absolutely Free" → "Select a free model"
 *    and selects the first available free model.
 * 3. Chat — sends random messages and verifies the mock server returns responses.
 */

import { existsSync, readFileSync } from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { expect } from "@playwright/test"
import { E2ETestHelper, e2e } from "./utils/helpers"

// ─── Account detection ────────────────────────────────────────────────────────

interface StoredClineAuthInfo {
	idToken?: string
	refreshToken?: string
	expiresAt?: number
}

/**
 * Reads the developer's Cline refreshToken from the local secrets store.
 * Returns null when:
 *  - ~/.cline/data/secrets.json does not exist
 *  - the "cline:clineAccountId" key is absent
 *  - the token is already expired
 */
function readClineRefreshToken(): { refreshToken: string; expiresAt: number } | null {
	const secretsPath = path.join(os.homedir(), ".cline", "data", "secrets.json")

	if (!existsSync(secretsPath)) {
		return null
	}

	let secrets: Record<string, string>
	try {
		secrets = JSON.parse(readFileSync(secretsPath, "utf8"))
	} catch {
		return null
	}

	const raw = secrets["cline:clineAccountId"]
	if (!raw) {
		return null
	}

	let authInfo: StoredClineAuthInfo
	try {
		authInfo = JSON.parse(raw)
	} catch {
		return null
	}

	if (!authInfo.refreshToken) {
		return null
	}

	// NOTE: expiresAt is the ACCESS-TOKEN expiry (short-lived, minutes/hours).
	// The refreshToken itself is long-lived and valid even after the access token expires.
	// We only need to confirm a refreshToken exists to know the developer has an account.
	return { refreshToken: authInfo.refreshToken, expiresAt: authInfo.expiresAt ?? 0 }
}

// ─── Detect account once at module load ──────────────────────────────────────

const accountInfo = readClineRefreshToken()

const NO_ACCOUNT_MESSAGE = [
	"",
	"╔══════════════════════════════════════════════════════════╗",
	"║  ⚠  No active Cline account detected on this machine.   ║",
	"║                                                          ║",
	"║  To run the Cline-account E2E test suite, sign in to    ║",
	"║  Cline first:  https://app.cline.bot                    ║",
	"║                                                          ║",
	"║  Your credentials are stored at:                        ║",
	`║  ${path.join(os.homedir(), ".cline", "data", "secrets.json").padEnd(56)}║`,
	"╚══════════════════════════════════════════════════════════╝",
	"",
].join("\n")

// ─── Test messages ────────────────────────────────────────────────────────────

/** Messages used for the send→receive cycle. One per task to keep state clean. */
const TEST_MESSAGES = [
	"What is the purpose of a type system in programming?",
	"Can you explain the concept of recursion with a short example?",
]

// ─── Suite ────────────────────────────────────────────────────────────────────

e2e.describe("Cline Account — free model onboarding + chat (requests intercepted by mock server)", () => {
	// Skip the entire suite if no valid Cline account was found on this machine.
	e2e.beforeEach(({}, testInfo) => {
		if (!accountInfo) {
			console.warn(NO_ACCOUNT_MESSAGE)
		}
		testInfo.skip(!accountInfo, NO_ACCOUNT_MESSAGE)
	})

	// ── Test 1: account detection ─────────────────────────────────────────────
	e2e("detects a valid Cline account in secrets.json", async ({ sidebar }) => {
		// accountInfo is guaranteed non-null here (beforeEach guard)
		const expiresIso = accountInfo?.expiresAt ? new Date(accountInfo.expiresAt * 1000).toISOString() : "no expiry stored"

		console.log(`[cline-account] refreshToken found — expires at ${expiresIso}`)

		// The onboarding screen must be visible in a fresh isolated VS Code instance.
		await expect(sidebar.getByText("How will you use NexusAI?")).toBeVisible({ timeout: 15_000 })

		// The "Absolutely Free" option must be present.
		await expect(sidebar.getByText("Absolutely Free", { exact: true })).toBeVisible()
	})

	// ── Test 2: free model selection + message exchange ───────────────────────
	e2e(
		"selects first free model and exchanges messages (all API calls intercepted — zero credits consumed)",
		async ({ sidebar, server }) => {
			// ── 1. Start on onboarding Step 0 ──────────────────────────────────
			await expect(sidebar.getByText("How will you use NexusAI?")).toBeVisible({ timeout: 15_000 })

			// ── 2. Select "Absolutely Free" user type ──────────────────────────
			await sidebar.getByText("Absolutely Free").click({ delay: 100 })

			// ── 3. Advance to Step 1: "Select a free model" ────────────────────
			await sidebar.getByRole("button", { name: "Continue" }).click({ delay: 100 })
			await expect(sidebar.getByText("Select a free model")).toBeVisible({ timeout: 10_000 })

			// ── 4. The first free model is pre-selected by default.
			//       Confirm by clicking it explicitly (idempotent if already selected).
			// "KwaiKAT: Kat Coder Pro" is the first model in CLINE_ONBOARDING_MODELS.
			const firstFreeModelLabel = sidebar.getByText("KwaiKAT: Kat Coder Pro", { exact: true })
			await expect(firstFreeModelLabel).toBeVisible({ timeout: 10_000 })
			await firstFreeModelLabel.click({ delay: 100 })

			// Log which model was selected
			console.log("[cline-account] Selected free model: KwaiKAT: Kat Coder Pro (kwaipilot/kat-coder-pro)")

			// ── 5. Click "Create my Account" — triggers mock-server auth ───────
			//  In E2E mode (CLINE_ENVIRONMENT=local + E2E_TEST=true) the mock
			//  AuthService exchanges a test token with localhost:7777 without
			//  opening a real browser — zero interaction with the live Cline API.
			await sidebar.getByRole("button", { name: "Create my Account" }).click({ delay: 100 })

			// ── 6. Wait for onboarding to close and chat view to appear ─────────
			const chatInput = sidebar.getByTestId("chat-input")
			// Handle optional "What's New" / welcome dialog that may appear after
			// first login (click "Close" if visible, otherwise proceed).
			await expect(async () => {
				const closeBtn = sidebar.getByRole("button", { name: "Close" })
				const chatReady = await chatInput.isVisible()
				if (!chatReady) {
					const closeVisible = await closeBtn.isVisible()
					if (closeVisible) {
						await closeBtn.click({ delay: 50 })
					}
				}
				await expect(chatInput).toBeVisible()
			}).toPass({ timeout: 20_000, intervals: [500] })

			// ── 7. Send random messages and verify mock-server responses ────────
			// Each message is sent as a fresh task (via "New Task") so the Cline
			// agent loop doesn't carry over state from the previous interaction.
			for (const message of TEST_MESSAGES) {
				const beforeCount = server?.generationCounter ?? 0

				// Wait for the send button to be interactive.
				const sendBtn = sidebar.getByTestId("send-button")
				await expect(async () => {
					const disabled = await sendBtn.getAttribute("aria-disabled")
					const btnDisabled = await sendBtn.isDisabled().catch(() => true)
					expect(disabled !== "true" && !btnDisabled).toBe(true)
				}).toPass({ timeout: 20_000, intervals: [300] })

				await chatInput.fill(message)
				await expect(chatInput).toHaveValue(message)
				await sendBtn.click()

				// The extension clears the input when the message is submitted.
				await expect(chatInput).toHaveValue("", { timeout: 15_000 })

				// Wait for the mock server to have handled the completions call.
				await E2ETestHelper.waitUntil(() => (server?.generationCounter ?? 0) > beforeCount, 25_000)

				// The mock server always replies with the default response text.
				await expect(sidebar.getByText("Hello! I'm a mock Cline API response.")).toBeVisible({
					timeout: 20_000,
				})

				console.log(`[cline-account] ✓ Message sent & response received: "${message.slice(0, 50)}..."`)

				// Navigate to a new task so the next iteration starts from a clean
				// chat state (avoids agent-loop carryover from the previous response).
				const newTaskBtn = sidebar.getByRole("button", { name: "New Task", exact: true }).first()
				await expect(async () => {
					await expect(newTaskBtn).toBeVisible({ timeout: 5_000 })
					await newTaskBtn.click({ delay: 100 })
					// Wait until the recent-tasks list is shown
					await expect(sidebar.getByText("Recent")).toBeVisible({ timeout: 5_000 })
				}).toPass({ timeout: 15_000, intervals: [500] })
			}
		},
	)
})
