import React from "react"
import { useLayout } from "@/context/LayoutContext"
import "./LayoutToggle.css"

/**
 * LayoutToggle button allows switching between horizontal and vertical orientations
 * Displays in header or toolbar areas
 */
export const LayoutToggle: React.FC = () => {
	const { orientation, setOrientation } = useLayout()

	const toggle = () => {
		const newOrientation = orientation === "horizontal" ? "vertical" : "horizontal"
		setOrientation(newOrientation)
	}

	const title =
		orientation === "horizontal"
			? "Switch to vertical layout (chat top, avatar bottom)"
			: "Switch to horizontal layout (chat left, avatar right)"

	return (
		<button
			aria-label="Toggle layout orientation"
			aria-pressed={orientation === "horizontal" ? "true" : "false"}
			className="layout-toggle-btn"
			onClick={toggle}
			title={title}>
			{orientation === "horizontal" ? (
				// Icon for horizontal: left-right arrows
				<svg fill="none" height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg">
					<path
						d="M2 8H14M2 8L6 4M2 8L6 12"
						stroke="currentColor"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth="1.5"
					/>
					<path
						d="M14 8L10 4M14 8L10 12"
						stroke="currentColor"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth="1.5"
					/>
				</svg>
			) : (
				// Icon for vertical: up-down arrows
				<svg fill="none" height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg">
					<path
						d="M8 2V14M8 2L4 6M8 2L12 6"
						stroke="currentColor"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth="1.5"
					/>
					<path
						d="M8 14L4 10M8 14L12 10"
						stroke="currentColor"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth="1.5"
					/>
				</svg>
			)}
		</button>
	)
}
