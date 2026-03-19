import { EmptyRequest, StringRequest } from "@shared/proto/cline/common"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { useState } from "react"
import { useClineAuth } from "@/context/ClineAuthContext"
import { AccountServiceClient, WebServiceClient } from "@/services/grpc-client"

export const ClineAccountInfoCard = () => {
	const { clineUser } = useClineAuth()
	const [isLoading, setIsLoading] = useState(false)

	const user = clineUser || undefined

	const handleLogin = () => {
		setIsLoading(true)
		AccountServiceClient.accountLoginClicked(EmptyRequest.create())
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
		WebServiceClient.openInBrowser(StringRequest.create({ value: billingUrl })).catch((err) =>
			console.error("Failed to open Cline billing dashboard:", err),
		)
	}

	return (
		<div className="max-w-[600px] flex flex-wrap gap-2 items-center">
			<VSCodeButton className="mt-0" disabled={isLoading} onClick={handleLogin}>
				{user ? "Refresh Cline session" : "Sign in to Cline"}
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
