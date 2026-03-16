import React from "react"

interface WhatsNewItemsProps {
	onNavigateToModelPicker: (initialModelTab: "recommended" | "free", modelId?: string) => void
}

type InlineModelLinkProps = { pickerTab: "recommended" | "free"; modelId: string; label: string }

export const WhatsNewItems: React.FC<WhatsNewItemsProps> = ({ onNavigateToModelPicker }) => {
	const InlineModelLink: React.FC<InlineModelLinkProps> = ({ pickerTab, modelId, label }) => (
		<span
			onClick={() => onNavigateToModelPicker(pickerTab, modelId)}
			style={{ color: "var(--vscode-textLink-foreground)", cursor: "pointer" }}>
			{label}
		</span>
	)

	return (
		<ul className="text-sm pl-3 list-disc" style={{ color: "var(--vscode-descriptionForeground)" }}>
			<li className="mb-2">
				<strong>IoT Tools (Fase 4):</strong> discover, register, and operate local network devices via mDNS, SSDP, ARP,
				MQTT, HTTP and SSH — all from the chat.
			</li>
			<li className="mb-2">
				<strong>SSH Tools (Fase 3):</strong> connect to remote hosts, execute commands, upload/download files and manage
				sessions directly in the agent loop.
			</li>
			<li className="mb-2">
				<strong>PostHog removed:</strong> no usage data is sent to third-party analytics services. Your prompts and tasks
				stay private.
			</li>
			<li className="mb-2">
				<strong>Try Claude Sonnet 4.6:</strong>{" "}
				<InlineModelLink label="Set as active model" modelId="anthropic/claude-sonnet-4.6" pickerTab="recommended" />
			</li>
		</ul>
	)
}

export default WhatsNewItems
