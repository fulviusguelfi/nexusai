import { HistoryIcon, PlusIcon, ServerIcon, SettingsIcon } from "lucide-react"
import { useEffect } from "react"
import ChatView from "./components/chat/ChatView"
import HistoryView from "./components/history/HistoryView"
import { AvatarSection, ChatSection, LayoutContainer } from "./components/layout/LayoutContainer"
import McpView from "./components/mcp/configuration/McpConfigurationView"
import OnboardingView from "./components/onboarding/OnboardingView"
import SettingsView from "./components/settings/SettingsView"
import { AvatarOverlay } from "./components/voice/avatar"
import WelcomeView from "./components/welcome/WelcomeView"
import WorktreesView from "./components/worktrees/WorktreesView"
import { useClineAuth } from "./context/ClineAuthContext"
import { useExtensionState } from "./context/ExtensionStateContext"
import { useLayout } from "./context/LayoutContext"
import { useAvatarState } from "./hooks/useAvatarState"
import { useExtensionMessages } from "./hooks/useExtensionMessages"
import { useVoiceAudioPlayer } from "./hooks/useVoiceAudioPlayer"
import { Providers } from "./Providers"
import { trpc } from "./services/trpc-client"

const AppContent = () => {
	const { orientation } = useLayout()
	const avatarState = useAvatarState()
	useVoiceAudioPlayer()
	const {
		didHydrateState,
		showWelcome,
		shouldShowAnnouncement,
		showMcp,
		mcpTab,
		showSettings,
		settingsTargetSection,
		showHistory,
		showWorktrees,
		showAnnouncement,
		onboardingModels,
		setShowAnnouncement,
		setShouldShowAnnouncement,
		closeMcpView,
		navigateToHistory,
		navigateToSettings,
		navigateToMcp,
		navigateToChat,
		hideSettings,
		hideHistory,
		hideWorktrees,
		hideAnnouncement,
	} = useExtensionState()

	useClineAuth()
	useExtensionMessages()

	useEffect(() => {
		if (shouldShowAnnouncement) {
			setShowAnnouncement(true)

			// Use the tRPC client instead of direct WebviewMessage
			trpc.ui.onDidShowAnnouncement
				.mutate({})
				.then((response) => {
					setShouldShowAnnouncement(response.value)
				})
				.catch((error) => {
					console.error("Failed to acknowledge announcement:", error)
				})
		}
	}, [shouldShowAnnouncement, setShouldShowAnnouncement, setShowAnnouncement])

	if (!didHydrateState) {
		return null
	}

	if (showWelcome) {
		return onboardingModels ? <OnboardingView onboardingModels={onboardingModels} /> : <WelcomeView />
	}

	const showingOverlay = showSettings || showHistory || showMcp || showWorktrees

	// Use LayoutContainer only for horizontal layout (editor mode)
	if (orientation === "vertical") {
		return (
			<div className="flex h-screen w-full flex-col relative">
				{showSettings && <SettingsView onDone={hideSettings} targetSection={settingsTargetSection} />}
				{showHistory && <HistoryView onDone={hideHistory} />}
				{showMcp && <McpView initialTab={mcpTab} onDone={closeMcpView} />}
				{showWorktrees && <WorktreesView onDone={hideWorktrees} />}
				{/* Sidebar never shows Chat - that's editor-only */}
				{!showingOverlay && (
					<div className="flex-1 flex items-center justify-center px-4">
						<div className="grid grid-cols-2 gap-3 w-full">
							<button
								className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] hover:bg-[var(--vscode-list-hoverBackground)] cursor-pointer transition-colors aspect-square"
								onClick={() => {
									trpc.task.clearTask
										.mutate({})
										.catch(console.error)
										.finally(() => navigateToChat())
								}}>
								<PlusIcon size={28} strokeWidth={1.5} />
								<span className="text-xs font-medium">New Task</span>
							</button>
							<button
								className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] hover:bg-[var(--vscode-list-hoverBackground)] cursor-pointer transition-colors aspect-square"
								onClick={() => navigateToMcp()}>
								<ServerIcon size={28} strokeWidth={1.5} />
								<span className="text-xs font-medium">MCP Servers</span>
							</button>
							<button
								className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] hover:bg-[var(--vscode-list-hoverBackground)] cursor-pointer transition-colors aspect-square"
								onClick={() => navigateToHistory()}>
								<HistoryIcon size={28} strokeWidth={1.5} />
								<span className="text-xs font-medium">History</span>
							</button>
							<button
								className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] hover:bg-[var(--vscode-list-hoverBackground)] cursor-pointer transition-colors aspect-square"
								onClick={() => navigateToSettings()}>
								<SettingsIcon size={28} strokeWidth={1.5} />
								<span className="text-xs font-medium">Settings</span>
							</button>
						</div>
					</div>
				)}
			</div>
		)
	}

	// EDITOR PANEL MODE (horizontal): Show Chat + Avatar ONLY (NO overlays)
	const shouldUseLayout = orientation === "horizontal"
	const mainContent = (
		<div className="flex h-screen w-full flex-col relative">
			{/* Editor panel never shows overlays - they're sidebar-only */}
			{/* Do not conditionally load ChatView, it's expensive and there's state we don't want to lose */}
			<ChatView
				hideAnnouncement={hideAnnouncement}
				isHidden={false}
				showAnnouncement={showAnnouncement}
				showHistoryView={navigateToHistory}
			/>
		</div>
	)

	return shouldUseLayout ? (
		<LayoutContainer>
			<ChatSection>{mainContent}</ChatSection>
			<AvatarSection>
				{/* Avatar always visible in editor panel (horizontal layout) */}
				<AvatarOverlay
					agentState={avatarState.agentState}
					currentViseme={avatarState.currentViseme}
					isVisible={avatarState.isVisible}
				/>
			</AvatarSection>
		</LayoutContainer>
	) : (
		<div className="flex h-screen w-full flex-col">
			{/* Chat and Avatar are disabled in sidebar — editor panel only */}
			{/* {mainContent} */}
			{/* Avatar only visible when no overlays are open and voice is enabled */}
			{/* {showAvatarOverlay && (
				<AvatarOverlay
					agentState={avatarState.agentState}
					currentViseme={avatarState.currentViseme}
					isVisible={avatarState.isVisible}
				/>
			)} */}
		</div>
	)
}

const App = () => {
	return (
		<Providers>
			<AppContent />
		</Providers>
	)
}

export default App
