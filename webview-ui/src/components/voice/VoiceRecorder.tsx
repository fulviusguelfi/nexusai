/**
 * VoiceRecorder — push-to-talk microphone button.
 *
 * Flow:
 *   1. User holds the button → starts MediaRecorder.
 *   2. On release → collects recorded chunks → resamples to 16kHz mono Float32
 *      via OfflineAudioContext → posts `voice_float32_audio` message to extension host.
 *   3. Extension host runs Whisper → posts `voice_transcription` back.
 *   4. `onTranscription` callback fires → caller injects text into the input field.
 *
 * The component subscribes to `window.addEventListener("message")` to receive
 * the transcription result from the extension host.
 */

import React, { useCallback, useEffect, useRef, useState } from "react"
import { PLATFORM_CONFIG } from "@/config/platform.config"
import { useExtensionState } from "@/context/ExtensionStateContext"

interface Props {
	/** Called with the transcribed text when STT completes. */
	onTranscription: (text: string) => void
	disabled?: boolean
}

const SAMPLE_RATE_HZ = 16_000
const HOLD_MIN_MS = 300 // ignore taps shorter than this

const VoiceRecorder: React.FC<Props> = ({ onTranscription, disabled }) => {
	const { voiceSttEnabled, voiceInputDeviceId } = useExtensionState()

	const [isRecording, setIsRecording] = useState(false)
	const [isProcessing, setIsProcessing] = useState(false)
	const [startError, setStartError] = useState<string | null>(null)

	const recorderRef = useRef<MediaRecorder | null>(null)
	const chunksRef = useRef<Blob[]>([])
	const pressStartMs = useRef<number>(0)
	const streamRef = useRef<MediaStream | null>(null)
	const isPressingRef = useRef(false)
	const pendingStopRef = useRef(false)

	// Listen for transcription results from the extension host
	useEffect(() => {
		const handler = (event: MessageEvent) => {
			if (event.data?.type === "voice_transcription") {
				const text: string = event.data.voice_transcription?.text ?? ""
				setIsProcessing(false)
				if (text.trim()) {
					onTranscription(text)
				}
			}
		}
		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [onTranscription])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			streamRef.current?.getTracks().forEach((t) => t.stop())
		}
	}, [])

	const stopAndTranscribe = useCallback(async () => {
		const recorder = recorderRef.current
		if (!recorder || recorder.state === "inactive") return

		recorder.stop()
	}, [])

	const endPress = useCallback(() => {
		isPressingRef.current = false
		const recorder = recorderRef.current
		if (recorder && recorder.state !== "inactive") {
			void stopAndTranscribe()
			return
		}

		// If release happens before recorder initialization completes
		// (for example while permission prompt is visible), stop as soon as start finishes.
		pendingStopRef.current = true
	}, [stopAndTranscribe])

	const startRecording = useCallback(async () => {
		if (disabled || !voiceSttEnabled || isProcessing) return
		isPressingRef.current = true
		pendingStopRef.current = false

		try {
			let stream: MediaStream
			if (voiceInputDeviceId) {
				try {
					stream = await navigator.mediaDevices.getUserMedia({
						audio: { deviceId: { exact: voiceInputDeviceId } },
						video: false,
					})
				} catch {
					// Selected device may no longer exist. Fall back to default input device.
					stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
				}
			} else {
				stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
			}

			streamRef.current = stream
			chunksRef.current = []
			pressStartMs.current = Date.now()

			const recorder = new MediaRecorder(stream)
			recorderRef.current = recorder

			recorder.ondataavailable = (e) => {
				if (e.data.size > 0) chunksRef.current.push(e.data)
			}

			recorder.onstop = async () => {
				stream.getTracks().forEach((t) => t.stop())
				streamRef.current = null

				const elapsed = Date.now() - pressStartMs.current
				if (elapsed < HOLD_MIN_MS || chunksRef.current.length === 0) {
					setIsRecording(false)
					return
				}

				setIsRecording(false)
				setIsProcessing(true)

				try {
					const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
					const arrayBuffer = await blob.arrayBuffer()
					const audioCtx = new AudioContext()
					const decoded = await audioCtx.decodeAudioData(arrayBuffer)
					await audioCtx.close()

					// Resample to 16kHz mono using OfflineAudioContext
					const offlineCtx = new OfflineAudioContext(1, Math.ceil(decoded.duration * SAMPLE_RATE_HZ), SAMPLE_RATE_HZ)
					const source = offlineCtx.createBufferSource()
					source.buffer = decoded
					source.connect(offlineCtx.destination)
					source.start()
					const resampled = await offlineCtx.startRendering()
					const float32 = resampled.getChannelData(0)

					// Transfer the buffer for zero-copy (clone so Float32Array remains valid)
					const transferBuffer = float32.buffer.slice(0) as ArrayBuffer
					PLATFORM_CONFIG.postMessage({
						type: "voice_float32_audio",
						voice_float32_audio: {
							buffer: transferBuffer,
							sampleRate: SAMPLE_RATE_HZ,
						},
					})
				} catch (err) {
					console.error("[VoiceRecorder] Processing error:", err)
					setIsProcessing(false)
				}
			}

			recorder.start()
			setIsRecording(true)
			setStartError(null)

			if (!isPressingRef.current || pendingStopRef.current) {
				pendingStopRef.current = false
				void stopAndTranscribe()
			}
		} catch (err: unknown) {
			console.error("[VoiceRecorder] Could not start recording:", err)
			isPressingRef.current = false
			const name = err instanceof DOMException ? err.name : ""
			const msg =
				name === "NotAllowedError"
					? "Mic access denied – enable Windows microphone privacy toggles, then reload VS Code window"
					: name === "NotFoundError"
						? "No microphone found"
						: !navigator.mediaDevices
							? "Microphone API unavailable in this context"
							: "Could not access microphone"
			setStartError(msg)
			setTimeout(() => setStartError(null), 6_000)
		}
	}, [disabled, voiceSttEnabled, isProcessing, voiceInputDeviceId, stopAndTranscribe])

	if (!voiceSttEnabled) return null

	const title = startError
		? startError
		: isProcessing
			? "Transcribing…"
			: isRecording
				? "Recording… (release to send)"
				: "Hold to record voice"

	return (
		<button
			aria-label={title}
			className={[
				"codicon p-0 m-0 flex items-center justify-center",
				startError
					? "codicon-warning text-error"
					: isRecording
						? "codicon-record-keys text-error"
						: isProcessing
							? "codicon-loading animate-spin text-vscode-descriptionForeground"
							: "codicon-mic text-vscode-descriptionForeground hover:text-vscode-foreground",
				disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
			]
				.filter(Boolean)
				.join(" ")}
			disabled={disabled || isProcessing}
			onMouseDown={startRecording}
			onMouseLeave={endPress}
			onMouseUp={endPress}
			onTouchCancel={endPress}
			onTouchEnd={endPress}
			onTouchStart={startRecording}
			style={{ fontSize: 14, width: 20, height: 20, background: "none", border: "none" }}
			title={title}
		/>
	)
}

export default VoiceRecorder
