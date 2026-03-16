import { HeroUIProvider } from "@heroui/react"
import { type ReactNode } from "react"
import { ClineAuthProvider } from "./context/ClineAuthContext"
import { ExtensionStateContextProvider } from "./context/ExtensionStateContext"
import { GitHubAuthProvider } from "./context/GitHubAuthContext"
import { PlatformProvider } from "./context/PlatformContext"

export function Providers({ children }: { children: ReactNode }) {
	return (
		<PlatformProvider>
			<ExtensionStateContextProvider>
				<ClineAuthProvider>
					<GitHubAuthProvider>
						<HeroUIProvider>{children}</HeroUIProvider>
					</GitHubAuthProvider>
				</ClineAuthProvider>
			</ExtensionStateContextProvider>
		</PlatformProvider>
	)
}
