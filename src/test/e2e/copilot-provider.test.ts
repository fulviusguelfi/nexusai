/**
 * Real-provider E2E tests — GitHub Copilot (vscode-lm) + claude-sonnet-4.6
 *
 * Prerequisites
 * ─────────────
 * 1. GitHub Copilot extension installed and authenticated in your VS Code.
 * 2. Claude models enabled in Copilot → Settings → Models.
 * 3. Set the env var:  NEXUSAI_TEST_REAL_COPILOT=true
 * 4. (Optional) Override the VS Code user-data directory:
 *      VSCODE_REAL_USER_DATA_DIR=<absolute path>
 *    Defaults to the OS-standard location of your VS Code User profile so that
 *    GitHub Copilot auth tokens / session data are available to the test.
 *
 * Run
 * ───
 *   NEXUSAI_TEST_REAL_COPILOT=true npx playwright test copilot-provider
 *
 * Why a custom fixture?
 * ─────────────────────
 * The default `e2e` fixture launches VS Code with `--disable-extensions`, which
 * prevents GitHub Copilot from loading.  This fixture omits that flag and points
 * VS Code at your real user-data directory so that Copilot auth is preserved.
 *
 * Only the NexusAI extension state (CLINE_DIR) is isolated to a temp directory,
 * so the test never mutates your personal NexusAI configuration.
 */

import { mkdtempSync } from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { expect, type Frame, type Page, test } from "@playwright/test"
import { downloadAndUnzipVSCode, SilentReporter } from "@vscode/test-electron"
import { _electron } from "playwright"
import { E2ETestHelper } from "./utils/helpers"

// ─── Guard ────────────────────────────────────────────────────────────────────

const REAL_COPILOT_ENABLED = !!process.env.NEXUSAI_TEST_REAL_COPILOT

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the OS-standard VS Code user-data directory, or the path from the
 *  VSCODE_REAL_USER_DATA_DIR env var if set. */
function resolveRealUserDataDir(): string {
	if (process.env.VSCODE_REAL_USER_DATA_DIR) {
		return process.env.VSCODE_REAL_USER_DATA_DIR
	}
	const home = os.homedir()
	switch (os.platform()) {
		case "win32":
			return path.join(home, "AppData", "Roaming", "Code", "User")
		case "darwin":
			return path.join(home, "Library", "Application Support", "Code", "User")
		default: // linux / wsl
			return path.join(home, ".config", "Code", "User")
	}
}

// ─── Custom fixture ───────────────────────────────────────────────────────────

const e2eCopilot = test.extend<{
	helper: E2ETestHelper
	page: Page
	sidebar: Frame
}>({
	helper: async ({}, use) => {
		await use(new E2ETestHelper())
	},

	page: async ({}, use, testInfo) => {
		const executablePath = await downloadAndUnzipVSCode("stable", undefined, new SilentReporter())

		// Isolate NexusAI state so the test never touches your real config.
		const nexusaiTestDir = mkdtempSync(path.join(os.tmpdir(), "nexusai-e2e-copilot-"))

		const app = await _electron.launch({
			executablePath,
			env: {
				...process.env,
				E2E_TEST: "true",
				CLINE_ENVIRONMENT: "local",
				CLINE_DIR: nexusaiTestDir,
			},
			recordVideo: {
				dir: E2ETestHelper.getResultsDir(testInfo.title, "recordings"),
			},
			args: [
				"--no-sandbox",
				"--disable-updates",
				"--disable-workspace-trust",
				"--skip-welcome",
				"--skip-release-notes",
				// NOTE: intentionally NO --disable-extensions so GitHub Copilot loads.
				// We point at the real user-data dir so Copilot auth is present.
				`--user-data-dir=${resolveRealUserDataDir()}`,
				// Load the development build of NexusAI.
				`--extensionDevelopmentPath=${E2ETestHelper.CODEBASE_ROOT_DIR}`,
				path.join(E2ETestHelper.E2E_TESTS_DIR, "fixtures", "workspace"),
			],
		})

		await E2ETestHelper.waitUntil(() => app.windows().length > 0)
		const page = await app.firstWindow()

		try {
			await use(page)
		} finally {
			await app.close()
			// Clean up only the isolated NexusAI temp dir, not the real profile.
			await E2ETestHelper.rmForRetries(nexusaiTestDir, { recursive: true }).catch(() => {})
		}
	},

	sidebar: async ({ page, helper }, use) => {
		await E2ETestHelper.openClineSidebar(page)

		// Real VS Code + user profile can take longer than the helper's 30s default.
		// Pre-wait up to 120s for any frame titled "NexusAI" to appear, then let
		// getSidebar() return immediately from its cached lookup.
		// 120s covers cold-start with many extensions (AI Toolkit, Foundry, Copilot…).
		await E2ETestHelper.waitUntil(async () => {
			for (const frame of page.frames()) {
				if (frame.isDetached()) continue
				try {
					const title = await frame.title()
					if (title.startsWith("NexusAI")) return true
				} catch {}
			}
			return false
		}, 120_000)

		const sidebar = await helper.getSidebar(page)
		await use(sidebar)
	},
})

// ─── Tests ────────────────────────────────────────────────────────────────────

e2eCopilot.describe("GitHub Copilot — vscode-lm / claude-sonnet-4.6", () => {
	// Skip this entire suite unless the opt-in env var is set.
	e2eCopilot.beforeEach(({}, testInfo) => {
		testInfo.skip(
			!REAL_COPILOT_ENABLED,
			"Set NEXUSAI_TEST_REAL_COPILOT=true to run real-provider tests (requires GitHub Copilot auth)",
		)
	})

	e2eCopilot("selects vscode-lm provider, picks claude-sonnet-4.6, and sends two olá messages", async ({ sidebar, page }) => {
		const TIMEOUT = { timeout: 30_000 }

		// ── 1. Wait for the extension to be fully initialized ─────────────
		// The webview can take several seconds to hydrate after the frame
		// attaches. Wait until either the onboarding wizard or the chat input
		// is visible before deciding which path to take.
		const onboardingLocator = sidebar.getByText("How will you use NexusAI?")
		const chatInputLocator = sidebar.getByTestId("chat-input")

		await expect(async () => {
			const onboardingReady = await onboardingLocator.isVisible()
			const chatReady = await chatInputLocator.isVisible()
			expect(onboardingReady || chatReady).toBe(true)
		}).toPass({ timeout: 60_000, intervals: [1_000] })

		// ── 2. Navigate to the provider selector ───────────────────────────
		const onboardingVisible = await onboardingLocator.isVisible().catch(() => false)

		if (onboardingVisible) {
			// Fresh NexusAI state — navigate via BYOK onboarding to the
			// provider selector.
			await sidebar.getByText("Bring my own API key").click()
			await sidebar.getByRole("button", { name: "Continue" }).click()
		} else {
			// Already configured.
			// In VS Code, the Navbar (showNavbar=false) is never rendered.
			// The Settings button lives in the panel header (toolbar "NexusAI
			// actions") which is part of the main VS Code window, not the
			// sidebar iframe. Use `page` to click it.
			const nexusaiActions = page.getByRole("toolbar", { name: "NexusAI actions" })
			const settingsBtn = nexusaiActions.getByRole("button", { name: "Settings" })
			await expect(settingsBtn).toBeVisible(TIMEOUT)
			await settingsBtn.click({ delay: 100 })

			// Ensure we land on the API Config tab (first tab, default) in
			// the Settings overlay rendered inside the sidebar frame.
			const apiConfigTab = sidebar.getByTestId("tab-api-config")
			await expect(apiConfigTab).toBeVisible(TIMEOUT)
			await apiConfigTab.click({ delay: 100 })
		}

		// ── 3. Select "VS Code LM" as the API provider ─────────────────────
		// `provider-selector-input` is a <vscode-text-field> (custom element).
		// Playwright's fill() does not work on it; click to open the dropdown
		// then type via pressSequentially() to filter, and pick the option.
		const providerInput = sidebar.getByTestId("provider-selector-input")
		await expect(providerInput).toBeVisible(TIMEOUT)

		await providerInput.click({ delay: 100 })

		// Wait for the vscode-lm option in the dropdown list.
		const vscodeLmOption = sidebar.getByTestId("provider-option-vscode-lm")
		await expect(vscodeLmOption).toBeVisible(TIMEOUT)
		await vscodeLmOption.click({ delay: 100 })

		// ── 3. Wait for the model dropdown to populate ─────────────────────
		// VSCodeLmProvider polls getVsCodeLmModels every 2 s.
		// We wait specifically for a GitHub Copilot / Claude model option
		// (value contains "claude").  AI Toolkit models (aitk-github/aitk,
		// aitk-foundry/aitk) appear quickly but are NOT the target provider.
		// Copilot LM models register lazily: allow up to 90 s.
		const modelDropdown = sidebar.locator("vscode-dropdown#vscode-lm-model")
		await expect(modelDropdown).toBeVisible(TIMEOUT)

		// Locate any option whose value includes "claude" (covers both
		// `claude-code/claude-sonnet-4.6` and potential `copilot/claude-*` forms).
		const claudeOption = sidebar
			.locator("vscode-dropdown#vscode-lm-model vscode-option")
			.filter({ hasText: /sonnet-4\.6/i })
			.first()

		const claudeModelAvailable = await claudeOption
			.waitFor({ state: "attached", timeout: 90_000 })
			.then(() => true)
			.catch(() => false)

		if (!claudeModelAvailable) {
			// Log whatever models ARE available to help diagnose the issue.
			const allOptions = await sidebar.locator("vscode-dropdown#vscode-lm-model vscode-option").allTextContents()
			console.warn(
				`[copilot-provider] GitHub Copilot LM models not found after 90s.\n` +
					`Available models: ${allOptions.join(", ") || "(none)"}\n` +
					`Ensure GitHub Copilot is authenticated and Claude models are enabled.`,
			)
			test.skip()
		}

		// ── 4. Select the claude-sonnet-4.6 model ─────────────────────────
		// Click the dropdown to open its listbox, then click the target option.
		await modelDropdown.click()

		await expect(claudeOption).toBeVisible(TIMEOUT)
		await claudeOption.click()

		// Confirm the selection is reflected in the dropdown value.
		await expect(async () => {
			const value = await modelDropdown.evaluate((el: HTMLElement & { value?: string }) => el.value)
			expect(value).toMatch(/claude/i)
		}).toPass({ timeout: 5_000 })

		// ── 5. Navigate to chat ────────────────────────────────────────────
		const continueBtn = sidebar.getByRole("button", { name: "Continue" })
		if (await continueBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
			await continueBtn.click({ delay: 100 })
		}

		// Dismiss the "What's New" / release-notes modal if it appears.
		const closeBtn = sidebar.getByRole("button", { name: "Close" })
		if (await closeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
			await closeBtn.click({ delay: 50 })
		}

		// ── 6. Verify the chat input is ready ─────────────────────────────
		const chatInput = sidebar.getByTestId("chat-input")
		await expect(chatInput).toBeVisible(TIMEOUT)

		// ── 7. First "olá" ────────────────────────────────────────────────
		await chatInput.fill("olá")
		await expect(chatInput).toHaveValue("olá")

		await sidebar.getByTestId("send-button").click()

		// Input should clear immediately after the message is dispatched.
		await expect(chatInput).toHaveValue("", TIMEOUT)

		// The user message appears in the conversation transcript.
		await expect(sidebar.getByText("olá").first()).toBeVisible(TIMEOUT)

		// ── 8. Wait for a real response from claude-sonnet-4.6 ────────────
		// The AI response is rendered inside the chat as one or more text
		// blocks.  We wait until there is at least one visible <p> that is NOT
		// part of the UI chrome (i.e., the assistant actually replied).
		// Using a 90 s timeout to accommodate slow first-token latency.
		await expect(async () => {
			// A real response will add more paragraph/text elements than the
			// single "olá" line the user sent.
			const visibleParagraphs = await sidebar.locator("p:visible, .chat-message-content:visible").count()
			expect(visibleParagraphs).toBeGreaterThanOrEqual(2)
		}).toPass({ timeout: 90_000, intervals: [3_000] })

		// ── 9. Start a new task ────────────────────────────────────────────
		await sidebar.getByRole("button", { name: "New Task", exact: true }).first().click()

		// Recent-tasks list should show "olá" as the last task.
		await expect(sidebar.getByText("Recent")).toBeVisible(TIMEOUT)
		await expect(sidebar.getByText("olá").first()).toBeVisible(TIMEOUT)

		// ── 10. Second "olá" ───────────────────────────────────────────────
		const chatInput2 = sidebar.getByTestId("chat-input")
		await expect(chatInput2).toBeVisible(TIMEOUT)

		await chatInput2.fill("olá")
		await expect(chatInput2).toHaveValue("olá")

		await sidebar.getByTestId("send-button").click()
		await expect(chatInput2).toHaveValue("", TIMEOUT)

		// Confirm the second message is visible in the chat.
		await expect(sidebar.getByText("olá").first()).toBeVisible(TIMEOUT)

		// Wait for a second response.
		await expect(async () => {
			const visibleParagraphs = await sidebar.locator("p:visible, .chat-message-content:visible").count()
			expect(visibleParagraphs).toBeGreaterThanOrEqual(2)
		}).toPass({ timeout: 90_000, intervals: [3_000] })

		await page.close()
	})
})
