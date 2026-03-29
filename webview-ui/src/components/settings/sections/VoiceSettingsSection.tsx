import { trpc } from "@services/trpc-client"
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
	const {
		voiceTtsEnabled,
		voiceSttEnabled,
		voiceInputDeviceId,
		voiceOutputDeviceId,
		voicePiperVoice,
		voiceSilenceThresholdMs,
		voiceGracePeriodMs,
		voiceMetadataEnabled,
	} = useExtensionState()

	const [inputDevices, setInputDevices] = useState<AudioDevice[]>([])
	const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([])
	const [error, setError] = useState<string | null>(null)
	const [refreshing, setRefreshing] = useState(false)

	const detectRealDevices = useCallback(async () => {
		setError(null)

		try {
			const resp = await trpc.voice.enumerateAudioDevices.query()

			if (resp.error) {
				setError(resp.error)
				return
			}

			setInputDevices(
				(resp.inputDevices || []).map((d) => ({
					deviceId: d.deviceId || "",
					label: d.label || d.deviceId || "(unknown)",
				})),
			)

			setOutputDevices(
				(resp.outputDevices || []).map((d) => ({
					deviceId: d.deviceId || "",
					label: d.label || d.deviceId || "(unknown)",
				})),
			)
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			setError(msg)
		}
	}, [])

	const handleRefresh = useCallback(async () => {
		setRefreshing(true)
		await detectRealDevices()
		setRefreshing(false)
	}, [detectRealDevices])

	// Auto-detect on mount
	useEffect(() => {
		detectRealDevices()
	}, [detectRealDevices])

	// Re-detect when system audio devices change (e.g., headset plugged/unplugged)
	useEffect(() => {
		if (!navigator.mediaDevices) return
		navigator.mediaDevices.addEventListener("devicechange", detectRealDevices)
		return () => navigator.mediaDevices.removeEventListener("devicechange", detectRealDevices)
	}, [detectRealDevices])

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
								Capture your voice and transcribe it locally with Whisper Small (~244 MB, downloaded on first
								use). Falls back to Whisper-tiny on Linux/macOS.
							</p>
						</div>
						<Switch
							checked={voiceSttEnabled ?? false}
							onCheckedChange={(checked) => updateSetting("voiceSttEnabled", checked)}
						/>
					</div>

					{voiceSttEnabled && (
						<div className="pl-2 flex flex-col gap-2">
							<div className="flex items-center justify-between">
								<Label className="text-xs text-vscode-descriptionForeground">Microphone Input Device</Label>
								<button
									className="text-xs text-vscode-descriptionForeground hover:text-vscode-foreground disabled:opacity-50"
									disabled={refreshing}
									onClick={handleRefresh}
									title="Refresh device list"
									type="button">
									{refreshing ? "↻ Refreshing…" : "↻ Refresh"}
								</button>
							</div>

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

							{/* Grace period slider */}
							<div className="flex flex-col gap-2">
								<div className="flex items-center justify-between">
									<Label className="text-xs text-vscode-descriptionForeground">Grace Period</Label>
									<span className="text-xs font-mono bg-vscode-editor-background px-2 py-1 rounded">
										{((voiceGracePeriodMs ?? 2000) / 1000).toFixed(1)}s
									</span>
								</div>
								<input
									className="w-full cursor-pointer"
									max="4000"
									min="0"
									onChange={(e) => updateSetting("voiceGracePeriodMs", Number.parseInt(e.target.value, 10))}
									step="400"
									title="Time after mic is ready before silence detection activates (0-4s)"
									type="range"
									value={voiceGracePeriodMs ?? 2000}
								/>
								<p className="text-xs text-vscode-descriptionForeground mt-1">
									Wait {((voiceGracePeriodMs ?? 2000) / 1000).toFixed(1)}s after mic is ready before silence can
									stop recording
								</p>
							</div>
						</div>
					)}

					{/* Voice metadata toggle */}
					<div className="flex items-center justify-between pt-2 border-t border-vscode-panel-border">
						<div>
							<Label className="text-sm font-medium">Voice Context Hints</Label>
							<p className="text-xs text-vscode-descriptionForeground mt-0.5">
								Prefix voice messages with metadata (input source and detected language) so the AI can adapt its
								response style to spoken language.
							</p>
						</div>
						<Switch
							checked={voiceMetadataEnabled ?? true}
							onCheckedChange={(checked) => updateSetting("voiceMetadataEnabled", checked)}
						/>
					</div>

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
						<div className="pl-2 flex flex-col gap-2">
							<div>
								<Label className="text-xs text-vscode-descriptionForeground">Audio Output Device</Label>
								<Select
									onValueChange={(v) => updateSetting("voiceOutputDeviceId", v === "default" ? "" : v)}
									value={
										voiceOutputDeviceId && outputDevices.some((d) => d.deviceId === voiceOutputDeviceId)
											? voiceOutputDeviceId
											: "default"
									}>
									<SelectTrigger className="mt-1 w-full">
										<SelectValue placeholder="Default output" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="default">Default output</SelectItem>
										{outputDevices.map((d) => (
											<SelectItem key={d.deviceId} value={d.deviceId}>
												{d.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div>
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
						</div>
					)}
				</div>
			</Section>
		</div>
	)
}

export default VoiceSettingsSection
