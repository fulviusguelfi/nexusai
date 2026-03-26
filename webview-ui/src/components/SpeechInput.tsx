/**
 * Speech Input Component - Record and transcribe voice input in webview
 * Provides UI for microphone recording with real-time feedback
 */

import React, { useCallback, useEffect, useRef, useState } from "react"
import { useAudioCapture } from "@/utils/useAudioCapture"
import styles from "./SpeechInput.module.css"

export interface SpeechInputProps {
	onTranscribe?: (text: string) => void
	disabled?: boolean
	maxDuration?: number
	placeholder?: string
}

export const SpeechInput: React.FC<SpeechInputProps> = ({
	onTranscribe,
	disabled = false,
	maxDuration = 30,
	placeholder = "Click and speak...",
}) => {
	const [transcribedText, setTranscribedText] = useState("")
	const [isTranscribing, setIsTranscribing] = useState(false)
	const [localError, setLocalError] = useState<string | null>(null)

	const {
		isRecording,
		permissionState,
		error,
		recordingDuration,
		recordingProgress,
		startRecording,
		stopRecording,
		requestPermission,
		clearError,
		audioDevices,
	} = useAudioCapture({
		sampleRate: 16000,
		maxDuration,
		autoRequestPermission: false,
	})

	const audioRef = useRef<Float32Array | null>(null)

	// Combine local and hook errors
	useEffect(() => {
		if (error) {
			setLocalError(error.message)
		}
	}, [error])

	const handleRequestPermission = useCallback(async () => {
		try {
			setLocalError(null)
			await requestPermission()
		} catch (err) {
			setLocalError(err instanceof Error ? err.message : "Failed to request permission")
		}
	}, [requestPermission])

	const handleStartRecording = useCallback(async () => {
		try {
			setLocalError(null)
			setTranscribedText("")
			await startRecording()
		} catch (err) {
			setLocalError(err instanceof Error ? err.message : "Failed to start recording")
		}
	}, [startRecording])

	const handleStopRecording = useCallback(async () => {
		try {
			setLocalError(null)
			const audio = stopRecording()

			if (!audio || audio.length === 0) {
				setLocalError("No audio recorded")
				return
			}

			audioRef.current = audio

			// TODO: Send to backend for transcription via RPC
			// const result = await ExtensionStateContext.voiceService.transcribe(audio)
			// setTranscribedText(result)
			// onTranscribe?.(result)

			// Placeholder: show recording summary
			const duration = (audio.length / 16000).toFixed(1)
			setTranscribedText(`[Recorded ${duration}s of audio]`)
		} catch (err) {
			setLocalError(err instanceof Error ? err.message : "Failed to stop recording")
		}
	}, [stopRecording, onTranscribe])

	const isPermissionGranted = permissionState === "granted"
	const isPermissionDenied = permissionState === "denied"
	const isPermissionPrompt = permissionState === "prompt" || permissionState === "checking"

	// Determine button state
	let buttonState: "idle" | "recording" | "disabled" = "idle"
	if (disabled || isPermissionDenied) {
		buttonState = "disabled"
	} else if (isRecording) {
		buttonState = "recording"
	}

	const displayDuration = Math.floor(recordingDuration)
	const progressPercent = Math.round(recordingProgress * 100)

	return (
		<div className={styles.container}>
			{/* Permission Prompt */}
			{isPermissionPrompt && (
				<div className={styles.permissionPrompt}>
					<span className={styles.micIcon}>🎤</span>
					<p>Enable microphone for voice input</p>
					<button className={styles.permissionButton} onClick={handleRequestPermission}>
						Enable Microphone
					</button>
				</div>
			)}

			{/* Recording Interface */}
			{isPermissionGranted && (
				<div className={styles.recordingInterface}>
					{/* Record Button */}
					<button
						className={`${styles.recordButton} ${isRecording ? styles.recording : ""}`}
						disabled={buttonState === "disabled"}
						onClick={isRecording ? handleStopRecording : handleStartRecording}
						title={isRecording ? "Click to stop recording" : "Click to start recording"}>
						{isRecording ? (
							<>
								<span className={styles.pulse} />
								<span className={styles.buttonText}>Stop</span>
							</>
						) : (
							<>
								<span className={styles.micIcon}>🎤</span>
								<span className={styles.buttonText}>Record</span>
							</>
						)}
					</button>

					{/* Recording Status */}
					{isRecording && (
						<div className={styles.recordingStatus}>
							<div className={styles.timer}>{displayDuration}s</div>
							{maxDuration && (
								<div className={styles.progressBar}>
									<div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
								</div>
							)}
						</div>
					)}

					{/* Transcribed Text Display */}
					{transcribedText && (
						<div className={styles.transcription}>
							<p className={styles.transcriptionText}>{transcribedText}</p>
						</div>
					)}

					{/* Audio Devices Info */}
					{audioDevices.length > 0 && (
						<div className={styles.deviceInfo}>
							<small>Using: {audioDevices[0]?.label || "Default microphone"}</small>
						</div>
					)}
				</div>
			)}

			{/* Permission Denied */}
			{isPermissionDenied && (
				<div className={styles.permissionDenied}>
					<p>❌ Microphone permission denied</p>
					<small>Enable microphone in browser settings to use voice input</small>
				</div>
			)}

			{/* Error Display */}
			{localError && (
				<div className={styles.errorMessage}>
					<p>{localError}</p>
					<button className={styles.closeError} onClick={clearError}>
						×
					</button>
				</div>
			)}
		</div>
	)
}
