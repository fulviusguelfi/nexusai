import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { useState } from "react"
import { useClineAuth } from "@/context/ClineAuthContext"
import { trpc } from "@/services/trpc-client"

export const ClineAccountInfoCard = () => {
	const { clineUser } = useClineAuth()
	const [isLoading, setIsLoading] = useState(false)

	const user = clineUser || undefined

	const handleLogin = () => {
		setIsLoading(true)
		trpc.account.accountLoginClicked
			.mutate({})
			.catch((err) => console.error("Failed to get login URL:", err))
			.finally(() => {
				setIsLoading(false)
			})
	}

	const handleOpenBilling = () => {
		if (!user) {
			handleLogin()
			return
		}

		const billingUrl = "https://app.cline.bot/dashboard"
		trpc.web.openInBrowser
			.mutate({ value: billingUrl })
			.catch((err) => console.error("Failed to open Cline billing dashboard:", err))
	}

	return (
		<div className="max-w-[600px] flex flex-wrap gap-2 items-center">
			<VSCodeButton className="mt-0" disabled={isLoading} onClick={handleLogin}>
				{user ? "Refresh NexusAI session" : "Sign in to NexusAI"}
				{isLoading && (
					<span className="ml-1 animate-spin">
						<span className="codicon codicon-refresh" />
					</span>
				)}
			</VSCodeButton>
			<VSCodeButton appearance="secondary" disabled={isLoading} onClick={handleOpenBilling}>
				View Billing & Usage
			</VSCodeButton>
		</div>
	)
}
