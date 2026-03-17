import { useEffect } from "react"
import { useExtensionState } from "@/context/ExtensionStateContext"

/**
 * Listens for `voice_audio_play` messages from the extension host and plays
 * the WAV audio through the configured output device using the Web Audio API.
 */
export function useVoiceAudioPlayer() {
	const { voiceOutputDeviceId } = useExtensionState()

	useEffect(() => {
		const handler = async (event: MessageEvent) => {
			if (event.data?.type !== "voice_audio_play") return
			const wavBase64: string | undefined = event.data.voice_audio_play?.wavBase64
			if (!wavBase64) return

			try {
				const binaryStr = atob(wavBase64)
				const bytes = new Uint8Array(binaryStr.length)
				for (let i = 0; i < binaryStr.length; i++) {
					bytes[i] = binaryStr.charCodeAt(i)
				}

				const audioCtx = new AudioContext()
				if (voiceOutputDeviceId && typeof (audioCtx as any).setSinkId === "function") {
					await (audioCtx as any).setSinkId(voiceOutputDeviceId)
				}

				const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer)
				const source = audioCtx.createBufferSource()
				source.buffer = audioBuffer
				source.connect(audioCtx.destination)
				source.onended = () => audioCtx.close()
				source.start(0)
			} catch (err) {
				console.error("[VoiceAudioPlayer] playback error:", err)
			}
		}

		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [voiceOutputDeviceId])
}
