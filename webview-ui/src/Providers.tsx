import { HeroUIProvider } from "@heroui/react"
import { type ReactNode } from "react"
import { ExtensionStateContextProvider } from "./context/ExtensionStateContext"
import { GitHubAuthProvider } from "./context/GitHubAuthContext"
import { NexusAIAuthProvider } from "./context/NexusAIAuthContext"
import { PlatformProvider } from "./context/PlatformContext"

export function Providers({ children }: { children: ReactNode }) {
	return (
		<PlatformProvider>
			<ExtensionStateContextProvider>
				<NexusAIAuthProvider>
					<GitHubAuthProvider>
						<HeroUIProvider>{children}</HeroUIProvider>
					</GitHubAuthProvider>
				</NexusAIAuthProvider>
			</ExtensionStateContextProvider>
		</PlatformProvider>
	)
}
