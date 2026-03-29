import { strict as assert } from "node:assert"
import { describe, it } from "mocha"
import { combineErrorRetryMessages } from "../combineErrorRetryMessages"
import type { ClineMessage } from "../ExtensionMessage"

const mkMsg = (overrides: Partial<ClineMessage> & { say: ClineMessage["say"] }): ClineMessage =>
	({
		ts: Date.now(),
		type: "say",
		...overrides,
	}) as ClineMessage

describe("combineErrorRetryMessages", () => {
	it("keeps only the latest error_retry in an ongoing retry sequence", () => {
		const messages: ClineMessage[] = [
			mkMsg({ say: "error_retry", text: JSON.stringify({ attempt: 1, maxAttempts: 3 }), ts: 1 }),
			mkMsg({ say: "api_req_retried", ts: 2 }),
			mkMsg({ say: "error_retry", text: JSON.stringify({ attempt: 2, maxAttempts: 3 }), ts: 3 }),
			mkMsg({ say: "api_req_retried", ts: 4 }),
			mkMsg({ say: "error_retry", text: JSON.stringify({ attempt: 3, maxAttempts: 3 }), ts: 5 }),
		]
		const result = combineErrorRetryMessages(messages)
		// api_req_retried messages pass through; only error_retry messages are consolidated
		const retryMessages = result.filter((m) => m.say === "error_retry")
		assert.equal(retryMessages.length, 1, "only the latest error_retry should remain")
		const info = JSON.parse(retryMessages[0].text || "{}")
		assert.equal(info.attempt, 3)
	})

	it("removes error_retry entirely when followed by a successful api_req_started", () => {
		const messages: ClineMessage[] = [
			mkMsg({ say: "error_retry", text: JSON.stringify({ attempt: 1, maxAttempts: 3 }), ts: 1 }),
			mkMsg({ say: "api_req_retried", ts: 2 }),
			mkMsg({ say: "api_req_started", text: "{}", ts: 3 }),
		]
		const result = combineErrorRetryMessages(messages)
		// error_retry is removed; api_req_retried and api_req_started pass through
		assert.ok(
			result.every((m) => m.say !== "error_retry"),
			"error_retry should not appear in result",
		)
		assert.equal(result[result.length - 1].say, "api_req_started")
	})

	it("retains a failed:true error_retry even when followed by api_req_started", () => {
		// failed:true means all retries were exhausted — it must remain visible in the UI
		const messages: ClineMessage[] = [
			mkMsg({ say: "error_retry", text: JSON.stringify({ attempt: 1, maxAttempts: 3 }), ts: 1 }),
			mkMsg({ say: "api_req_retried", ts: 2 }),
			mkMsg({
				say: "error_retry",
				text: JSON.stringify({ attempt: 3, maxAttempts: 3, failed: true }),
				ts: 3,
			}),
			mkMsg({ say: "api_req_started", text: "{}", ts: 4 }),
		]
		const result = combineErrorRetryMessages(messages)
		const retryMessages = result.filter((m) => m.say === "error_retry")
		assert.equal(retryMessages.length, 1)
		const info = JSON.parse(retryMessages[0].text || "{}")
		assert.equal(info.failed, true)
	})

	it("preserves actionableMessage field in a failed:true error_retry", () => {
		const actionableMessage =
			"Try switching to a different model, reducing the context size by starting a new task, or waiting before retrying."
		const messages: ClineMessage[] = [
			mkMsg({ say: "error_retry", text: JSON.stringify({ attempt: 1, maxAttempts: 3 }), ts: 1 }),
			mkMsg({ say: "api_req_retried", ts: 2 }),
			mkMsg({
				say: "error_retry",
				text: JSON.stringify({
					attempt: 3,
					maxAttempts: 3,
					failed: true,
					actionableMessage,
				}),
				ts: 3,
			}),
		]
		const result = combineErrorRetryMessages(messages)
		const retryMsg = result.find((m) => m.say === "error_retry")
		assert.ok(retryMsg, "error_retry message should be present")
		const info = JSON.parse(retryMsg!.text || "{}")
		assert.equal(info.actionableMessage, actionableMessage)
	})

	it("returns an empty array for an empty input", () => {
		assert.deepEqual(combineErrorRetryMessages([]), [])
	})

	it("passes through unrelated messages unchanged", () => {
		const messages: ClineMessage[] = [
			mkMsg({ say: "text", text: "hello", ts: 1 }),
			mkMsg({ say: "api_req_started", text: "{}", ts: 2 }),
		]
		const result = combineErrorRetryMessages(messages)
		assert.equal(result.length, 2)
	})
})
