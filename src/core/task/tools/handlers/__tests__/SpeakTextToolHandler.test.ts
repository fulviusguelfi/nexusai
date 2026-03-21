import { afterEach, beforeEach, describe, it } from "mocha"
import "should"
import type { ToolUse } from "@core/assistant-message"
import { VoiceSessionManager } from "@services/voice/VoiceSessionManager"
import sinon from "sinon"
import { NexusAIDefaultTool } from "@/shared/tools"
import { TaskState } from "../../../TaskState"
import type { ToolValidator } from "../../ToolValidator"
import type { TaskConfig } from "../../types/TaskConfig"
import { SpeakTextToolHandler } from "../SpeakTextToolHandler"

function makeBlock(params: Record<string, string | undefined> = {}): ToolUse {
	return { type: "tool_use", name: NexusAIDefaultTool.SPEAK_TEXT, params, partial: false }
}

function makeConfig(voiceTtsEnabled: boolean, taskState = new TaskState()): { config: TaskConfig; say: sinon.SinonStub } {
	const say = sinon.stub().resolves(undefined)
	const config = {
		taskId: "t1",
		ulid: "u1",
		cwd: "/tmp",
		mode: "act",
		taskState,
		callbacks: {
			say,
			sayAndCreateMissingParamError: sinon.stub().resolves("missing"),
		},
		services: {
			stateManager: {
				getGlobalStateKey: (key: string) => {
					if (key === "voiceTtsEnabled") return voiceTtsEnabled
					return undefined
				},
			},
		},
	} as unknown as TaskConfig
	return { config, say }
}

describe("SpeakTextToolHandler", () => {
	let handler: SpeakTextToolHandler
	let requestSpeakStub: sinon.SinonStub

	beforeEach(() => {
		// Reset singleton and stub requestSpeak to avoid real audio
		VoiceSessionManager.getInstance().dispose()
		requestSpeakStub = sinon.stub(VoiceSessionManager.getInstance(), "requestSpeak")
		handler = new SpeakTextToolHandler({} as unknown as ToolValidator)
	})

	afterEach(() => {
		sinon.restore()
		VoiceSessionManager.getInstance().dispose()
	})

	describe("execute() — missing param", () => {
		it("returns missing-param error and increments consecutiveMistakeCount when text is absent", async () => {
			const { config } = makeConfig(true)
			const result = await handler.execute(config, makeBlock())
			result.should.equal("missing")
			config.taskState.consecutiveMistakeCount.should.equal(1)
		})
	})

	describe("execute() — TTS disabled", () => {
		it("returns disabled message without calling say or requestSpeak", async () => {
			const { config, say } = makeConfig(false)
			const result = await handler.execute(config, makeBlock({ text: "hello" }))
			;(result as string).should.containEql("TTS is disabled")
			say.called.should.be.false()
			requestSpeakStub.called.should.be.false()
		})
	})

	describe("execute() — TTS enabled", () => {
		it("calls say(voice_speak, text) and requestSpeak(text)", async () => {
			const { config, say } = makeConfig(true)
			await handler.execute(config, makeBlock({ text: "  hello world  " }))

			say.calledWith("voice_speak", "hello world").should.be.true()
			requestSpeakStub.calledWith("hello world").should.be.true()
		})

		it("returns a Speaking confirmation result", async () => {
			const { config } = makeConfig(true)
			const result = await handler.execute(config, makeBlock({ text: "announce this" }))
			;(result as string).should.containEql("Speaking")
			;(result as string).should.containEql("announce this")
		})

		it("resets consecutiveMistakeCount to 0 on success", async () => {
			const taskState = new TaskState()
			taskState.consecutiveMistakeCount = 3
			const { config } = makeConfig(true, taskState)
			await handler.execute(config, makeBlock({ text: "ok" }))
			config.taskState.consecutiveMistakeCount.should.equal(0)
		})
	})

	describe("getDescription()", () => {
		it("returns [speak_text]", () => {
			handler.getDescription(makeBlock()).should.equal("[speak_text]")
		})
	})
})
