import React, { useCallback, useEffect, useRef, useState } from "react"
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

const VoiceSettingsSection: React.FC<Props> = ({ renderSectionHeader }) => {
	const { voiceTtsEnabled, voiceSttEnabled, voiceInputDeviceId, voiceOutputDeviceId, voicePiperVoice } = useExtensionState()

	const [inputDevices, setInputDevices] = useState<AudioDevice[]>([])
	const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([])
	const permissionRequested = useRef(false)

	// Populate device lists — request mic permission first so device labels are available.
	const loadDevices = useCallback(async () => {
		try {
			if (!permissionRequested.current) {
				permissionRequested.current = true
				// Temporarily request permission to unlock labels, then stop the stream.
				const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
				stream.getTracks().forEach((t) => t.stop())
			}
			const devices = await navigator.mediaDevices.enumerateDevices()
			const inputs: AudioDevice[] = []
			const outputs: AudioDevice[] = []
			devices.forEach((d) => {
				const label = d.label || d.deviceId
				if (d.kind === "audioinput") inputs.push({ deviceId: d.deviceId, label })
				else if (d.kind === "audiooutput") outputs.push({ deviceId: d.deviceId, label })
			})
			setInputDevices(inputs)
			setOutputDevices(outputs)
		} catch {
			// Permission denied — silently ignore, dropdowns will show empty.
		}
	}, [])

	useEffect(() => {
		loadDevices()
		navigator.mediaDevices.addEventListener("devicechange", loadDevices)
		return () => navigator.mediaDevices.removeEventListener("devicechange", loadDevices)
	}, [loadDevices])

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
						<div className="pl-2">
							<Label className="text-xs text-vscode-descriptionForeground">Microphone Input Device</Label>
							<Select
								onValueChange={(v) => updateSetting("voiceInputDeviceId", v === "default" ? "" : v)}
								value={voiceInputDeviceId ?? "default"}>
								<SelectTrigger className="mt-1 w-full">
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
								<Label className="text-xs text-vscode-descriptionForeground">Output Device</Label>
								<Select
									onValueChange={(v) => updateSetting("voiceOutputDeviceId", v === "default" ? "" : v)}
									value={voiceOutputDeviceId ?? "default"}>
									<SelectTrigger className="mt-1 w-full">
										<SelectValue placeholder="Default speaker" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="default">Default speaker</SelectItem>
										{outputDevices.map((d) => (
											<SelectItem key={d.deviceId} value={d.deviceId}>
												{d.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="pl-2">
								<Label className="text-xs text-vscode-descriptionForeground">Voice</Label>
								<Select
									onValueChange={(v) => updateSetting("voicePiperVoice", v)}
									value={voicePiperVoice ?? "en_US-lessac-medium"}>
									<SelectTrigger className="mt-1 w-full">
										<SelectValue placeholder="en_US-lessac-medium" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="en_US-lessac-medium">en_US-lessac-medium (default)</SelectItem>
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
