import { render } from "@testing-library/react"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getLatestChatTextAreaProps = () => (globalThis as any).__latestChatTextAreaProps
const setLatestChatTextAreaProps = (props: any) => {
	;(globalThis as any).__latestChatTextAreaProps = props
}

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => (globalThis as any).__mockExtensionState,
}))

vi.mock("@/components/chat/ChatTextArea", () => ({
	default: React.forwardRef<any, any>((props, _ref) => {
		setLatestChatTextAreaProps(props)
		return <div data-testid="chat-textarea-mock" />
	}),
}))

describe("InputSection voice flow", () => {
	beforeEach(() => {
		;(globalThis as any).__mockExtensionState = {
			voiceSttEnabled: true,
			voiceMetadataEnabled: true,
		}
		setLatestChatTextAreaProps(null)
	})

	it("blocks late STT after send and unblocks on next recording start", async () => {
		const { InputSection } = await import("./InputSection")

		const setInputValue = vi.fn()
		const handleSendMessage = vi.fn()

		const chatState = {
			activeQuote: null,
			setActiveQuote: vi.fn(),
			isTextAreaFocused: false,
			inputValue: "texto base",
			setInputValue,
			sendingDisabled: false,
			selectedImages: [],
			setSelectedImages: vi.fn(),
			selectedFiles: [],
			setSelectedFiles: vi.fn(),
			textAreaRef: { current: null },
			handleFocusChange: vi.fn(),
		} as any

		const scrollBehavior = {
			isAtBottom: true,
			scrollToBottomAuto: vi.fn(),
		} as any

		const messageHandlers = {
			handleSendMessage,
		} as any

		render(
			<InputSection
				chatState={chatState}
				messageHandlers={messageHandlers}
				placeholderText="Digite"
				scrollBehavior={scrollBehavior}
				selectFilesAndImages={vi.fn().mockResolvedValue(undefined)}
				shouldDisableFilesAndImages={false}
			/>,
		)

		const props = getLatestChatTextAreaProps()
		expect(props).toBeTruthy()

		props.onTranscription("fala agora", "pt", false)
		expect(setInputValue).toHaveBeenCalledTimes(1)

		props.onSend()
		expect(handleSendMessage).toHaveBeenCalledTimes(1)
		expect(handleSendMessage).toHaveBeenCalledWith(
			"[voice input, spoken in pt — respond naturally as spoken]\ntexto base",
			[],
			[],
		)

		props.onTranscription("resultado tardio", "pt", false)
		expect(setInputValue).toHaveBeenCalledTimes(1)

		props.onVoiceRecordingStarted()
		props.onTranscription("novo ciclo", "pt", false)
		expect(setInputValue).toHaveBeenCalledTimes(2)
	})

	it("does not prepend metadata when voice metadata is disabled", async () => {
		const { InputSection } = await import("./InputSection")

		;(globalThis as any).__mockExtensionState = {
			voiceSttEnabled: true,
			voiceMetadataEnabled: false,
		}

		const handleSendMessage = vi.fn()

		render(
			<InputSection
				chatState={
					{
						activeQuote: null,
						setActiveQuote: vi.fn(),
						isTextAreaFocused: false,
						inputValue: "sem metadata",
						setInputValue: vi.fn(),
						sendingDisabled: false,
						selectedImages: [],
						setSelectedImages: vi.fn(),
						selectedFiles: [],
						setSelectedFiles: vi.fn(),
						textAreaRef: { current: null },
						handleFocusChange: vi.fn(),
					} as any
				}
				messageHandlers={{ handleSendMessage } as any}
				placeholderText="Digite"
				scrollBehavior={{ isAtBottom: true, scrollToBottomAuto: vi.fn() } as any}
				selectFilesAndImages={vi.fn().mockResolvedValue(undefined)}
				shouldDisableFilesAndImages={false}
			/>,
		)

		const props = getLatestChatTextAreaProps()
		props.onTranscription("fala", "pt", false)
		props.onSend()

		expect(handleSendMessage).toHaveBeenCalledWith("sem metadata", [], [])
	})
})
