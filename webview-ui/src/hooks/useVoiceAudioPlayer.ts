import { useEffect, useRef } from "react"
import { useExtensionState } from "@/context/ExtensionStateContext"

/**
 * Listens for `voice_audio_play` messages from the extension host and plays
 * the WAV audio through the configured output device.
 *
 * Uses HTMLAudioElement + Blob URL instead of AudioContext to avoid VS Code
 * webview autoplay restrictions (AudioContext.resume() requires a user gesture
 * in the same event tick, but TTS fires asynchronously after LLM response).
 * VS Code 1.75+ explicitly supports <audio> element playback in webviews.
 *
 * If a new audio message arrives while one is playing, the current one is stopped.
 */
export function useVoiceAudioPlayer() {
	const { voiceOutputDeviceId } = useExtensionState()
	const audioRef = useRef<HTMLAudioElement | null>(null)
	const blobUrlRef = useRef<string | null>(null)

	useEffect(() => {
		const stopCurrent = () => {
			if (audioRef.current) {
				audioRef.current.pause()
				audioRef.current.src = ""
				audioRef.current = null
			}
			if (blobUrlRef.current) {
				URL.revokeObjectURL(blobUrlRef.current)
				blobUrlRef.current = null
			}
		}

		const handler = async (event: MessageEvent) => {
			if (event.data?.type !== "voice_audio_play") return
			const wavBase64: string | undefined = event.data.voice_audio_play?.wavBase64
			if (!wavBase64) return

			stopCurrent()

			try {
				const binaryStr = atob(wavBase64)
				const bytes = new Uint8Array(binaryStr.length)
				for (let i = 0; i < binaryStr.length; i++) {
					bytes[i] = binaryStr.charCodeAt(i)
				}

				const blob = new Blob([bytes], { type: "audio/wav" })
				const blobUrl = URL.createObjectURL(blob)
				blobUrlRef.current = blobUrl

				const audio = new Audio(blobUrl)
				audioRef.current = audio

				const audioWithSink = audio as HTMLAudioElement & { setSinkId?: (sinkId: string) => Promise<void> }
				if (voiceOutputDeviceId && typeof audioWithSink.setSinkId === "function") {
					try {
						await audioWithSink.setSinkId(voiceOutputDeviceId)
					} catch (sinkErr) {
						console.warn("[VoiceAudioPlayer] Selected output device unavailable, using default:", sinkErr)
					}
				}

				audio.onended = () => {
					if (blobUrlRef.current === blobUrl) {
						URL.revokeObjectURL(blobUrl)
						blobUrlRef.current = null
					}
					if (audioRef.current === audio) {
						audioRef.current = null
					}
				}

				await audio.play()
			} catch (err) {
				console.error("[VoiceAudioPlayer] playback error:", err)
				stopCurrent()
			}
		}

		window.addEventListener("message", handler)
		return () => {
			window.removeEventListener("message", handler)
			stopCurrent()
		}
	}, [voiceOutputDeviceId])
}
