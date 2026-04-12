import React from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useExtensionState } from "@/context/ExtensionStateContext"
import Section from "../Section"
import { updateSetting } from "../utils/settingsHandlers"

interface Props {
	renderSectionHeader: (tabId: string) => JSX.Element | null
}

const AvatarSettingsSection: React.FC<Props> = ({ renderSectionHeader }) => {
	const { avatarEnabled, avatarName, avatarPosition, avatarPersonalityTone, avatarPersonalityResponseMode } =
		useExtensionState()

	return (
		<div>
			{renderSectionHeader("avatar")}
			<Section>
				<div className="flex flex-col gap-3">
					{/* Ativar avatar */}
					<div className="flex items-center justify-between">
						<div>
							<Label className="text-sm font-medium">Mostrar avatar</Label>
							<p className="text-xs text-vscode-descriptionForeground mt-0.5">
								Exibe um avatar animado durante as interações por voz.
							</p>
						</div>
						<Switch
							checked={avatarEnabled ?? true}
							onCheckedChange={(checked) => updateSetting("avatarEnabled", checked)}
						/>
					</div>

					{(avatarEnabled ?? true) && (
						<>
							{/* Nome do avatar */}
							<div className="pt-2 border-t border-vscode-panel-border">
								<Label className="text-sm font-medium mb-1 block" htmlFor="avatar-name-input">
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

							{/* Posição */}
							<div className="pt-2 border-t border-vscode-panel-border">
								<Label className="text-sm font-medium mb-1 block">Posição do avatar</Label>
								<Select
									onValueChange={(v) => updateSetting("avatarPosition", v)}
									value={avatarPosition ?? "bottom-right"}>
									<SelectTrigger className="w-full text-sm">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="bottom-right">Inferior direito</SelectItem>
										<SelectItem value="bottom-left">Inferior esquerdo</SelectItem>
										<SelectItem value="inline">Linha do chat</SelectItem>
									</SelectContent>
								</Select>
							</div>

							{/* Tom de voz */}
							<div className="pt-2 border-t border-vscode-panel-border">
								<Label className="text-sm font-medium mb-1 block">Tom de resposta</Label>
								<p className="text-xs text-vscode-descriptionForeground mb-1">
									Estilo de linguagem usado pelo avatar ao responder.
								</p>
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

							{/* Modo de resposta */}
							<div className="pt-2 border-t border-vscode-panel-border">
								<Label className="text-sm font-medium mb-1 block">Modo de resposta</Label>
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

							<p className="text-xs text-vscode-descriptionForeground pt-1">
								O idioma do avatar segue automaticamente o idioma detectado na fala.
							</p>
						</>
					)}
				</div>
			</Section>
		</div>
	)
}

export default AvatarSettingsSection
