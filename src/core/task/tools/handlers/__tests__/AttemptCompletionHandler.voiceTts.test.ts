import { afterEach, beforeEach, describe, it } from "mocha"
import "should"
import { VoiceSessionManager } from "@services/voice/VoiceSessionManager"
import sinon from "sinon"
import { TaskState } from "../../../TaskState"
import { AttemptCompletionHandler } from "../AttemptCompletionHandler"

describe("AttemptCompletionHandler voice TTS", () => {
	beforeEach(() => {
		VoiceSessionManager.getInstance().dispose()
	})

	afterEach(() => {
		sinon.restore()
		VoiceSessionManager.getInstance().dispose()
	})

	it("does not request speech twice for one completion_result", async () => {
		const requestSpeakStub = sinon.stub(VoiceSessionManager.getInstance(), "requestSpeak")
		const sayStub = sinon.stub().resolves(123)

		const config = {
			taskId: "task-1",
			ulid: "ulid-1",
			api: {
				getModel: () => ({ id: "gpt-5", info: { apiFormat: "responses" } }),
			},
			taskState: Object.assign(new TaskState(), { isVoiceInput: true }),
			doubleCheckCompletionEnabled: false,
			focusChainSettings: { enabled: false },
			autoApprovalSettings: { enableNotifications: false },
			messageState: {
				getClineMessages: () => [],
				setClineMessages: sinon.stub(),
				saveClineMessagesAndUpdateHistory: sinon.stub().resolves(),
				updateClineMessage: sinon.stub().resolves(),
			},
			callbacks: {
				say: sayStub,
				saveCheckpoint: sinon.stub().resolves(),
				doesLatestTaskCompletionHaveNewChanges: sinon.stub().resolves(false),
				ask: sinon.stub().resolves({ response: "yesButtonClicked" }),
				updateFCListFromToolResponse: sinon.stub().resolves(),
				removeLastPartialMessageIfExistsWithType: sinon.stub().resolves(),
				runUserPromptSubmitHook: sinon.stub().resolves({ cancel: false }),
			},
			services: {
				stateManager: {
					getGlobalStateKey: (key: string) => (key === "voiceTtsEnabled" ? true : undefined),
					getGlobalSettingsKey: (key: string) => (key === "mode" ? "act" : false),
					getApiConfiguration: () => ({
						actModeApiProvider: "openrouter",
						planModeApiProvider: "openrouter",
					}),
				},
			},
		} as any

		const handler = new AttemptCompletionHandler()
		await handler.execute(config, {
			type: "tool_use",
			name: "attempt_completion",
			partial: false,
			params: { result: "resultado final" },
		} as any)

		requestSpeakStub.calledOnce.should.be.true()
		const [spokenText, callbackArg, sourceArg] = requestSpeakStub.firstCall.args as [string, unknown, string]
		spokenText.should.equal("resultado final")
		;(callbackArg === undefined).should.be.true()
		sourceArg.should.equal("attempt_completion")
		sayStub.calledOnce.should.be.true()
		sayStub.firstCall.args[0].should.equal("completion_result")
	})

	it("does not request speech for non-voice tasks", async () => {
		const requestSpeakStub = sinon.stub(VoiceSessionManager.getInstance(), "requestSpeak")
		const sayStub = sinon.stub().resolves(123)

		const config = {
			taskId: "task-1",
			ulid: "ulid-1",
			api: {
				getModel: () => ({ id: "gpt-5", info: { apiFormat: "responses" } }),
			},
			taskState: new TaskState(),
			doubleCheckCompletionEnabled: false,
			focusChainSettings: { enabled: false },
			autoApprovalSettings: { enableNotifications: false },
			messageState: {
				getClineMessages: () => [],
				setClineMessages: sinon.stub(),
				saveClineMessagesAndUpdateHistory: sinon.stub().resolves(),
				updateClineMessage: sinon.stub().resolves(),
			},
			callbacks: {
				say: sayStub,
				saveCheckpoint: sinon.stub().resolves(),
				doesLatestTaskCompletionHaveNewChanges: sinon.stub().resolves(false),
				ask: sinon.stub().resolves({ response: "yesButtonClicked" }),
				updateFCListFromToolResponse: sinon.stub().resolves(),
				removeLastPartialMessageIfExistsWithType: sinon.stub().resolves(),
				runUserPromptSubmitHook: sinon.stub().resolves({ cancel: false }),
			},
			services: {
				stateManager: {
					getGlobalStateKey: (key: string) => (key === "voiceTtsEnabled" ? true : undefined),
					getGlobalSettingsKey: (key: string) => (key === "mode" ? "act" : false),
					getApiConfiguration: () => ({
						actModeApiProvider: "openrouter",
						planModeApiProvider: "openrouter",
					}),
				},
			},
		} as any

		const handler = new AttemptCompletionHandler()
		await handler.execute(config, {
			type: "tool_use",
			name: "attempt_completion",
			partial: false,
			params: { result: "resultado final" },
		} as any)

		requestSpeakStub.notCalled.should.be.true()
	})
})
