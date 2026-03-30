import { motion } from "framer-motion"
import type { VisemeLabel } from "./LipSyncController"

interface AvatarSvgProps {
	viseme: VisemeLabel
	agentState: string
}

// Mouth path data for each Rhubarb Hanna-Barbera viseme
// All paths are centered at (0,0) within a 60x30 viewBox area
const MOUTH_PATHS: Record<VisemeLabel, string> = {
	// X — closed / silence
	X: "M-12,0 Q0,-3 12,0",
	// A — neutral / rest (lips slightly apart)
	A: "M-12,0 Q0,2 12,0 Q0,-2 -12,0",
	// B — open mouth medium
	B: "M-12,-4 Q0,8 12,-4",
	// C — small open
	C: "M-10,-2 Q0,5 10,-2",
	// D — wide open
	D: "M-14,-6 Q0,12 14,-6",
	// E — wide / teeth showing
	E: "M-14,-5 L14,-5 Q14,8 0,8 Q-14,8 -14,-5",
	// F — teeth + lower lip (labiodental)
	F: "M-12,-4 L12,-4 M-8,2 Q0,6 8,2",
	// G — narrow rounded
	G: "M-8,-3 Q0,6 8,-3 Q0,-6 -8,-3",
	// H — round pursed
	H: "M-10,-4 Q0,10 10,-4 Q0,-8 -10,-4",
}

export function AvatarSvg({ viseme, agentState }: AvatarSvgProps) {
	const allVisemes: VisemeLabel[] = ["A", "B", "C", "D", "E", "F", "G", "H", "X"]

	return (
		<svg aria-label="NexusAI avatar" fill="none" role="img" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
			{/* Head background */}
			<circle cx="100" cy="100" fill="#0f3460" r="90" />
			<circle cx="100" cy="100" fill="none" r="90" stroke="#1a1a2e" strokeWidth="4" />

			{/* Left eye */}
			<motion.ellipse
				animate={
					agentState === "ERROR"
						? { scaleY: 0.4 }
						: agentState === "PROCESSING"
							? { x: [-5, 5, -5] }
							: { scaleY: [1, 1, 0.05, 1] }
				}
				cx="72"
				cy="85"
				fill="#e94560"
				rx="10"
				ry="12"
				transition={
					agentState === "PROCESSING"
						? { duration: 0.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
						: { duration: 4, repeat: Number.POSITIVE_INFINITY, repeatDelay: 3, ease: "easeInOut" }
				}
			/>

			{/* Right eye */}
			<motion.ellipse
				animate={
					agentState === "ERROR"
						? { scaleY: 0.4 }
						: agentState === "PROCESSING"
							? { x: [-5, 5, -5] }
							: { scaleY: [1, 1, 0.05, 1] }
				}
				cx="128"
				cy="85"
				fill="#e94560"
				rx="10"
				ry="12"
				transition={
					agentState === "PROCESSING"
						? { duration: 0.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut", delay: 0 }
						: { duration: 4, repeat: Number.POSITIVE_INFINITY, repeatDelay: 3, ease: "easeInOut" }
				}
			/>

			{/* Left eyebrow */}
			<motion.path
				animate={agentState === "RECORDING" ? { y: -4 } : { y: 0 }}
				d="M58,65 Q72,60 86,65"
				stroke="#e94560"
				strokeLinecap="round"
				strokeWidth="3"
				transition={{ duration: 0.2 }}
			/>

			{/* Right eyebrow */}
			<motion.path
				animate={agentState === "RECORDING" ? { y: -4 } : { y: 0 }}
				d="M114,65 Q128,60 142,65"
				stroke="#e94560"
				strokeLinecap="round"
				strokeWidth="3"
				transition={{ duration: 0.2 }}
			/>

			{/* Mouth group — only the active viseme is visible */}
			<g transform="translate(100, 130)">
				{allVisemes.map((v) => (
					<g
						data-active={v === viseme ? "true" : "false"}
						data-testid={`mouth-${v}`}
						key={v}
						style={{ display: v === viseme ? "block" : "none" }}>
						<path
							d={MOUTH_PATHS[v]}
							fill={v === "E" || v === "F" ? "#1a1a2e" : "none"}
							stroke="#e94560"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="3"
						/>
					</g>
				))}
			</g>
		</svg>
	)
}
