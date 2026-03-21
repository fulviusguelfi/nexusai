import { Mode } from "@shared/storage/types"
import { NexusAIAccountInfoCard } from "../NexusAIAccountInfoCard"
import NexusAIModelPicker from "../NexusAIModelPicker"

/**
 * Props for the NexusAIProvider component
 */
interface NexusAIProviderProps {
	showModelOptions: boolean
	isPopup?: boolean
	currentMode: Mode
	initialModelTab?: "recommended" | "free"
}

/**
 * The Cline provider configuration component
 */
export const NexusAIProvider = ({ showModelOptions, isPopup, currentMode, initialModelTab }: NexusAIProviderProps) => {
	return (
		<div>
			{/* Cline Account Info Card */}
			<div style={{ marginBottom: 14, marginTop: 4 }}>
				<NexusAIAccountInfoCard />
			</div>

			{showModelOptions && (
				<>
					<NexusAIModelPicker
						currentMode={currentMode}
						initialTab={initialModelTab}
						isPopup={isPopup}
						showProviderRouting={true}
					/>
				</>
			)}
		</div>
	)
}
