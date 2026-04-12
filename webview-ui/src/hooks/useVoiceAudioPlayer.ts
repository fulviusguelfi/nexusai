import { useEffect, useRef } from "react"
import { PLATFORM_CONFIG } from "@/config/platform.config"
import { useExtensionState } from "@/context/ExtensionStateContext"

/**
 * Resolves the real WebAudio deviceId for an output device.
 *
 * In VS Code webview, `getSinkId` expects the deviceId from `enumerateDevices()`
 * (a hex/UUID string). However, we store the device *label* (from the host-side
 * PowerShell enumeration) because `enumerateDevices()` returns empty deviceIds
 * without prior getUserMedia permission.
 *
 * Once the user has granted microphone access (STT), `enumerateDevices()` returns
 * real deviceIds — so we match by label to get the actual deviceId for setSinkId.
 */
async function resolveOutputDeviceId(labelOrId: string): Promise<string> {
	if (!navigator.mediaDevices?.enumerateDevices) return labelOrId
	try {
		const devices = await navigator.mediaDevices.enumerateDevices()
		const outputs = devices.filter((d) => d.kind === "audiooutput")
		// Exact deviceId match (future-proof if caller stores real ID)
		const byId = outputs.find((d) => d.deviceId === labelOrId && d.deviceId !== "")
		if (byId) return byId.deviceId
		// Label match — our stored format is the PowerShell device name
		const byLabel = outputs.find((d) => d.label === labelOrId)
		if (byLabel) {
			console.log(`[VoiceAudioPlayer] Resolved output device "${labelOrId}" → deviceId="${byLabel.deviceId}"`)
			return byLabel.deviceId
		}
		console.warn(`[VoiceAudioPlayer] Output device not found: "${labelOrId}" — falling back to default`)
	} catch (err) {
		console.warn("[VoiceAudioPlayer] enumerateDevices failed:", err)
	}
	return labelOrId
}

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
			const sentenceIndex: number | undefined = event.data.voice_audio_play?.sentenceIndex
			if (!wavBase64) return

			stopCurrent()

			try {
				const binaryStr = atob(wavBase64)
				const bytes = new Uint8Array(binaryStr.length)
				for (let i = 0; i < binaryStr.length; i++) {
					bytes[i] = binaryStr.charCodeAt(i)
				}

				const blob = new Blob([bytes], { type: "audio/mpeg" })
				const blobUrl = URL.createObjectURL(blob)
				blobUrlRef.current = blobUrl

				const audio = new Audio(blobUrl)
				audioRef.current = audio

				const audioWithSink = audio as HTMLAudioElement & { setSinkId?: (sinkId: string) => Promise<void> }
				if (voiceOutputDeviceId && typeof audioWithSink.setSinkId === "function") {
					try {
						const resolvedId = await resolveOutputDeviceId(voiceOutputDeviceId)
						console.log(`[VoiceAudioPlayer] setSinkId("${resolvedId}")`)
						await audioWithSink.setSinkId(resolvedId)
					} catch (sinkErr) {
						console.warn("[VoiceAudioPlayer] Selected output device unavailable, using default:", sinkErr)
					}
				} else {
					console.log("[VoiceAudioPlayer] No output device set — using system default")
				}

				audio.onended = () => {
					if (blobUrlRef.current === blobUrl) {
						URL.revokeObjectURL(blobUrl)
						blobUrlRef.current = null
					}
					if (audioRef.current === audio) {
						audioRef.current = null
					}
					// Notify host that this sentence finished playing
					if (sentenceIndex !== undefined) {
						PLATFORM_CONFIG.postMessage({ type: "voice_sentence_ended", voice_sentence_ended: { sentenceIndex } })
					}
				}

				await audio.play()
			} catch (err) {
				console.error("[VoiceAudioPlayer] playback error:", err)
				stopCurrent()
				// Notify host even on failure so TTS pipeline does not stall
				if (sentenceIndex !== undefined) {
					PLATFORM_CONFIG.postMessage({ type: "voice_sentence_ended", voice_sentence_ended: { sentenceIndex } })
				}
			}
		}

		window.addEventListener("message", handler)
		return () => {
			window.removeEventListener("message", handler)
			stopCurrent()
		}
	}, [voiceOutputDeviceId])
}
