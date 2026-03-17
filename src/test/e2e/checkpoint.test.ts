import { expect } from "@playwright/test"
import { e2e } from "./utils/helpers"

e2e.describe("Checkpoint / Retry", () => {
	e2e("failed API request shows Retry button in chat", async ({ helper, sidebar }) => {
		await helper.signin(sidebar)

		const inputbox = sidebar.getByTestId("chat-input")
		await expect(inputbox).toBeVisible()

		// Mock server returns HTTP 500 for this keyword → extension emits api_req_failed
		await inputbox.fill("invalid_response_request")
		await sidebar.getByTestId("send-button").click()

		// api_req_failed state renders primaryText: "Retry" (see buttonConfig.ts)
		await expect(sidebar.getByRole("button", { name: "Retry" })).toBeVisible({ timeout: 60_000 })
	})
})
