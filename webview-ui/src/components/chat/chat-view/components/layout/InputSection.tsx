import React, { useCallback } from "react"
import ChatTextArea from "@/components/chat/ChatTextArea"
import QuotedMessagePreview from "@/components/chat/QuotedMessagePreview"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { ChatState, MessageHandlers, ScrollBehavior } from "../../types/chatTypes"

interface InputSectionProps {
	chatState: ChatState
	messageHandlers: MessageHandlers
	scrollBehavior: ScrollBehavior
	placeholderText: string
	shouldDisableFilesAndImages: boolean
	selectFilesAndImages: () => Promise<void>
}

/**
 * Input section including quoted message preview and chat text area
 */
export const InputSection: React.FC<InputSectionProps> = ({
	chatState,
	messageHandlers,
	scrollBehavior,
	placeholderText,
	shouldDisableFilesAndImages,
	selectFilesAndImages,
}) => {
	const {
		activeQuote,
		setActiveQuote,
		isTextAreaFocused,
		inputValue,
		setInputValue,
		sendingDisabled,
		selectedImages,
		setSelectedImages,
		selectedFiles,
		setSelectedFiles,
		textAreaRef,
		handleFocusChange,
	} = chatState

	const { isAtBottom, scrollToBottomAuto } = scrollBehavior
	const { voiceSttEnabled } = useExtensionState()

	const handleTranscription = useCallback(
		(text: string) => {
			setInputValue((prev) => (prev ? prev + " " + text : text))
		},
		[setInputValue],
	)

	return (
		<>
			{activeQuote && (
				<div style={{ marginBottom: "-12px", marginTop: "10px" }}>
					<QuotedMessagePreview
						isFocused={isTextAreaFocused}
						onDismiss={() => setActiveQuote(null)}
						text={activeQuote}
					/>
				</div>
			)}

			<ChatTextArea
				activeQuote={activeQuote}
				inputValue={inputValue}
				onFocusChange={handleFocusChange}
				onHeightChange={() => {
					if (isAtBottom) {
						scrollToBottomAuto()
					}
				}}
				onSelectFilesAndImages={selectFilesAndImages}
				onSend={() => messageHandlers.handleSendMessage(inputValue, selectedImages, selectedFiles)}
				onTranscription={voiceSttEnabled ? handleTranscription : undefined}
				placeholderText={placeholderText}
				ref={textAreaRef}
				selectedFiles={selectedFiles}
				selectedImages={selectedImages}
				sendingDisabled={sendingDisabled}
				setInputValue={setInputValue}
				setSelectedFiles={setSelectedFiles}
				setSelectedImages={setSelectedImages}
				shouldDisableFilesAndImages={shouldDisableFilesAndImages}
			/>
		</>
	)
}
