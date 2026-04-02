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
		voiceOutputDeviceId,
		voicePiperVoice,
		voiceMetadataEnabled,
		avatarEnabled,
		avatarName,
		avatarPosition,
		avatarPersonalityTone,
		avatarPersonalityResponseMode,
	} = useExtensionState()

	const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([])
	const [error, setError] = useState<string | null>(null)

	const detectRealDevices = useCallback(async () => {
		setError(null)

		try {
			const resp = await trpc.voice.enumerateAudioDevices.query()

			if (resp.error) {
				setError(resp.error)
				return
			}

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

	// Auto-detect on mount
	useEffect(() => {
		detectRealDevices()
	}, [detectRealDevices])

	// Re-detect when system audio devices change (e.g., headset plugged/unplugged)
	useEffect(() => {
		if (!navigator.mediaDevices) return
		const mediaDevices = navigator.mediaDevices
		mediaDevices.addEventListener("devicechange", detectRealDevices)
		return () => mediaDevices.removeEventListener("devicechange", detectRealDevices)
	}, [detectRealDevices])

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
				<div className="flex flex-col gap-3">
					{/* STT — permanent technical impossibility in VS Code webview */}
					<div className="flex flex-col gap-1 rounded p-2 bg-vscode-inputValidation-warningBackground border border-vscode-inputValidation-warningBorder">
						<Label className="text-sm font-medium">Speech-to-Text (Streaming)</Label>
						<p className="text-xs text-vscode-descriptionForeground mt-0.5">
							Microphone access is not available inside the VS Code webview. The extension iframe runs in a
							sandboxed context that permanently blocks <code>getUserMedia</code> regardless of OS-level permissions
							(see{" "}
							<a href="https://github.com/microsoft/vscode/issues/119127" rel="noreferrer" target="_blank">
								vscode#119127
							</a>
							). TTS still works normally.
						</p>
					</div>

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

					{/* Avatar & Personality subsection */}
					<div className="mt-4 pt-4 border-t border-vscode-panel-border">
						<p className="text-sm font-semibold mb-3 text-vscode-foreground">Avatar &amp; Personalidade</p>

						<div className="flex items-center justify-between mb-3">
							<div>
								<Label className="text-sm">Mostrar avatar</Label>
								<p className="text-xs mt-0.5 text-vscode-descriptionForeground">
									Exibe avatar animado durante interações por voz
								</p>
							</div>
							<Switch
								checked={avatarEnabled ?? true}
								onCheckedChange={(checked) => updateSetting("avatarEnabled", checked)}
							/>
						</div>

						{(avatarEnabled ?? true) && (
							<>
								<div className="mb-3">
									<Label className="text-sm mb-1 block" htmlFor="avatar-name-input">
										Nome do avatar
									</Label>
									<input
										className="w-full px-2 py-1 text-sm rounded bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border"
										defaultValue={avatarName ?? "Nexus"}
										id="avatar-name-input"
										onBlur={(e) => updateSetting("avatarName", e.target.value || "Nexus")}
										placeholder="Nexus"
										title="Nome do avatar"
										type="text"
									/>
								</div>

								<div className="mb-3">
									<Label className="text-sm mb-1 block">Tom de voz</Label>
									<Select
										onValueChange={(v) => updateSetting("avatarPersonalityTone", v)}
										value={avatarPersonalityTone ?? "casual"}>
										<SelectTrigger className="w-full text-sm">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="casual">Casual</SelectItem>
											<SelectItem value="formal">Formal</SelectItem>
											<SelectItem value="technical">Técnico</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="mb-3">
									<Label className="text-sm mb-1 block">Modo de resposta</Label>
									<Select
										onValueChange={(v) => updateSetting("avatarPersonalityResponseMode", v)}
										value={avatarPersonalityResponseMode ?? "concise"}>
										<SelectTrigger className="w-full text-sm">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="concise">Conciso</SelectItem>
											<SelectItem value="detailed">Detalhado</SelectItem>
											<SelectItem value="conversational">Conversacional</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="mb-3">
									<Label className="text-sm mb-1 block">Posição do avatar</Label>
									<Select
										onValueChange={(v) => updateSetting("avatarPosition", v)}
										value={avatarPosition ?? "bottom-right"}>
										<SelectTrigger className="w-full text-sm">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="bottom-right">Inferior direito</SelectItem>
											<SelectItem value="bottom-left">Inferior esquerdo</SelectItem>
											<SelectItem value="inline">Inline</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<p className="text-xs text-vscode-descriptionForeground">
									O idioma do avatar segue automaticamente o idioma detectado na fala.
								</p>
							</>
						)}
					</div>
				</div>
			</Section>
		</div>
	)
}

export default VoiceSettingsSection
