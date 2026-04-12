/**
 * AudioPlayer — Inline TTS audio player widget.
 *
 * Listens for `voice_audio_play` messages and shows a compact player
 * (play/pause + progress bar + duration) below the voice recorder button.
 * Auto-plays on arrival; the user can pause/resume. Disappears when done.
 */
import React, { useCallback, useEffect, useRef, useState } from "react"
import { useExtensionState } from "@/context/ExtensionStateContext"

function formatSeconds(sec: number): string {
	const m = Math.floor(sec / 60)
	const s = Math.floor(sec % 60)
	return `${m}:${s.toString().padStart(2, "0")}`
}

/**
 * Resolves the real WebAudio deviceId for an output device.
 * See useVoiceAudioPlayer.ts for the full explanation.
 */
async function resolveOutputDeviceId(labelOrId: string): Promise<string> {
	if (!navigator.mediaDevices?.enumerateDevices) return labelOrId
	try {
		const devices = await navigator.mediaDevices.enumerateDevices()
		const outputs = devices.filter((d) => d.kind === "audiooutput")
		const byId = outputs.find((d) => d.deviceId === labelOrId && d.deviceId !== "")
		if (byId) return byId.deviceId
		const byLabel = outputs.find((d) => d.label === labelOrId)
		if (byLabel) {
			console.log(`[AudioPlayer] Resolved output device "${labelOrId}" → deviceId="${byLabel.deviceId}"`)
			return byLabel.deviceId
		}
		console.warn(`[AudioPlayer] Output device not found: "${labelOrId}" — falling back to default`)
	} catch (err) {
		console.warn("[AudioPlayer] enumerateDevices failed:", err)
	}
	return labelOrId
}

const AudioPlayer: React.FC = () => {
	const { voiceOutputDeviceId } = useExtensionState()

	const audioRef = useRef<HTMLAudioElement | null>(null)
	const blobUrlRef = useRef<string | null>(null)

	const [isPlaying, setIsPlaying] = useState(false)
	const [currentTime, setCurrentTime] = useState(0)
	const [duration, setDuration] = useState(0)
	const [visible, setVisible] = useState(false)

	const cleanup = useCallback(() => {
		if (audioRef.current) {
			audioRef.current.pause()
			audioRef.current.src = ""
			audioRef.current = null
		}
		if (blobUrlRef.current) {
			URL.revokeObjectURL(blobUrlRef.current)
			blobUrlRef.current = null
		}
	}, [])

	// Listen for incoming TTS audio
	useEffect(() => {
		const handler = async (event: MessageEvent) => {
			if (event.data?.type !== "voice_audio_play") return
			const wavBase64: string | undefined = event.data.voice_audio_play?.wavBase64
			if (!wavBase64) return

			cleanup()

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

				// Device routing
				const audioWithSink = audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }
				if (voiceOutputDeviceId && typeof audioWithSink.setSinkId === "function") {
					try {
						const resolvedId = await resolveOutputDeviceId(voiceOutputDeviceId)
						console.log(`[AudioPlayer] setSinkId("${resolvedId}")`)
						await audioWithSink.setSinkId(resolvedId)
					} catch {
						// ignore — default output
					}
				}

				audio.onloadedmetadata = () => setDuration(audio.duration)
				audio.ontimeupdate = () => setCurrentTime(audio.currentTime)
				audio.onplay = () => setIsPlaying(true)
				audio.onpause = () => setIsPlaying(false)
				audio.onended = () => {
					setIsPlaying(false)
					setCurrentTime(0)
					// Hide player 2s after audio ends
					setTimeout(() => {
						setVisible(false)
						setDuration(0)
					}, 2000)
					if (blobUrlRef.current === blobUrl) {
						URL.revokeObjectURL(blobUrl)
						blobUrlRef.current = null
					}
				}

				setVisible(true)
				setCurrentTime(0)
				await audio.play()
			} catch (err) {
				console.error("[AudioPlayer] playback error:", err)
				cleanup()
			}
		}

		window.addEventListener("message", handler)
		return () => {
			window.removeEventListener("message", handler)
			cleanup()
		}
	}, [voiceOutputDeviceId, cleanup])

	const handlePlayPause = useCallback(() => {
		const audio = audioRef.current
		if (!audio) return
		if (isPlaying) {
			audio.pause()
		} else {
			void audio.play()
		}
	}, [isPlaying])

	const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const audio = audioRef.current
		if (!audio) return
		const t = Number.parseFloat(e.target.value)
		audio.currentTime = t
		setCurrentTime(t)
	}, [])

	if (!visible) return null

	const progress = duration > 0 ? (currentTime / duration) * 100 : 0

	return (
		<div
			aria-label="TTS audio player"
			className="flex items-center gap-2 px-2 py-1 rounded bg-vscode-editor-background border border-vscode-focusBorder/30 min-w-[160px]">
			<button
				aria-label={isPlaying ? "Pause" : "Play"}
				className={`codicon ${isPlaying ? "codicon-debug-pause" : "codicon-play"} p-0 m-0 text-[13px] cursor-pointer opacity-80 hover:opacity-100 transition-opacity`}
				onClick={handlePlayPause}
				title={isPlaying ? "Pause" : "Play"}
			/>
			<div className="flex-1 flex items-center gap-1">
				<input
					aria-label="Seek"
					className="w-full h-1 accent-blue-400 cursor-pointer"
					max={duration}
					min={0}
					onChange={handleSeek}
					step={0.1}
					style={{ accentColor: "var(--vscode-focusBorder, #007acc)" }}
					type="range"
					value={currentTime}
				/>
			</div>
			<span className="text-xs tabular-nums font-mono opacity-60 whitespace-nowrap">
				{formatSeconds(currentTime)}/{formatSeconds(duration)}
			</span>
		</div>
	)
}

export default AudioPlayer
