import { ArrowDownToLineIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { trpc } from "@/services/trpc-client"

const OpenDiskConversationHistoryButton: React.FC<{
	taskId?: string
	className?: string
}> = ({ taskId, className }) => {
	const handleOpenDiskConversationHistory = () => {
		if (!taskId) {
			return
		}

		trpc.file.openDiskConversationHistory.mutate({ value: taskId }).catch((err) => {
			console.error(err)
		})
	}

	return (
		<Tooltip>
			<TooltipContent>Open Conversation History File</TooltipContent>
			<TooltipTrigger className={cn("flex items-center", className)}>
				<Button
					aria-label="Open Disk Conversation History"
					onClick={(e) => {
						e.preventDefault()
						e.stopPropagation()
						handleOpenDiskConversationHistory()
					}}
					size="icon"
					variant="icon">
					<ArrowDownToLineIcon />
				</Button>
			</TooltipTrigger>
		</Tooltip>
	)
}

OpenDiskConversationHistoryButton.displayName = "OpenDiskConversationHistoryButton"
export default OpenDiskConversationHistoryButton
