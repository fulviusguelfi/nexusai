import { expect } from "@playwright/test"
import { E2ETestHelper, e2e } from "./utils/helpers"

e2e("Settings - opening Voice tab keeps UI responsive", async ({ helper, sidebar, page }) => {
	await helper.signin(sidebar)

	const nexusaiActions = page.getByRole("toolbar", { name: "NexusAI actions" })
	const settingsBtn = nexusaiActions.getByRole("button", { name: "Settings" })
	await expect(settingsBtn).toBeVisible({ timeout: 30_000 })
	await settingsBtn.click({ delay: 100 })

	const voiceTab = sidebar.getByTestId("tab-voice")
	await expect(voiceTab).toBeVisible({ timeout: 30_000 })
	await voiceTab.click({ delay: 100 })

	await expect(sidebar.getByText("Voice Settings", { exact: false })).toBeVisible({ timeout: 30_000 })

	const doneBtn = sidebar.getByRole("button", { name: "Done" })
	await expect(doneBtn).toBeVisible({ timeout: 30_000 })
	await doneBtn.click({ delay: 100 })

	const inputbox = sidebar.getByTestId("chat-input")
	await expect(inputbox).toBeVisible({ timeout: 30_000 })
	await inputbox.fill("healthcheck_after_voice_settings")
	await sidebar.getByTestId("send-button").click({ delay: 50 })

	await E2ETestHelper.waitForChatMessage(sidebar, "healthcheck_after_voice_settings", 30_000)
})
