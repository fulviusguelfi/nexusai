import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { VoiceAgentState } from "../AvatarOverlay"
import { AvatarOverlay } from "../AvatarOverlay"
import type { VisemeLabel } from "../LipSyncController"

const defaultProps = {
	agentState: "IDLE" as VoiceAgentState,
	currentViseme: "X" as VisemeLabel,
	avatarName: undefined as string | undefined,
	isVisible: true,
}

describe("AvatarOverlay", () => {
	it("renders null when isVisible=false", () => {
		const { container } = render(<AvatarOverlay {...defaultProps} isVisible={false} />)
		expect(container.firstChild).toBeNull()
	})

	it("renders SVG when isVisible=true", () => {
		render(<AvatarOverlay {...defaultProps} isVisible={true} />)
		expect(screen.getByRole("img", { hidden: true })).toBeInTheDocument()
	})

	it("applies idle data-state when agentState=IDLE", () => {
		render(<AvatarOverlay {...defaultProps} agentState="IDLE" />)
		const overlay = screen.getByTestId("avatar-overlay")
		expect(overlay).toHaveAttribute("data-state", "IDLE")
	})

	it("applies recording data-state when agentState=RECORDING", () => {
		render(<AvatarOverlay {...defaultProps} agentState="RECORDING" />)
		const overlay = screen.getByTestId("avatar-overlay")
		expect(overlay).toHaveAttribute("data-state", "RECORDING")
	})

	it("applies playing data-state when agentState=PLAYING", () => {
		render(<AvatarOverlay {...defaultProps} agentState="PLAYING" currentViseme="B" />)
		const overlay = screen.getByTestId("avatar-overlay")
		expect(overlay).toHaveAttribute("data-state", "PLAYING")
	})

	it("displays avatarName label when provided", () => {
		render(<AvatarOverlay {...defaultProps} avatarName="Nexus" />)
		expect(screen.getByText("Nexus")).toBeInTheDocument()
	})

	it("does not display name label when avatarName is not provided", () => {
		render(<AvatarOverlay {...defaultProps} avatarName={undefined} />)
		expect(screen.queryByTestId("avatar-name")).not.toBeInTheDocument()
	})

	const visemes: VisemeLabel[] = ["A", "B", "C", "D", "E", "F", "G", "H", "X"]
	for (const viseme of visemes) {
		it(`shows correct viseme group for viseme "${viseme}"`, () => {
			render(<AvatarOverlay {...defaultProps} agentState="PLAYING" currentViseme={viseme} />)
			const visemeGroup = screen.getByTestId(`mouth-${viseme}`)
			expect(visemeGroup).toBeInTheDocument()
			// All other viseme groups should be hidden
			const allGroups = screen.getAllByTestId(/^mouth-/)
			const visibleGroups = allGroups.filter((el) => el.getAttribute("data-active") === "true")
			expect(visibleGroups).toHaveLength(1)
			expect(visibleGroups[0]).toHaveAttribute("data-testid", `mouth-${viseme}`)
		})
	}

	it("snapshot: IDLE state", () => {
		const { container } = render(<AvatarOverlay {...defaultProps} agentState="IDLE" />)
		expect(container).toMatchSnapshot()
	})

	it("snapshot: PLAYING state with viseme B", () => {
		const { container } = render(<AvatarOverlay {...defaultProps} agentState="PLAYING" currentViseme="B" />)
		expect(container).toMatchSnapshot()
	})
})
