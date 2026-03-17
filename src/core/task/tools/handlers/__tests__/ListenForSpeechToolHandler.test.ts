import { afterEach, beforeEach, describe, it } from "mocha"
import "should"
import type { ToolUse } from "@core/assistant-message"
import { VoiceSessionManager } from "@services/voice/VoiceSessionManager"
import sinon from "sinon"
import { ClineDefaultTool } from "@/shared/tools"
import { TaskState } from "../../../TaskState"
import type { ToolValidator } from "../../ToolValidator"
import type { TaskConfig } from "../../types/TaskConfig"
import { ListenForSpeechToolHandler } from "../ListenForSpeechToolHandler"

function makeBlock(params: Record<string, string | undefined> = {}): ToolUse {
	return { type: "tool_use", name: ClineDefaultTool.LISTEN_FOR_SPEECH, params, partial: false }
}

function makeConfig(voiceSttEnabled: boolean, taskState = new TaskState()): { config: TaskConfig; say: sinon.SinonStub } {
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
					if (key === "voiceSttEnabled") return voiceSttEnabled
					return undefined
				},
			},
		},
	} as unknown as TaskConfig
	return { config, say }
}

describe("ListenForSpeechToolHandler", () => {
	let handler: ListenForSpeechToolHandler
	let waitForTranscriptionStub: sinon.SinonStub

	beforeEach(() => {
		// Reset singleton each test so stubs are clean
		VoiceSessionManager.getInstance().dispose()
		waitForTranscriptionStub = sinon.stub(VoiceSessionManager.getInstance(), "waitForTranscription").resolves("hello there")
		handler = new ListenForSpeechToolHandler({} as unknown as ToolValidator)
	})

	afterEach(() => {
		sinon.restore()
		VoiceSessionManager.getInstance().dispose()
	})

	describe("execute() — STT disabled", () => {
		it("returns disabled message without calling say or waitForTranscription", async () => {
			const { config, say } = makeConfig(false)
			const result = await handler.execute(config, makeBlock())

			;(result as string).should.containEql("STT is disabled")
			say.called.should.be.false()
			waitForTranscriptionStub.called.should.be.false()
		})
	})

	describe("execute() — STT enabled, transcription received", () => {
		it("calls say(voice_listen, prompt) with default prompt when none given", async () => {
			const { config, say } = makeConfig(true)
			await handler.execute(config, makeBlock())

			say.calledWith("voice_listen", sinon.match.string).should.be.true()
		})

		it("calls say(voice_listen, prompt) with provided custom prompt", async () => {
			const { config, say } = makeConfig(true)
			await handler.execute(config, makeBlock({ prompt: "What is your name?" }))

			say.calledWith("voice_listen", "What is your name?").should.be.true()
		})

		it("returns the transcribed text in the result", async () => {
			const { config } = makeConfig(true)
			const result = await handler.execute(config, makeBlock())

			;(result as string).should.containEql("hello there")
		})

		it("resets consecutiveMistakeCount to 0", async () => {
			const taskState = new TaskState()
			taskState.consecutiveMistakeCount = 5
			const { config } = makeConfig(true, taskState)
			await handler.execute(config, makeBlock())
			config.taskState.consecutiveMistakeCount.should.equal(0)
		})
	})

	describe("execute() — STT enabled, timeout (no speech)", () => {
		it("returns no-speech message when waitForTranscription resolves empty", async () => {
			waitForTranscriptionStub.resolves("")
			const { config } = makeConfig(true)
			const result = await handler.execute(config, makeBlock())

			;(result as string).should.containEql("No speech was captured")
		})
	})

	describe("getDescription()", () => {
		it("returns [listen_for_speech]", () => {
			handler.getDescription(makeBlock()).should.equal("[listen_for_speech]")
		})
	})
})
