import React, { useCallback } from "react"
import { useMount } from "react-use"
import GitHubIcon from "@/assets/GitHubIcon"
import WhatsNewItems from "@/components/common/WhatsNewItems"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useApiConfigurationHandlers } from "../settings/utils/useApiConfigurationHandlers"

interface WhatsNewModalProps {
	open: boolean
	onClose: () => void
	version: string
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ open, onClose, version }) => {
	const { openRouterModels, refreshOpenRouterModels, navigateToSettingsModelPicker } = useExtensionState()
	const { handleFieldsChange } = useApiConfigurationHandlers()

	// Get latest model list in case user hits shortcut button to set model
	useMount(refreshOpenRouterModels)

	const navigateToModelPicker = useCallback(
		(initialModelTab: "recommended" | "free", modelId?: string) => {
			// Switch to Cline provider first so the model picker tab works
			// Optionally also set the model if provided
			const updates: Record<string, any> = {
				planModeApiProvider: "cline",
				actModeApiProvider: "cline",
			}
			if (modelId) {
				updates.planModeOpenRouterModelId = modelId
				updates.actModeOpenRouterModelId = modelId
				updates.planModeOpenRouterModelInfo = openRouterModels[modelId]
				updates.actModeOpenRouterModelInfo = openRouterModels[modelId]
			}
			handleFieldsChange(updates)
			onClose()
			navigateToSettingsModelPicker({ targetSection: "api-config", initialModelTab })
		},
		[handleFieldsChange, navigateToSettingsModelPicker, onClose, openRouterModels],
	)

	return (
		<Dialog onOpenChange={(isOpen) => !isOpen && onClose()} open={open}>
			<DialogContent
				aria-describedby="whats-new-description"
				aria-labelledby="whats-new-title"
				className="pt-5 px-5 pb-4 gap-0">
				<div id="whats-new-description">
					<h2
						className="text-lg font-semibold mb-3 pr-6"
						id="whats-new-title"
						style={{ color: "var(--vscode-editor-foreground)" }}>
						🎉 New in v{version}
					</h2>

					<WhatsNewItems onNavigateToModelPicker={navigateToModelPicker} />

					{/* Social Icons Section */}
					<div className="flex flex-col items-center gap-3 mt-4 pt-4 border-t border-[var(--vscode-widget-border)]">
						{/* Icon Row */}
						<div className="flex items-center gap-4">
							{/* GitHub */}
							<a
								aria-label="Star us on GitHub"
								className="text-[var(--vscode-foreground)] hover:text-[var(--vscode-textLink-activeForeground)] transition-colors"
								href="https://github.com/fulviusguelfi/nexusai"
								rel="noopener noreferrer"
								target="_blank">
								<GitHubIcon />
							</a>
						</div>

						{/* GitHub Star CTA */}
						<p className="text-sm text-center" style={{ color: "var(--vscode-descriptionForeground)" }}>
							Enjoy NexusAI?{" "}
							<a
								href="https://github.com/fulviusguelfi/nexusai"
								rel="noopener noreferrer"
								style={{ color: "var(--vscode-textLink-foreground)" }}
								target="_blank">
								Star us on GitHub
							</a>
							.
						</p>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}

export default WhatsNewModal
