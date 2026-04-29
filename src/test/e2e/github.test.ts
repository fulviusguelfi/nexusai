import { expect } from "@playwright/test"
import { e2e } from "./utils/helpers"

/**
 * E2E tests for GitHub Copilot integration in the NexusAI onboarding flow.
 *
 * These tests validate that GitHub Copilot appears as the primary/default
 * user type during onboarding and that navigation between steps works correctly.
 *
 * NOTE: Actual GitHub authentication cannot be fully tested in E2E because it
 * requires a real browser OAuth flow handled by VS Code. These tests therefore
 * validate the UI flow up to the point where VS Code auth would be triggered.
 */
e2e.describe("GitHub Copilot Integration", () => {
	e2e("shows GitHub Copilot as the default (first) user type in onboarding Step 0", async ({ sidebar }) => {
		// Step 0 should show the user type selection screen
		await expect(sidebar.getByText("How will you use NexusAI?")).toBeVisible()
		await expect(sidebar.getByText("Select an option below to get started.")).toBeVisible()

		// GitHub Copilot must be visible as the first/default user type option
		// Use exact:true because the description paragraph also contains "GitHub Copilot"
		await expect(sidebar.getByText("GitHub Copilot", { exact: true })).toBeVisible()

		// Other user type options must also be present
		await expect(sidebar.getByText("Absolutely Free", { exact: true })).toBeVisible()
		await expect(sidebar.getByText("Frontier Model", { exact: true })).toBeVisible()
		await expect(sidebar.getByText("Bring my own API key", { exact: true })).toBeVisible()

		// Navigation buttons must be present
		await expect(sidebar.getByRole("button", { name: "Continue" })).toBeVisible()
		await expect(sidebar.getByRole("button", { name: "Login to Cline" })).toBeVisible()
	})

	e2e("navigates from GitHub Copilot user type to connection step and back", async ({ sidebar }) => {
		// Verify we are on Step 0
		await expect(sidebar.getByText("How will you use NexusAI?")).toBeVisible()

		// GitHub Copilot is the default selection — click Continue to proceed to Step 1
		await sidebar.getByRole("button", { name: "Continue" }).click()

		// Step 1 heading and action button must be visible
		// Use role-based selector since both heading and button share the same text
		await expect(sidebar.getByRole("heading", { name: "Connect GitHub Copilot" })).toBeVisible()
		await expect(sidebar.getByRole("button", { name: "Connect GitHub Copilot" })).toBeVisible()
		await expect(sidebar.getByRole("button", { name: "Back" })).toBeVisible()

		// Navigate back to Step 0
		await sidebar.getByRole("button", { name: "Back" }).click()

		// Should be back at Step 0
		await expect(sidebar.getByText("How will you use NexusAI?")).toBeVisible()
		await expect(sidebar.getByRole("button", { name: "Continue" })).toBeVisible()
	})

	e2e("can switch from GitHub Copilot to BYOK and enter provider configuration", async ({ sidebar }) => {
		// Start on Step 0
		await expect(sidebar.getByText("How will you use NexusAI?")).toBeVisible()

		// Select "Bring my own API key" user type
		await sidebar.getByText("Bring my own API key").click()

		// Click Continue — should navigate to BYOK configuration step
		await sidebar.getByRole("button", { name: "Continue" }).click()

		// Step 1 with BYOK: title should change and provider selector must appear
		await expect(sidebar.getByText("Configure your provider")).toBeVisible()
		const providerSelectorInput = sidebar.getByTestId("provider-selector-input")
		await expect(providerSelectorInput).toBeVisible()

		// Back should return to Step 0 user-type selection
		await sidebar.getByRole("button", { name: "Back" }).click()
		await expect(sidebar.getByText("How will you use NexusAI?")).toBeVisible()
	})

	e2e("can switch from GitHub Copilot to free tier and see model selection", async ({ sidebar }) => {
		// Start on Step 0
		await expect(sidebar.getByText("How will you use NexusAI?")).toBeVisible()

		// Select "Absolutely Free" user type
		await sidebar.getByText("Absolutely Free").click()

		// Continue to Step 1 — should show free model selection
		await sidebar.getByRole("button", { name: "Continue" }).click()

		// Step 1 with FREE type title should be visible
		await expect(sidebar.getByText("Select a free model")).toBeVisible()

		// Back to Step 0
		await sidebar.getByRole("button", { name: "Back" }).click()
		await expect(sidebar.getByText("How will you use NexusAI?")).toBeVisible()
	})
})
