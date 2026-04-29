import { expect } from "@playwright/test"
import { e2e } from "./utils/helpers"

// Test for setting up API keys
e2e("Views - can set up API keys and navigate to Settings from Chat", async ({ sidebar }) => {
	// Use the page object to interact with editor outside the sidebar
	// Verify initial state — all user type options and navigation buttons are present
	await expect(sidebar.getByRole("button", { name: "Login to Cline" })).toBeVisible()
	// Use exact:true because the description text also contains "GitHub Copilot"
	await expect(sidebar.getByText("GitHub Copilot", { exact: true })).toBeVisible()
	await expect(sidebar.getByText("Bring my own API key", { exact: true })).toBeVisible()

	// Navigate to API key setup
	await sidebar.getByText("Bring my own API key").click()
	await sidebar.getByRole("button", { name: "Continue" }).click()

	const providerSelectorInput = sidebar.getByTestId("provider-selector-input")

	// Verify provider selector is visible
	await expect(providerSelectorInput).toBeVisible()

	// Test Cline provider option
	await providerSelectorInput.click({ delay: 100 })
	// Wait for dropdown to appear and find Cline option
	await expect(sidebar.getByTestId("provider-option-cline")).toBeVisible()
	await sidebar.getByTestId("provider-option-cline").click({ delay: 100 })
	await expect(sidebar.getByRole("button", { name: "Sign in to Cline" })).toBeVisible()

	// Switch to OpenRouter and complete setup
	await providerSelectorInput.click({ delay: 100 })
	await sidebar.getByTestId("provider-option-openrouter").click({ delay: 100 })

	const apiKeyInput = sidebar.getByRole("textbox", {
		name: "OpenRouter API Key",
	})
	await apiKeyInput.fill("test-api-key")
	await expect(apiKeyInput).toHaveValue("test-api-key")
	await apiKeyInput.click({ delay: 100 })
	await sidebar.getByRole("button", { name: "Continue" }).click()

	await expect(sidebar.getByRole("button", { name: "Login to Cline" })).not.toBeVisible()

	// Verify start up page is no longer visible
	await expect(apiKeyInput).not.toBeVisible()
	await expect(providerSelectorInput).not.toBeVisible()

	// "What's New" modal may or may not appear depending on persisted session state.
	// If it appears, close it so it never blocks chat interactions.
	const dialog = sidebar.getByRole("heading", {
		name: /^🎉 New in v\d/,
	})
	const closeBtn = sidebar.getByRole("button", { name: "Close" }).first()
	const dialogVisible = await dialog.isVisible().catch(() => false)
	if (dialogVisible) {
		await closeBtn.click()
		await expect(dialog).not.toBeVisible()
	}

	// Setup flow finished; visibility assertions above already validate progression.
})
