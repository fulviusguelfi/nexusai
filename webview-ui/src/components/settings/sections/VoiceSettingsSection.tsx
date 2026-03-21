import { StringRequest } from "@shared/proto/nexusai/common"
import React, { useCallback, useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { WebServiceClient } from "@/services/grpc-client"
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
	const { voiceTtsEnabled, voiceSttEnabled, voiceInputDeviceId, voiceOutputDeviceId, voicePiperVoice } = useExtensionState()
	const mediaDevices = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined

	const [inputDevices, setInputDevices] = useState<AudioDevice[]>([])
	const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([])
	const [permissionState, setPermissionState] = useState<"idle" | "requesting" | "granted" | "denied">("idle")
	const [permissionError, setPermissionError] = useState<string>("")
	const [probeStatus, setProbeStatus] = useState<string>("")

	// Populate device lists without proactively requesting mic permission.
	// Some environments/webviews flicker or lose focus when getUserMedia is called on mount.
	const mapDevices = (devices: MediaDeviceInfo[]) => {
		const realInputs: AudioDevice[] = []
		const realOutputs: AudioDevice[] = []
		const virtualInputs: AudioDevice[] = []
		const virtualOutputs: AudioDevice[] = []

		devices.forEach((d) => {
			if (!d.deviceId) return
			const label = d.label || d.deviceId
			const isVirtual = d.deviceId === "default" || d.deviceId === "communications"
			if (d.kind === "audioinput") {
				if (isVirtual) virtualInputs.push({ deviceId: d.deviceId, label })
				else realInputs.push({ deviceId: d.deviceId, label })
			} else if (d.kind === "audiooutput") {
				if (isVirtual) virtualOutputs.push({ deviceId: d.deviceId, label })
				else realOutputs.push({ deviceId: d.deviceId, label })
			}
		})

		// Some Windows environments expose only virtual entries. In that case,
		// show them instead of an empty list.
		const inputs = realInputs.length > 0 ? realInputs : virtualInputs
		const outputs = realOutputs.length > 0 ? realOutputs : virtualOutputs

		return { inputs, outputs }
	}

	const loadDevices = useCallback(async () => {
		if (!mediaDevices?.enumerateDevices) {
			setInputDevices([])
			setOutputDevices([])
			setPermissionState("denied")
			setPermissionError("navigator.mediaDevices.enumerateDevices is unavailable in this webview context")
			return
		}

		try {
			const devices = await mediaDevices.enumerateDevices()
			const { inputs, outputs } = mapDevices(devices)

			if (inputs.length > 0 || outputs.length > 0) {
				setPermissionState("granted")
				setPermissionError("")
			}

			setInputDevices(inputs)
			setOutputDevices(outputs)
		} catch (err) {
			setPermissionState("denied")
			setPermissionError(err instanceof Error ? err.message : "Failed to enumerate audio devices")
			setInputDevices([])
			setOutputDevices([])
		}
	}, [mediaDevices])

	/** Explicitly request microphone permission (called by the "Grant Access" button). */
	const requestPermission = useCallback(async () => {
		if (!mediaDevices?.getUserMedia) return
		setPermissionState("requesting")
		setPermissionError("")
		setProbeStatus("")
		try {
			const stream = await mediaDevices.getUserMedia({ audio: true })
			stream.getTracks().forEach((t) => t.stop())
			setPermissionState("granted")
			await loadDevices()
		} catch (err) {
			setPermissionState("denied")
			if (err instanceof DOMException) {
				setPermissionError(`${err.name}: ${err.message}`)
			} else if (err instanceof Error) {
				setPermissionError(err.message)
			} else {
				setPermissionError("Unknown microphone permission error")
			}
		}
	}, [mediaDevices, loadDevices])

	const runMicProbe = useCallback(async () => {
		if (!mediaDevices?.getUserMedia) {
			setProbeStatus("MIC_ERR: getUserMedia is unavailable in this webview context")
			setPermissionState("denied")
			return
		}

		setPermissionState("requesting")
		setPermissionError("")
		setProbeStatus("")

		try {
			const stream = await mediaDevices.getUserMedia({ audio: true })
			stream.getTracks().forEach((t) => t.stop())

			const devices = mediaDevices.enumerateDevices ? await mediaDevices.enumerateDevices() : []
			const { inputs, outputs } = mapDevices(devices)
			setInputDevices(inputs)
			setOutputDevices(outputs)
			setPermissionState("granted")
			setProbeStatus(`MIC_OK: ${inputs.length} input device(s), ${outputs.length} output device(s)`)
		} catch (err) {
			setPermissionState("denied")
			if (err instanceof DOMException) {
				setPermissionError(`${err.name}: ${err.message}`)
				setProbeStatus(`MIC_ERR: ${err.name} - ${err.message}`)
			} else if (err instanceof Error) {
				setPermissionError(err.message)
				setProbeStatus(`MIC_ERR: ${err.message}`)
			} else {
				setPermissionError("Unknown microphone permission error")
				setProbeStatus("MIC_ERR: Unknown microphone permission error")
			}
		}
	}, [mediaDevices])

	useEffect(() => {
		loadDevices()
		if (!mediaDevices?.addEventListener || !mediaDevices?.removeEventListener) {
			return
		}

		mediaDevices.addEventListener("devicechange", loadDevices)
		return () => mediaDevices.removeEventListener("devicechange", loadDevices)
	}, [loadDevices, mediaDevices])

	useEffect(() => {
		if (!voiceInputDeviceId) return
		const exists = inputDevices.some((d) => d.deviceId === voiceInputDeviceId)
		if (!exists) {
			updateSetting("voiceInputDeviceId", "")
		}
	}, [voiceInputDeviceId, inputDevices])

	useEffect(() => {
		if (!voiceOutputDeviceId) return
		const exists = outputDevices.some((d) => d.deviceId === voiceOutputDeviceId)
		if (!exists) {
			updateSetting("voiceOutputDeviceId", "")
		}
	}, [voiceOutputDeviceId, outputDevices])

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

							{/* Permission status */}
							{permissionState === "denied" &&
								(() => {
									const ua = navigator.userAgent
									const isWindows = ua.includes("Windows")
									const isMac = ua.includes("Macintosh") || ua.includes("Mac OS")

									if (isWindows) {
										return (
											<div className="flex items-start gap-2">
												<span className="codicon codicon-warning text-error text-xs mt-0.5 shrink-0" />
												<p className="text-xs text-error leading-snug">
													Microphone access denied. In Windows Settings:{" "}
													<strong>Privacy &amp; Security → Microphone</strong> — first enable{" "}
													<strong>"Microphone access"</strong>, then enable{" "}
													<strong>"Let desktop apps access your microphone"</strong>. After changing
													this, fully close and reopen <strong>Visual Studio Code</strong>, then run the
													mic diagnostic again.{" "}
													<button
														className="underline font-medium"
														onClick={() =>
															WebServiceClient.openInBrowser(
																StringRequest.create({ value: "ms-settings:privacy-microphone" }),
															)
														}
														type="button">
														Open microphone settings ↗
													</button>
												</p>
											</div>
										)
									}

									if (isMac) {
										return (
											<div className="flex items-start gap-2">
												<span className="codicon codicon-warning text-error text-xs mt-0.5 shrink-0" />
												<p className="text-xs text-error leading-snug">
													Microphone access denied. Open{" "}
													<strong>System Settings → Privacy &amp; Security → Microphone</strong> and
													allow <strong>Visual Studio Code</strong>.{" "}
													<button
														className="underline font-medium"
														onClick={() =>
															WebServiceClient.openInBrowser(
																StringRequest.create({
																	value: "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
																}),
															)
														}
														type="button">
														Open microphone settings ↗
													</button>
												</p>
											</div>
										)
									}

									// Linux and others
									return (
										<div className="flex items-start gap-2">
											<span className="codicon codicon-warning text-error text-xs mt-0.5 shrink-0" />
											<p className="text-xs text-error leading-snug">
												Microphone access denied. Make sure PulseAudio or PipeWire is running and that VS
												Code has permission to use audio devices. You can check with{" "}
												<strong>pavucontrol</strong> or your system's sound settings.
											</p>
										</div>
									)
								})()}
							{permissionError && (
								<p className="text-xs text-vscode-descriptionForeground leading-snug break-all">
									Mic diagnostic: {permissionError}
								</p>
							)}
							{permissionError.includes("NotAllowedError") && (
								<p className="text-xs text-vscode-descriptionForeground leading-snug">
									If Windows settings are already enabled, reload VS Code window and retry to force a fresh
									permission check.
								</p>
							)}
							{probeStatus && (
								<p className="text-xs text-vscode-descriptionForeground leading-snug break-all">{probeStatus}</p>
							)}
							{inputDevices.length === 0 && permissionState !== "granted" && (
								<button
									className="text-xs text-vscode-textLink-foreground hover:underline text-left w-fit"
									disabled={permissionState === "requesting"}
									onClick={requestPermission}
									type="button">
									{permissionState === "requesting" ? "Requesting…" : "Grant microphone access to see devices"}
								</button>
							)}
							<button
								className="text-xs text-vscode-textLink-foreground hover:underline text-left w-fit"
								disabled={permissionState === "requesting"}
								onClick={runMicProbe}
								type="button">
								{permissionState === "requesting" ? "Probing…" : "Run microphone diagnostic"}
							</button>
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
									value={
										voiceOutputDeviceId && outputDevices.some((d) => d.deviceId === voiceOutputDeviceId)
											? voiceOutputDeviceId
											: "default"
									}>
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
