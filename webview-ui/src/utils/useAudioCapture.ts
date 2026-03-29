/**
 * React hook for microphone audio capture
 * Provides permission state management and recording control
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { checkMicrophonePermission, enumerateAudioDevices, WebAudioCapture } from "@/services/audio/WebAudioCapture"

export type PermissionState = "granted" | "denied" | "prompt" | "checking" | "unknown"

export interface AudioDevice {
	deviceId: string
	label: string
	kind: "audioinput" | "audiooutput"
}

export interface UseAudioCaptureOptions {
	sampleRate?: number
	maxDuration?: number
	autoRequestPermission?: boolean
}

export interface UseAudioCaptureReturn {
	// State
	isRecording: boolean
	permissionState: PermissionState
	error: Error | null
	recordingDuration: number // seconds

	// Controls
	startRecording: () => Promise<void>
	stopRecording: () => Float32Array | null
	requestPermission: () => Promise<void>
	clearError: () => void

	// Info
	audioDevices: AudioDevice[]
	recordingProgress: number // 0-1
}

export function useAudioCapture(options: UseAudioCaptureOptions = {}): UseAudioCaptureReturn {
	const { sampleRate = 16000, maxDuration, autoRequestPermission = true } = options

	const captureRef = useRef<WebAudioCapture | null>(null)
	const recordingStartRef = useRef<number>(0)
	const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

	const [isRecording, setIsRecording] = useState(false)
	const [permissionState, setPermissionState] = useState<PermissionState>("checking")
	const [error, setError] = useState<Error | null>(null)
	const [recordingDuration, setRecordingDuration] = useState(0)
	const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([])
	const [recordingProgress, setRecordingProgress] = useState(0)

	// Initialize audio context and check permissions
	useEffect(() => {
		const init = async () => {
			try {
				const permission = await checkMicrophonePermission()
				setPermissionState(permission)

				// Load audio devices
				const devices = await enumerateAudioDevices()
				setAudioDevices(devices)
			} catch (err) {
				setPermissionState("unknown")
			}
		}

		init()
	}, [])

	// Auto-request permission if allowed
	useEffect(() => {
		if (autoRequestPermission && permissionState === "prompt") {
			requestPermission().catch(() => {})
		}
	}, [permissionState, autoRequestPermission])

	const requestPermission = useCallback(async () => {
		try {
			setError(null)
			if (!captureRef.current) {
				captureRef.current = new WebAudioCapture()
			}

			await captureRef.current.startCapture({
				sampleRate,
				onPermissionDenied: () => {
					setPermissionState("denied")
					setError(new Error("Microphone permission denied"))
				},
			})

			// Immediately stop to just test permission
			captureRef.current.stopCapture()

			setPermissionState("granted")
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			setError(new Error(message))
			setPermissionState("denied")
		}
	}, [sampleRate])

	const startRecording = useCallback(async () => {
		try {
			setError(null)
			setRecordingDuration(0)
			setRecordingProgress(0)

			if (!captureRef.current) {
				captureRef.current = new WebAudioCapture()
			}

			let chunksSinceUpdate = 0
			recordingStartRef.current = Date.now()

			await captureRef.current.startCapture({
				sampleRate,
				maxDuration,
				onChunk: () => {
					// Throttle progress updates (every 10 chunks)
					chunksSinceUpdate++
					if (chunksSinceUpdate > 10) {
						const elapsed = (Date.now() - recordingStartRef.current) / 1000
						setRecordingDuration(elapsed)

						if (maxDuration) {
							setRecordingProgress(Math.min(1, elapsed / maxDuration))
						}
						chunksSinceUpdate = 0
					}
				},
				onPermissionDenied: () => {
					setPermissionState("denied")
					setError(new Error("Microphone permission denied"))
				},
				onError: (err: unknown) => {
					setError(err instanceof Error ? err : new Error(String(err)))
				},
			})

			setIsRecording(true)

			// Update recording duration periodically
			recordingTimerRef.current = setInterval(() => {
				const elapsed = (Date.now() - recordingStartRef.current) / 1000
				setRecordingDuration(elapsed)

				if (maxDuration && elapsed >= maxDuration) {
					stopRecording()
				}
			}, 100)
		} catch (err) {
			setError(err instanceof Error ? err : new Error(String(err)))
			setIsRecording(false)
		}
	}, [sampleRate, maxDuration])

	const stopRecording = useCallback((): Float32Array | null => {
		try {
			setIsRecording(false)

			if (recordingTimerRef.current) {
				clearInterval(recordingTimerRef.current)
				recordingTimerRef.current = null
			}

			if (!captureRef.current) {
				return null
			}

			const audio = captureRef.current.stopCapture()
			setRecordingDuration(0)
			setRecordingProgress(0)

			return audio
		} catch (err) {
			setError(err instanceof Error ? err : new Error(String(err)))
			return null
		}
	}, [])

	const clearError = useCallback(() => {
		setError(null)
	}, [])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (recordingTimerRef.current) {
				clearInterval(recordingTimerRef.current)
			}
			captureRef.current?.dispose()
		}
	}, [])

	return {
		isRecording,
		permissionState,
		error,
		recordingDuration,
		startRecording,
		stopRecording,
		requestPermission,
		clearError,
		audioDevices,
		recordingProgress,
	}
}
