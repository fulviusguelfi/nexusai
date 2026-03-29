import { TrashIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { trpc } from "@/services/trpc-client"
import { formatSize } from "@/utils/format"

const DeleteTaskButton: React.FC<{
	taskId?: string
	taskSize?: number
	className?: string
}> = ({ taskId, className, taskSize }) => (
	<Tooltip>
		<TooltipContent>{`Delete Task (size: ${taskSize ? formatSize(taskSize) : "--"})`}</TooltipContent>
		<TooltipTrigger className={cn("flex items-center", className)}>
			<Button
				aria-label="Delete Task"
				disabled={!taskId}
				onClick={(e) => {
					e.preventDefault()
					e.stopPropagation()
					taskId && trpc.task.deleteTasksWithIds.mutate({ value: [taskId] })
				}}
				size="xs"
				variant="icon">
				<TrashIcon />
			</Button>
		</TooltipTrigger>
	</Tooltip>
)
DeleteTaskButton.displayName = "DeleteTaskButton"

export default DeleteTaskButton
