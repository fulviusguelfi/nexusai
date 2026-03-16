import { EmptyRequest } from "@shared/proto/cline/common"
import { LanguageModelChatSelector } from "@shared/proto/cline/models"
import { Mode } from "@shared/storage/types"
import { useCallback, useEffect, useRef, useState } from "react"
// isOpenRef lets requestVsCodeLmModels see the current isOpen without being a dependency
import { useInterval } from "react-use"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { ModelsServiceClient } from "@/services/grpc-client"
import { DROPDOWN_Z_INDEX, DropdownContainer } from "../ApiOptions"
import { getModeSpecificFields } from "../utils/providerUtils"
import { useApiConfigurationHandlers } from "../utils/useApiConfigurationHandlers"

interface VSCodeLmProviderProps {
	currentMode: Mode
}

export const VSCodeLmProvider = ({ currentMode }: VSCodeLmProviderProps) => {
	const [vsCodeLmModels, setVsCodeLmModels] = useState<LanguageModelChatSelector[]>([])
	const [searchQuery, setSearchQuery] = useState("")
	const [isOpen, setIsOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)
	const isOpenRef = useRef(false)

	const { apiConfiguration } = useExtensionState()
	const { handleModeFieldChange } = useApiConfigurationHandlers()
	const { vsCodeLmModelSelector } = getModeSpecificFields(apiConfiguration, currentMode)

	// Poll VS Code LM models — only update state when the list actually changes and dropdown is closed
	const requestVsCodeLmModels = useCallback(async () => {
		try {
			const response = await ModelsServiceClient.getVsCodeLmModels(EmptyRequest.create({}))
			if (response && response.models) {
				setVsCodeLmModels((prev) => {
					// Don't disrupt the dropdown while the user is interacting with it
					if (isOpenRef.current) return prev
					const newIds = response.models.map((m) => `${m.vendor}/${m.family}`).join(",")
					const prevIds = prev.map((m) => `${m.vendor}/${m.family}`).join(",")
					return newIds === prevIds ? prev : response.models
				})
			}
		} catch (error) {
			console.error("Failed to fetch VS Code LM models:", error)
			setVsCodeLmModels([])
		}
	}, [])

	useEffect(() => {
		requestVsCodeLmModels()
	}, [requestVsCodeLmModels])

	useInterval(requestVsCodeLmModels, 5000)

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				isOpenRef.current = false
				setIsOpen(false)
				setSearchQuery("")
			}
		}
		document.addEventListener("mousedown", handleClickOutside)
		return () => document.removeEventListener("mousedown", handleClickOutside)
	}, [])

	// Only show copilot vendor models; apply search filter on top
	const filteredModels = vsCodeLmModels
		.filter((m) => m.vendor === "copilot")
		.filter((m) => {
			if (!searchQuery) return true
			const q = searchQuery.toLowerCase()
			// Search by human-readable name first, fall back to family ID
			const displayText = (m.name || m.family || "").toLowerCase()
			return displayText.includes(q)
		})

	const modelDisplayName = (m: LanguageModelChatSelector) => m.name || m.family || ""

	// Derive display name from the polled model list (name is not stored in the selector)
	const selectedLabel = vsCodeLmModelSelector
		? vsCodeLmModels.find((m) => m.vendor === vsCodeLmModelSelector.vendor && m.family === vsCodeLmModelSelector.family)
				?.name ||
			vsCodeLmModelSelector.family ||
			""
		: ""

	const handleSelect = (model: LanguageModelChatSelector) => {
		handleModeFieldChange(
			{ plan: "planModeVsCodeLmModelSelector", act: "actModeVsCodeLmModelSelector" },
			{ vendor: model.vendor, family: model.family },
			currentMode,
		)
		setSearchQuery("")
		isOpenRef.current = false
		setIsOpen(false)
	}

	const handleToggle = () => {
		const opening = !isOpen
		isOpenRef.current = opening
		setIsOpen(opening)
		if (opening) {
			setTimeout(() => inputRef.current?.focus(), 50)
		} else {
			setSearchQuery("")
		}
	}

	const hasCopilotModels = vsCodeLmModels.some((m) => m.vendor === "copilot")

	return (
		<div>
			<DropdownContainer className="dropdown-container" zIndex={DROPDOWN_Z_INDEX - 2}>
				<label htmlFor="vscode-lm-model">
					<span style={{ fontWeight: 500 }}>Language Model</span>
				</label>
				{hasCopilotModels ? (
					<div ref={containerRef} style={{ position: "relative", width: "100%" }}>
						{/* Trigger button / search input */}
						<div
							id="vscode-lm-model"
							onClick={handleToggle}
							style={{
								display: "flex",
								alignItems: "center",
								border: "1px solid var(--vscode-dropdown-border)",
								background: "var(--vscode-dropdown-background)",
								color: "var(--vscode-dropdown-foreground)",
								padding: "3px 8px",
								cursor: "pointer",
								outline: isOpen ? "1px solid var(--vscode-focusBorder)" : "none",
								minHeight: "26px",
							}}>
							{isOpen ? (
								<input
									onChange={(e) => setSearchQuery(e.target.value)}
									onClick={(e) => e.stopPropagation()}
									placeholder="Search models..."
									ref={inputRef}
									style={{
										flex: 1,
										background: "transparent",
										border: "none",
										outline: "none",
										color: "inherit",
										fontSize: "inherit",
										fontFamily: "inherit",
									}}
									value={searchQuery}
								/>
							) : (
								<span style={{ flex: 1 }}>{selectedLabel || "Select a model..."}</span>
							)}
							<span style={{ marginLeft: 6, fontSize: "10px", opacity: 0.7 }}>▼</span>
						</div>

						{/* Dropdown list */}
						{isOpen && (
							<div
								style={{
									position: "absolute",
									top: "100%",
									left: 0,
									right: 0,
									background: "var(--vscode-dropdown-background)",
									border: "1px solid var(--vscode-dropdown-border)",
									maxHeight: "200px",
									overflowY: "auto",
									zIndex: DROPDOWN_Z_INDEX,
								}}>
								{filteredModels.length > 0 ? (
									filteredModels.map((model) => {
										const isSelected =
											vsCodeLmModelSelector?.vendor === model.vendor &&
											vsCodeLmModelSelector?.family === model.family
										return (
											<div
												key={`${model.vendor}/${model.family}`}
												onMouseDown={() => handleSelect(model)}
												onMouseEnter={(e) => {
													if (!isSelected)
														(e.currentTarget as HTMLElement).style.background =
															"var(--vscode-list-hoverBackground)"
												}}
												onMouseLeave={(e) => {
													if (!isSelected)
														(e.currentTarget as HTMLElement).style.background = "transparent"
												}}
												style={{
													padding: "4px 8px",
													cursor: "pointer",
													background: isSelected
														? "var(--vscode-list-activeSelectionBackground)"
														: "transparent",
													color: isSelected
														? "var(--vscode-list-activeSelectionForeground)"
														: "inherit",
												}}>
												{modelDisplayName(model)}
											</div>
										)
									})
								) : (
									<div
										style={{
											padding: "8px",
											color: "var(--vscode-descriptionForeground)",
											fontSize: "12px",
										}}>
										No models found
									</div>
								)}
							</div>
						)}
					</div>
				) : (
					<p
						style={{
							fontSize: "12px",
							marginTop: "5px",
							color: "var(--vscode-descriptionForeground)",
						}}>
						Use models from your GitHub Copilot subscription. Install the{" "}
						<a href="https://marketplace.visualstudio.com/items?itemName=GitHub.copilot">Copilot extension</a> and
						enable Claude models in Copilot settings to get started.
					</p>
				)}
			</DropdownContainer>
		</div>
	)
}
