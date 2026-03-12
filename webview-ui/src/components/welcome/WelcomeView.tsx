import { BooleanRequest, EmptyRequest } from "@shared/proto/cline/common"
import { VSCodeButton, VSCodeDivider, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { memo, useEffect, useRef, useState } from "react"
import ClineLogoWhite from "@/assets/ClineLogoWhite"
import ApiOptions from "@/components/settings/ApiOptions"
import { useApiConfigurationHandlers } from "@/components/settings/utils/useApiConfigurationHandlers"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useGitHubAuth } from "@/context/GitHubAuthContext"
import { AccountServiceClient, StateServiceClient } from "@/services/grpc-client"
import { validateApiConfiguration } from "@/utils/validate"

const WelcomeView = memo(() => {
	const { apiConfiguration, mode } = useExtensionState()
	const { isSignedIn: isGitHubSignedIn, githubUser, isSigningIn, signIn: githubSignIn } = useGitHubAuth()
	const { handleFieldsChange } = useApiConfigurationHandlers()
	const [apiErrorMessage, setApiErrorMessage] = useState<string | undefined>(undefined)
	const [showApiOptions, setShowApiOptions] = useState(false)
	const [isClineLoading, setIsClineLoading] = useState(false)
	// Track whether we triggered a GitHub sign-in from this view
	const pendingGitHubComplete = useRef(false)

	const disableLetsGoButton = apiErrorMessage != null

	const handleGitHubCopilotConnect = async () => {
		pendingGitHubComplete.current = true
		await githubSignIn()
	}

	// Once GitHub sign-in completes (after user clicked the button), configure vscode-lm and close welcome
	useEffect(() => {
		if (pendingGitHubComplete.current && isGitHubSignedIn && !isSigningIn) {
			pendingGitHubComplete.current = false
			completeWithVsCodeLm()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isGitHubSignedIn, isSigningIn])

	const completeWithVsCodeLm = async () => {
		try {
			await handleFieldsChange({
				planModeApiProvider: "vscode-lm",
				actModeApiProvider: "vscode-lm",
			})
			await StateServiceClient.setWelcomeViewCompleted(BooleanRequest.create({ value: true }))
		} catch (error) {
			console.error("Failed to configure GitHub Copilot provider:", error)
		}
	}

	const handleClineLogin = () => {
		setIsClineLoading(true)
		AccountServiceClient.accountLoginClicked(EmptyRequest.create())
			.catch((err) => console.error("Failed to get login URL:", err))
			.finally(() => setIsClineLoading(false))
	}

	const handleSubmit = async () => {
		try {
			await StateServiceClient.setWelcomeViewCompleted(BooleanRequest.create({ value: true }))
		} catch (error) {
			console.error("Failed to update API configuration or complete welcome view:", error)
		}
	}

	useEffect(() => {
		setApiErrorMessage(validateApiConfiguration(mode, apiConfiguration))
	}, [apiConfiguration, mode])

	return (
		<div className="fixed inset-0 p-0 flex flex-col">
			<div className="h-full px-5 overflow-auto flex flex-col gap-3">
				{/* Header */}
				<div className="flex flex-col items-center gap-2 mt-6 mb-2">
					<ClineLogoWhite className="size-12" />
					<h2 className="text-lg font-semibold m-0">Welcome to NexusAI</h2>
					<p className="text-(--vscode-descriptionForeground) text-sm text-center m-0">
						Your AI coding assistant. Connect GitHub Copilot to get started instantly.
					</p>
				</div>

				{/* Primary: GitHub Copilot */}
				<div className="flex flex-col gap-2 mt-2">
					{isGitHubSignedIn && githubUser ? (
						<div className="flex items-center gap-2 p-3 rounded border border-(--vscode-panel-border) bg-(--vscode-editor-background)">
							<span className="codicon codicon-github text-lg" />
							<div className="flex flex-col min-w-0">
								<span className="text-sm font-medium truncate">
									Connected as {githubUser.displayName || githubUser.login}
								</span>
								<span className="text-xs text-(--vscode-descriptionForeground)">GitHub Copilot active</span>
							</div>
						</div>
					) : (
						<VSCodeButton
							appearance="primary"
							className="w-full"
							disabled={isSigningIn}
							onClick={handleGitHubCopilotConnect}>
							<span className="codicon codicon-github mr-1" />
							{isSigningIn ? "Connecting…" : "Connect GitHub Copilot"}
							{isSigningIn && <span className="ml-1 animate-spin codicon codicon-refresh" />}
						</VSCodeButton>
					)}

					<p className="text-xs text-(--vscode-descriptionForeground) text-center m-0">
						Uses your{" "}
						<VSCodeLink className="inline text-xs" href="https://github.com/features/copilot">
							GitHub Copilot
						</VSCodeLink>{" "}
						subscription — no extra API key needed
					</p>
				</div>

				<VSCodeDivider className="my-1" />

				{/* Secondary: Cline account */}
				<div className="flex flex-col gap-2">
					<p className="text-xs text-(--vscode-descriptionForeground) text-center m-0">
						Or sign in to your{" "}
						<VSCodeLink className="inline text-xs" href="https://cline.bot">
							Cline account
						</VSCodeLink>{" "}
						to use Cline's free tier and frontier models
					</p>
					<VSCodeButton appearance="secondary" className="w-full" disabled={isClineLoading} onClick={handleClineLogin}>
						{isClineLoading ? "Opening browser…" : "Sign in to Cline"}
						{isClineLoading && <span className="ml-1 animate-spin codicon codicon-refresh" />}
					</VSCodeButton>
				</div>

				{/* Tertiary: BYOK */}
				{!showApiOptions && (
					<VSCodeButton appearance="secondary" className="w-full" onClick={() => setShowApiOptions(true)}>
						Use your own API key
					</VSCodeButton>
				)}

				{showApiOptions && (
					<div className="mt-1">
						<ApiOptions currentMode={mode} showModelOptions={false} />
						<VSCodeButton className="mt-1" disabled={disableLetsGoButton} onClick={handleSubmit}>
							Let's go!
						</VSCodeButton>
					</div>
				)}
			</div>
		</div>
	)
})

export default WelcomeView
