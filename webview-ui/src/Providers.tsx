import { HeroUIProvider } from "@heroui/react"
import { type ReactNode } from "react"
import { ClineAuthProvider } from "./context/ClineAuthContext"
import { ExtensionStateContextProvider } from "./context/ExtensionStateContext"
import { GitHubAuthProvider } from "./context/GitHubAuthContext"
import { LayoutProvider } from "./context/LayoutContext"
import { PlatformProvider } from "./context/PlatformContext"

export function Providers({ children }: { children: ReactNode }) {
	return (
		<PlatformProvider>
			<LayoutProvider>
				<ExtensionStateContextProvider>
					<ClineAuthProvider>
						<GitHubAuthProvider>
							<HeroUIProvider>{children}</HeroUIProvider>
						</GitHubAuthProvider>
					</ClineAuthProvider>
				</ExtensionStateContextProvider>
			</LayoutProvider>
		</PlatformProvider>
	)
}
