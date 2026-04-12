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

interface EdgeVoice {
	ShortName: string
	Locale: string
	Gender: string
	FriendlyName?: string
}

const VoiceSettingsSection: React.FC<Props> = ({ renderSectionHeader }) => {
	const { voiceSttEnabled, voiceInputDeviceId, voiceTtsEnabled, voiceOutputDeviceId, voiceEdgeTtsVoice, voiceMetadataEnabled } =
		useExtensionState()

	const [inputDevices, setInputDevices] = useState<AudioDevice[]>([])
	const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([])
	const [devicesLoaded, setDevicesLoaded] = useState(false)
	const [_error, setError] = useState<string | null>(null)
	const [edgeVoices, setEdgeVoices] = useState<EdgeVoice[]>([])
	const [edgeLangFilter, setEdgeLangFilter] = useState<string>("")

	const detectRealDevices = useCallback(async () => {
		setError(null)

		try {
			// Input devices: use host-side FFmpeg enumeration (dshow format required for capture)
			const resp = await trpc.voice.enumerateAudioDevices.query()
			if (resp.error) {
				setError(resp.error)
			} else {
				setInputDevices(
					(resp.inputDevices || [])
						.filter((d) => d.deviceId && d.deviceId !== "")
						.map((d) => ({
							deviceId: d.deviceId || "",
							label: d.label || d.deviceId || "(desconhecido)",
						})),
				)
				// Output devices: use host-side PowerShell enumeration.
				// Browser enumerateDevices() returns empty deviceIds in VS Code webview without
				// prior getUserMedia permission, so we use the host-side names instead.
				setOutputDevices(
					(resp.outputDevices || [])
						.filter((d) => d.label && d.label !== "")
						.map((d) => ({
							deviceId: d.label || "",
							label: d.label || "(desconhecido)",
						})),
				)
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			setError(msg)
		} finally {
			setDevicesLoaded(true)
		}
	}, [])

	// Auto-detect on mount
	useEffect(() => {
		detectRealDevices()
	}, [detectRealDevices])

	// Fetch Edge TTS voice list when TTS is enabled
	useEffect(() => {
		if (!voiceTtsEnabled || edgeVoices.length > 0) return
		trpc.voice.getEdgeVoices
			.query()
			.then((voices) => {
				setEdgeVoices(voices)
				// Initialise language filter to match saved voice locale
				if (voiceEdgeTtsVoice) {
					const savedVoice = voices.find((v) => v.ShortName === voiceEdgeTtsVoice)
					if (savedVoice) setEdgeLangFilter(savedVoice.Locale)
				}
			})
			.catch(() => {})
	}, [voiceTtsEnabled, edgeVoices.length, voiceEdgeTtsVoice])

	// Re-detect when system audio devices change (e.g., headset plugged/unplugged)
	useEffect(() => {
		if (!navigator.mediaDevices) return
		const mediaDevices = navigator.mediaDevices
		mediaDevices.addEventListener("devicechange", detectRealDevices)
		return () => mediaDevices.removeEventListener("devicechange", detectRealDevices)
	}, [detectRealDevices])

	useEffect(() => {
		if (!voiceInputDeviceId) return
		const exists = inputDevices.some((d) => d.deviceId === voiceInputDeviceId)
		if (!exists && inputDevices.length > 0) {
			updateSetting("voiceInputDeviceId", undefined)
		}
	}, [voiceInputDeviceId, inputDevices])

	useEffect(() => {
		if (!voiceOutputDeviceId) return
		const exists = outputDevices.some((d) => d.deviceId === voiceOutputDeviceId)
		if (!exists && outputDevices.length > 0) {
			updateSetting("voiceOutputDeviceId", "")
		}
	}, [voiceOutputDeviceId, outputDevices])

	return (
		<div>
			{renderSectionHeader("voice")}
			<Section>
				{!devicesLoaded ? (
					<div className="flex items-center gap-2 py-6 justify-center text-vscode-descriptionForeground">
						<span className="codicon codicon-loading animate-spin text-base" />
						<span className="text-sm">Carregando dispositivos de áudio…</span>
					</div>
				) : (
					<div className="flex flex-col gap-3">
						{/* STT toggle + mic input selector */}
						<div className="flex items-center justify-between">
							<div>
								<Label className="text-sm font-medium">Reconhecimento de Voz (Microfone)</Label>
								<p className="text-xs text-vscode-descriptionForeground mt-0.5">
									Habilita entrada de voz pelo botão de microfone no chat. O áudio é capturado pelo FFmpeg (fora
									do sandbox do webview) e transcrito localmente pelo Whisper.
								</p>
							</div>
							<Switch
								checked={voiceSttEnabled ?? true}
								onCheckedChange={(checked) => updateSetting("voiceSttEnabled", checked)}
							/>
						</div>

						{(voiceSttEnabled ?? true) && (
							<div className="pl-2 flex flex-col gap-2">
								<div>
									<Label className="text-xs text-vscode-descriptionForeground">Microfone</Label>
									<Select
										onValueChange={(v) =>
											updateSetting("voiceInputDeviceId", v === "default" ? undefined : v)
										}
										value={
											voiceInputDeviceId && inputDevices.some((d) => d.deviceId === voiceInputDeviceId)
												? voiceInputDeviceId
												: "default"
										}>
										<SelectTrigger className="mt-1 w-full">
											<SelectValue placeholder="Microfone padrão" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="default">Microfone padrão</SelectItem>
											{inputDevices.map((d) => (
												<SelectItem key={d.deviceId} value={d.deviceId}>
													{d.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						)}

						{/* Voice metadata toggle */}
						<div className="flex items-center justify-between pt-2 border-t border-vscode-panel-border">
							<div>
								<Label className="text-sm font-medium">Dicas de Contexto de Voz</Label>
								<p className="text-xs text-vscode-descriptionForeground mt-0.5">
									Prefixia mensagens de voz com metadados (origem e idioma detectado) para que a IA adapte seu
									estilo de resposta à linguagem falada.
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
								<Label className="text-sm font-medium">Síntese de Voz</Label>
								<p className="text-xs text-vscode-descriptionForeground mt-0.5">
									Faz a IA falar as respostas em voz alta usando o Edge TTS da Microsoft (online, vozes neurais,
									sem chave de API).
								</p>
							</div>
							<Switch
								checked={voiceTtsEnabled ?? false}
								onCheckedChange={(checked) => updateSetting("voiceTtsEnabled", checked)}
							/>
						</div>

						{voiceTtsEnabled && (
							<div className="pl-2 flex flex-col gap-2">
								{/* Edge TTS: language filter + voice selector */}
								<>
									{edgeVoices.length === 0 ? (
										<p className="text-xs text-vscode-descriptionForeground italic">Carregando vozes…</p>
									) : (
										<>
											<div>
												<Label className="text-xs text-vscode-descriptionForeground">Idioma</Label>
												<Select
													onValueChange={(v) => {
														setEdgeLangFilter(v)
														// Auto-select first voice of the chosen language
														const first = edgeVoices.find((ev) => ev.Locale === v)
														if (first) updateSetting("voiceEdgeTtsVoice", first.ShortName)
													}}
													value={edgeLangFilter || "all"}>
													<SelectTrigger className="mt-1 w-full">
														<SelectValue placeholder="Todos os idiomas" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="all">Todos os idiomas</SelectItem>
														{Array.from(new Set(edgeVoices.map((v) => v.Locale)))
															.sort()
															.map((locale) => (
																<SelectItem key={locale} value={locale}>
																	{locale}
																</SelectItem>
															))}
													</SelectContent>
												</Select>
											</div>

											<div>
												<Label className="text-xs text-vscode-descriptionForeground">Voz</Label>
												{(() => {
													const filtered =
														edgeLangFilter && edgeLangFilter !== "all"
															? edgeVoices.filter((v) => v.Locale === edgeLangFilter)
															: edgeVoices
													const currentVal =
														voiceEdgeTtsVoice &&
														filtered.some((v) => v.ShortName === voiceEdgeTtsVoice)
															? voiceEdgeTtsVoice
															: (filtered[0]?.ShortName ?? "")
													return (
														<Select
															onValueChange={(v) => updateSetting("voiceEdgeTtsVoice", v)}
															value={currentVal}>
															<SelectTrigger className="mt-1 w-full">
																<SelectValue placeholder="Selecionar voz" />
															</SelectTrigger>
															<SelectContent>
																{filtered.map((v) => (
																	<SelectItem key={v.ShortName} value={v.ShortName}>
																		{v.FriendlyName ?? v.ShortName} ({v.Gender})
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													)
												})()}
											</div>
										</>
									)}
								</>

								<div>
									<Label className="text-xs text-vscode-descriptionForeground">Dispositivo de Saída</Label>
									<Select
										onValueChange={(v) => updateSetting("voiceOutputDeviceId", v === "default" ? "" : v)}
										value={
											voiceOutputDeviceId && outputDevices.some((d) => d.deviceId === voiceOutputDeviceId)
												? voiceOutputDeviceId
												: "default"
										}>
										<SelectTrigger className="mt-1 w-full">
											<SelectValue placeholder="Saída padrão" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="default">Saída padrão</SelectItem>
											{outputDevices.map((d) => (
												<SelectItem key={d.deviceId} value={d.deviceId}>
													{d.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						)}
					</div>
				)}
			</Section>
		</div>
	)
}

export default VoiceSettingsSection
