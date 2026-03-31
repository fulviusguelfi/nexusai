import React from "react"
import { useLayout } from "@/context/LayoutContext"
import "./LayoutContainer.css"

interface LayoutContainerProps {
	children: React.ReactNode
}

/**
 * LayoutContainer wraps the entire chat + avatar layout and provides
 * responsive flexbox layout with support for horizontal and vertical orientations.
 *
 * Horizontal: chat (flex-1) + avatar section (fixed width)
 * Vertical: chat (flex-1) + avatar section (fixed height)
 */
export const LayoutContainer: React.FC<LayoutContainerProps> = ({ children }) => {
	const { orientation } = useLayout()

	return (
		<div className={`layout-container layout-${orientation}`} data-orientation={orientation}>
			{children}
		</div>
	)
}

interface LayoutSectionProps {
	className?: string
	children: React.ReactNode
}

/**
 * ChatSection wrapper - takes flex-1 space
 */
export const ChatSection: React.FC<LayoutSectionProps> = ({ className, children }) => {
	return <div className={`layout-section chat-section ${className || ""}`}>{children}</div>
}

/**
 * AvatarSection wrapper - constrained size, adapts based on orientation
 */
export const AvatarSection: React.FC<LayoutSectionProps> = ({ className, children }) => {
	return <div className={`layout-section avatar-section ${className || ""}`}>{children}</div>
}
