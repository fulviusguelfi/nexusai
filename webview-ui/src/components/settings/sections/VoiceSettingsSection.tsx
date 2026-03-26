import { VoiceServiceClient } from "@services/grpc-client"
import React, { useCallback, useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useExtensionState } from "@/context/ExtensionStateContext"
import Section from "../Section"
import { updateSetting } from "../utils/settingsHandlers"

interface Props {
	renderSectionHeader: (tabId: string) => JSX.Element | null
}

interface AudioDevice {
	deviceId: string
	label: string
}

const VOICE_OPTIONS = [
	{ value: "en_US-lessac-medium", label: "English (US) - Female (Lessac)" },
	{ value: "en_US-ryan-medium", label: "English (US) - Male (Ryan)" },
	{ value: "pt_BR-faber-medium", label: "Portuguese (BR) - Female (Faber)" },
	{ value: "pt_BR-cadu-medium", label: "Portuguese (BR) - Male (Cadu)" },
] as const

const VoiceSettingsSection: React.FC<Props> = ({ renderSectionHeader }) => {
	const { voiceTtsEnabled, voiceSttEnabled, voiceInputDeviceId, voicePiperVoice, voiceSilenceThresholdMs } = useExtensionState()

	const [inputDevices, setInputDevices] = useState<AudioDevice[]>([])
	const [isDetectingDevices, setIsDetectingDevices] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Enumerate devices via backend RPC
	const detectRealDevices = useCallback(async () => {
		setIsDetectingDevices(true)
		setError(null)

		try {
			console.log("[Voice] Calling backend enumerateAudioDevices RPC...")
			const resp = await VoiceServiceClient.enumerateAudioDevices({})
			console.log("[Voice] Backend response:", resp)

			if (resp.error) {
				setError(resp.error)
				console.error("[Voice] Backend error:", resp.error)
				return
			}

			const devices: AudioDevice[] = (resp.inputDevices || []).map((d: any) => ({
				deviceId: d.deviceId || "",
				label: d.label || d.deviceId || "(unknown)",
			}))

			console.log("[Voice] Mapped devices:", devices)
			setInputDevices(devices)
			setError(null)
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			console.error("[Voice] Detection error:", msg)
			setError(msg)
		} finally {
			setIsDetectingDevices(false)
		}
	}, [])

	// Load devices on mount (browser-based enumeration as fallback)
	const loadDevicesFallback = useCallback(async () => {
		const mediaDevices = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined
		if (!mediaDevices?.enumerateDevices) {
			console.warn("[Voice] browser enumerateDevices not available")
			return
		}

		try {
			const devices = await mediaDevices.enumerateDevices()
			const inputs: AudioDevice[] = []
			devices.forEach((d) => {
				if (d.kind === "audioinput" && d.deviceId) {
					inputs.push({
						deviceId: d.deviceId,
						label: d.label || d.deviceId,
					})
				}
			})
			console.log("[Voice] Browser enumeration found:", inputs)
			if (inputs.length === 0) {
				// No real devices yet - show detect button
				setInputDevices([])
			} else {
				setInputDevices(inputs)
			}
		} catch (err) {
			console.error("[Voice] browser enumeration failed:", err)
		}
	}, [])

	useEffect(() => {
		loadDevicesFallback()
	}, [])

	useEffect(() => {
		if (!voiceInputDeviceId) return
		const exists = inputDevices.some((d) => d.deviceId === voiceInputDeviceId)
		if (!exists) {
			updateSetting("voiceInputDeviceId", "")
		}
	}, [voiceInputDeviceId, inputDevices])

	useEffect(() => {
		if (!voicePiperVoice) return
		const exists = VOICE_OPTIONS.some((v) => v.value === voicePiperVoice)
		if (!exists) {
			updateSetting("voicePiperVoice", "en_US-lessac-medium")
		}
	}, [voicePiperVoice])

	return (
		<div>
			{renderSectionHeader("voice")}
			<Section>
				{/* STT toggle */}
				<div className="flex flex-col gap-3">
					<div className="flex items-center justify-between">
						<div>
							<Label className="text-sm font-medium">Speech-to-Text (Whisper)</Label>
							<p className="text-xs text-vscode-descriptionForeground mt-0.5">
								Capture your voice and transcribe it locally with Whisper-tiny (~75 MB, downloaded on first use).
							</p>
						</div>
						<Switch
							checked={voiceSttEnabled ?? false}
							onCheckedChange={(checked) => updateSetting("voiceSttEnabled", checked)}
						/>
					</div>

					{voiceSttEnabled && (
						<div className="pl-2 flex flex-col gap-2">
							<Label className="text-xs text-vscode-descriptionForeground">Microphone Input Device</Label>

							{/* Show detect button if list is empty or only has default */}
							{inputDevices.length === 0 && (
								<button
									className="text-xs px-2 py-1 rounded border border-vscode-focusBorder hover:bg-vscode-button-hoverBackground disabled:opacity-50"
									disabled={isDetectingDevices}
									onClick={detectRealDevices}>
									{isDetectingDevices ? "Detecting..." : "Detect microphones"}
								</button>
							)}

							{/* Show error if detection failed */}
							{error && <p className="text-xs text-red-400">Detection failed: {error}</p>}

							<Select
								onValueChange={(v) => updateSetting("voiceInputDeviceId", v === "default" ? "" : v)}
								value={
									voiceInputDeviceId && inputDevices.some((d) => d.deviceId === voiceInputDeviceId)
										? voiceInputDeviceId
										: "default"
								}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Default microphone" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="default">Default microphone</SelectItem>
									{inputDevices.map((d) => (
										<SelectItem key={d.deviceId} value={d.deviceId}>
											{d.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							{/* Silence threshold slider */}
							<div className="flex flex-col gap-2 mt-3">
								<div className="flex items-center justify-between">
									<Label className="text-xs text-vscode-descriptionForeground">Silence Threshold</Label>
									<span className="text-xs font-mono bg-vscode-editor-background px-2 py-1 rounded">
										{((voiceSilenceThresholdMs || 700) / 1000).toFixed(3)}s
									</span>
								</div>
								<input
									className="w-full cursor-pointer"
									max="2000"
									min="0"
									onChange={(e) =>
										updateSetting("voiceSilenceThresholdMs", Number.parseInt(e.target.value, 10))
									}
									step="1"
									title="Time to wait for silence before stopping recording (0-2000ms)"
									type="range"
									value={voiceSilenceThresholdMs || 700}
								/>
								<p className="text-xs text-vscode-descriptionForeground mt-1">
									Wait {((voiceSilenceThresholdMs || 700) / 1000).toFixed(3)}s of silence to auto-stop recording
								</p>
							</div>
						</div>
					)}

					{/* TTS toggle */}
					<div className="flex items-center justify-between pt-2 border-t border-vscode-panel-border">
						<div>
							<Label className="text-sm font-medium">Text-to-Speech (Piper)</Label>
							<p className="text-xs text-vscode-descriptionForeground mt-0.5">
								Let the AI speak responses aloud using the local Piper TTS engine (~55 MB voice model, downloaded
								on first use).
							</p>
						</div>
						<Switch
							checked={voiceTtsEnabled ?? false}
							onCheckedChange={(checked) => updateSetting("voiceTtsEnabled", checked)}
						/>
					</div>

					{voiceTtsEnabled && (
						<>
							<div className="pl-2">
								<Label className="text-xs text-vscode-descriptionForeground">Voice</Label>
								<Select
									onValueChange={(v) => updateSetting("voicePiperVoice", v)}
									value={
										voicePiperVoice && VOICE_OPTIONS.some((v) => v.value === voicePiperVoice)
											? voicePiperVoice
											: "en_US-lessac-medium"
									}>
									<SelectTrigger className="mt-1 w-full">
										<SelectValue placeholder="en_US-lessac-medium" />
									</SelectTrigger>
									<SelectContent>
										{VOICE_OPTIONS.map((voice) => (
											<SelectItem key={voice.value} value={voice.value}>
												{voice.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</>
					)}
				</div>
			</Section>
		</div>
	)
}

export default VoiceSettingsSection
