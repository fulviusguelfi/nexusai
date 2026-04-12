import React, { useCallback, useRef } from "react"
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
	const { voiceSttEnabled, voiceMetadataEnabled } = useExtensionState()

	// Stores metadata to inject at send time — keeps textarea clean
	const pendingVoiceMetadataRef = useRef<string>("")

	// Always-current mirror of inputValue — avoids stale closure in handleTranscription
	const inputValueRef = useRef(inputValue)
	inputValueRef.current = inputValue

	// Track text surrounding cursor at the moment recording starts
	const voiceTextBeforeRef = useRef<string>("")
	const voiceTextAfterRef = useRef<string>("")
	const voiceSessionActiveRef = useRef(false)
	const prevPartialRef = useRef<string>("")
	const lastVoiceLengthRef = useRef<number>(-1) // value length after last voice setInputValue; -1 = no update yet
	// Block late STT results that arrive after the user has already sent the message
	const postSendBlockRef = useRef(false)

	const handleTranscription = useCallback(
		(text: string, language?: string, isPartial?: boolean) => {
			// If the user already sent, ignore any late STT results from the previous session
			if (postSendBlockRef.current) {
				// Only unblock when a truly new session starts (first partial of a new recording)
				if (isPartial && !voiceSessionActiveRef.current) {
					postSendBlockRef.current = false
				} else {
					return
				}
			}

			const currentCursor = textAreaRef.current?.selectionStart ?? -1

			if (!voiceSessionActiveRef.current) {
				// First partial of new session: anchor at actual cursor position
				const base = inputValueRef.current
				const pos = currentCursor >= 0 ? currentCursor : base.length
				voiceTextBeforeRef.current = base.slice(0, pos)
				voiceTextAfterRef.current = base.slice(pos)
				voiceSessionActiveRef.current = true
				prevPartialRef.current = ""
				lastVoiceLengthRef.current = -1
			}

			if (!isPartial) {
				if (voiceMetadataEnabled) {
					const langNote = language ? `, spoken in ${language}` : ""
					pendingVoiceMetadataRef.current = `[voice input${langNote} — respond naturally as spoken]\n`
				} else {
					pendingVoiceMetadataRef.current = ""
				}
				voiceSessionActiveRef.current = false
				prevPartialRef.current = ""
				lastVoiceLengthRef.current = -1
			} else {
				prevPartialRef.current = text
			}

			// Add spaces at join points to avoid words running together (e.g. "podevai" → "pode vai")
			const before = voiceTextBeforeRef.current
			const after = voiceTextAfterRef.current
			const spaceBefore = before.length > 0 && text.length > 0 && !before.endsWith(" ") && !text.startsWith(" ") ? " " : ""
			const spaceAfter = after.length > 0 && text.length > 0 && !text.endsWith(" ") && !after.startsWith(" ") ? " " : ""
			const newValue = before + spaceBefore + text + spaceAfter + after
			lastVoiceLengthRef.current = newValue.length // React will put cursor here after setInputValue
			setInputValue(newValue)
		},
		[setInputValue, voiceMetadataEnabled],
	)

	const handleSendWithVoiceMetadata = useCallback(() => {
		const meta = pendingVoiceMetadataRef.current
		pendingVoiceMetadataRef.current = ""
		const textToSend = meta ? `${meta}${inputValue}` : inputValue
		// Block any late STT results from the current/previous session that arrive after send
		postSendBlockRef.current = true
		voiceSessionActiveRef.current = false
		messageHandlers.handleSendMessage(textToSend, selectedImages, selectedFiles)
	}, [inputValue, selectedImages, selectedFiles, messageHandlers])

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
				onSend={handleSendWithVoiceMetadata}
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
