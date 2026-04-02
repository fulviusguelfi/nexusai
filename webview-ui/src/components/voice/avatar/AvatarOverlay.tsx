import { AnimatePresence, motion } from "framer-motion"
import { AvatarSvg } from "./AvatarSvg"
import type { VisemeLabel } from "./LipSyncController"

export type VoiceAgentState = "IDLE" | "INITIALIZING" | "READY_TO_LISTEN" | "RECORDING" | "PROCESSING" | "PLAYING" | "ERROR"

interface AvatarOverlayProps {
	agentState: VoiceAgentState
	currentViseme: VisemeLabel
	avatarName?: string
	isVisible: boolean
}

const containerVariants = {
	hidden: { opacity: 0, scale: 0.8, y: 20 },
	visible: { opacity: 1, scale: 1, y: 0 },
}

const breathingVariants = {
	IDLE: { scale: [1, 0.98, 1], transition: { duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" } },
	RECORDING: { scale: [1, 0.97, 1.02, 1], transition: { duration: 0.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" } },
	PROCESSING: { scale: 1 },
	PLAYING: { y: [0, -3, 0], transition: { duration: 0.6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" } },
	INITIALIZING: { scale: 1 },
	READY_TO_LISTEN: { scale: [1, 0.99, 1], transition: { duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" } },
	ERROR: { scale: 1 },
}

export function AvatarOverlay({ agentState, currentViseme, avatarName, isVisible }: AvatarOverlayProps) {
	if (!isVisible) return null

	return (
		<AnimatePresence>
			<motion.div
				animate="visible"
				className="flex flex-col items-center justify-center gap-1 select-none w-full h-full p-4"
				data-state={agentState}
				data-testid="avatar-overlay"
				exit="hidden"
				initial="hidden"
				transition={{ duration: 0.3, ease: "easeOut" }}
				variants={containerVariants}>
				{/* Avatar SVG with breathing/state animation */}
				<motion.div
					animate={breathingVariants[agentState] ?? breathingVariants.IDLE}
					className="w-40 h-40 drop-shadow-lg">
					<AvatarSvg agentState={agentState} viseme={currentViseme} />
				</motion.div>

				{/* Avatar name label */}
				{avatarName && (
					<span
						className="text-xs font-medium text-[color:var(--vscode-foreground)] opacity-70 tracking-wide"
						data-testid="avatar-name">
						{avatarName}
					</span>
				)}
			</motion.div>
		</AnimatePresence>
	)
}
