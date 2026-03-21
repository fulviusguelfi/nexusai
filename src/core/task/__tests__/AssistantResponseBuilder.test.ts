import { expect } from "chai"
import { AssistantResponseBuilder } from "../services/AssistantResponseBuilder"

describe("AssistantResponseBuilder", () => {
	it("builds content with redacted thinking, thinking, text, and tool uses", () => {
		const builder = new AssistantResponseBuilder()
		const reasonsHandler = {
			getRedactedThinking: () => [{ type: "redacted_thinking", data: "abc" }] as any,
			getCurrentReasoning: () => ({ type: "thinking", thinking: "reason", summary: [{ step: "s1" }] }) as any,
		}
		const toolUseHandler = {
			getAllFinalizedToolUses: (_summary?: any) => [{ type: "tool_use", id: "1", name: "read_file", input: {} }] as any,
		}

		const result = builder.build({
			reasonsHandler,
			toolUseHandler,
			assistantTextOnly: "Hello",
			assistantTextSignature: "sig",
			assistantMessageId: "msg-1",
		})

		expect(result.hasAssistantText).to.be.true
		expect(result.assistantContent.length).to.equal(4)
		expect(result.assistantContent[0].type).to.equal("redacted_thinking")
		expect(result.assistantContent[1].type).to.equal("thinking")
		expect(result.assistantContent[2].type).to.equal("text")
		expect((result.assistantContent[2] as any).text).to.equal("Hello")
		expect(result.assistantContent[3].type).to.equal("tool_use")
	})

	it("passes thinking summary to tool uses when there is no assistant text", () => {
		const builder = new AssistantResponseBuilder()
		const summary = [{ detail: "trace" }]
		let receivedSummary: any

		const reasonsHandler = {
			getRedactedThinking: () => [],
			getCurrentReasoning: () => ({ type: "thinking", thinking: "reason", summary }) as any,
		}
		const toolUseHandler = {
			getAllFinalizedToolUses: (arg?: any) => {
				receivedSummary = arg
				return [{ type: "tool_use", id: "1", name: "read_file", input: {} }] as any
			},
		}

		const result = builder.build({
			reasonsHandler,
			toolUseHandler,
			assistantTextOnly: "   ",
			assistantTextSignature: undefined,
			assistantMessageId: "msg-1",
		})

		expect(result.hasAssistantText).to.be.false
		expect(receivedSummary).to.deep.equal(summary)
		expect(result.assistantContent.some((c) => c.type === "text")).to.be.false
	})

	it("omits thinking block when absent", () => {
		const builder = new AssistantResponseBuilder()
		const reasonsHandler = {
			getRedactedThinking: () => [],
			getCurrentReasoning: () => undefined,
		}
		const toolUseHandler = {
			getAllFinalizedToolUses: () => [],
		}

		const result = builder.build({
			reasonsHandler,
			toolUseHandler,
			assistantTextOnly: "Only text",
			assistantTextSignature: undefined,
			assistantMessageId: "msg-1",
		})

		expect(result.assistantContent.length).to.equal(1)
		expect(result.assistantContent[0].type).to.equal("text")
	})
})
