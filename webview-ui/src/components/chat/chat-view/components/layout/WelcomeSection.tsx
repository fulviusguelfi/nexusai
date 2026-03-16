import { EmptyRequest } from "@shared/proto/cline/common"
import type { Worktree } from "@shared/proto/cline/worktree"
import { TrackWorktreeViewOpenedRequest } from "@shared/proto/cline/worktree"
import { GitBranch } from "lucide-react"
import React, { useCallback, useEffect, useState } from "react"
import WhatsNewModal from "@/components/common/WhatsNewModal"
import HistoryPreview from "@/components/history/HistoryPreview"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import HomeHeader from "@/components/welcome/HomeHeader"
import { SuggestedTasks } from "@/components/welcome/SuggestedTasks"
import CreateWorktreeModal from "@/components/worktrees/CreateWorktreeModal"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { WorktreeServiceClient } from "@/services/grpc-client"
import { WelcomeSectionProps } from "../../types/chatTypes"

/**
 * Welcome section shown when there's no active task
 * Includes info banner, announcements, home header, and history preview
 */
export const WelcomeSection: React.FC<WelcomeSectionProps> = ({
	showAnnouncement,
	hideAnnouncement,
	showHistoryView,
	version,
	taskHistory,
	shouldShowQuickWins,
}) => {
	// Track if we've shown the "What's New" modal this session
	const [hasShownWhatsNewModal, setHasShownWhatsNewModal] = useState(false)
	const [showWhatsNewModal, setShowWhatsNewModal] = useState(false)

	// Quick launch worktree modal
	const [showCreateWorktreeModal, setShowCreateWorktreeModal] = useState(false)
	const [isGitRepo, setIsGitRepo] = useState<boolean | null>(null)
	const [currentWorktree, setCurrentWorktree] = useState<Worktree | null>(null)

	// Check if we're in a git repo and get current worktree info on mount
	useEffect(() => {
		WorktreeServiceClient.listWorktrees(EmptyRequest.create({}))
			.then((result) => {
				const canUseWorktrees = result.isGitRepo && !result.isMultiRoot && !result.isSubfolder
				setIsGitRepo(canUseWorktrees)
				if (canUseWorktrees) {
					const current = result.worktrees.find((w) => w.isCurrent)
					setCurrentWorktree(current || null)
				}
			})
			.catch(() => setIsGitRepo(false))
	}, [])

	const { navigateToWorktrees, worktreesEnabled } = useExtensionState()

	// Show modal when there's a new announcement and we haven't shown it this session.
	useEffect(() => {
		if (showAnnouncement && !hasShownWhatsNewModal) {
			setShowWhatsNewModal(true)
			setHasShownWhatsNewModal(true)
		}
	}, [showAnnouncement, hasShownWhatsNewModal])

	const handleCloseWhatsNewModal = useCallback(() => {
		setShowWhatsNewModal(false)
		hideAnnouncement()
	}, [hideAnnouncement])

	// Handle click on home page worktree element with telemetry
	const handleWorktreeClick = useCallback(() => {
		WorktreeServiceClient.trackWorktreeViewOpened(TrackWorktreeViewOpenedRequest.create({ source: "home_page" })).catch(
			console.error,
		)
		navigateToWorktrees()
	}, [navigateToWorktrees])

	return (
		<div className="flex flex-col flex-1 w-full h-full p-0 m-0">
			<WhatsNewModal onClose={handleCloseWhatsNewModal} open={showWhatsNewModal} version={version} />
			<div className="overflow-y-auto flex flex-col pb-2.5">
				<HomeHeader shouldShowQuickWins={shouldShowQuickWins} />
				{!showWhatsNewModal && (
					<>
						{!shouldShowQuickWins && taskHistory.length > 0 && <HistoryPreview showHistoryView={showHistoryView} />}
						{/* Quick launch worktree button */}
						{isGitRepo && worktreesEnabled?.featureFlag && worktreesEnabled?.user && (
							<div className="flex flex-col items-center gap-3 mt-2 mb-4 px-5">
								{/* TODO: Re-enable once worktree creation is stable
								<Tooltip>
									<TooltipTrigger asChild>
										<button
											className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--vscode-foreground)]/30 text-[var(--vscode-foreground)] bg-transparent hover:bg-[var(--vscode-list-hoverBackground)] active:opacity-80 text-sm font-medium cursor-pointer"
											onClick={() => setShowCreateWorktreeModal(true)}
											type="button">
											<span className="codicon codicon-empty-window"></span>
											New Worktree Window
										</button>
									</TooltipTrigger>
									<TooltipContent side="top">
										Create a new git worktree and open it in a separate window. Great for running parallel
										Cline tasks.
									</TooltipContent>
								</Tooltip>
								*/}
								{currentWorktree && (
									<Tooltip>
										<TooltipTrigger asChild>
											<button
												className="flex flex-col items-center gap-0.5 text-xs text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)] cursor-pointer bg-transparent border-none p-1 rounded"
												onClick={handleWorktreeClick}
												type="button">
												<div className="flex items-center gap-1.5 text-xs">
													<GitBranch className="w-3 h-3 stroke-[2.5] flex-shrink-0" />
													<span className="break-all text-center">
														<span className="font-semibold">Current:</span>{" "}
														{currentWorktree.branch || "detached HEAD"}
													</span>
												</div>
												<span className="break-all text-center max-w-[300px]">
													{currentWorktree.path}
												</span>
											</button>
										</TooltipTrigger>
										<TooltipContent side="bottom">
											View and manage git worktrees. Great for running parallel Cline tasks.
										</TooltipContent>
									</Tooltip>
								)}
							</div>
						)}
					</>
				)}
			</div>
			<SuggestedTasks shouldShowQuickWins={shouldShowQuickWins} />

			{/* Quick launch worktree modal */}
			<CreateWorktreeModal
				onClose={() => setShowCreateWorktreeModal(false)}
				open={showCreateWorktreeModal}
				openAfterCreate={true}
			/>
		</div>
	)
}
