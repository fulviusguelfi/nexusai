import "../../../node_modules/@vscode/codicons/dist/codicon.css"
import "../../../node_modules/@vscode/codicons/dist/codicon.ttf"
import "../../src/index.css"

import { cn } from "@heroui/react"
import type { Decorator } from "@storybook/react-vite"
import React from "react"
import {
	ExtensionStateContext,
	ExtensionStateContextProvider,
	ExtensionStateContextType,
	useExtensionState,
} from "@/context/ExtensionStateContext"
import { NexusAIAuthContext, NexusAIAuthContextType, NexusAIAuthProvider, useClineAuth } from "@/context/NexusAIAuthContext"
import { StorybookThemes } from "../../.storybook/themes"

// Component that handles theme switching
const ThemeHandler: React.FC<{ children: React.ReactNode; theme?: string }> = ({ children, theme }) => {
	React.useEffect(() => {
		const styles = theme?.includes("light") ? StorybookThemes.light : StorybookThemes.dark

		// Apply CSS variables to the document root
		const root = document.documentElement
		Object.entries(styles).forEach(([property, value]) => {
			root.style.setProperty(property, value)
		})

		document.body.style.backgroundColor = styles["--vscode-editor-background"]
		document.body.style.color = styles["--vscode-editor-foreground"]
		document.body.style.fontFamily = styles["--vscode-font-family"]
		document.body.style.fontSize = styles["--vscode-font-size"]

		return () => {
			// Cleanup on unmount
			Object.keys(styles).forEach((property) => {
				root.style.removeProperty(property)
			})
		}
	}, [theme])

	return <>{children}</>
}
function StorybookDecoratorProvider(className = "relative"): Decorator {
	return (story, parameters) => {
		return (
			<div className={className}>
				<ExtensionStateContextProvider>
					<NexusAIAuthProvider>
						<ThemeHandler theme={parameters?.globals?.theme}>{React.createElement(story)}</ThemeHandler>
					</NexusAIAuthProvider>
				</ExtensionStateContextProvider>
			</div>
		)
	}
}

// Wrapper component to safely use useExtensionState inside the provider
const ExtensionStateProviderWithOverrides: React.FC<{
	overrides?: Partial<ExtensionStateContextType>
	children: React.ReactNode
}> = ({ overrides, children }) => {
	const extensionState = useExtensionState()
	return <ExtensionStateContext.Provider value={{ ...extensionState, ...overrides }}>{children}</ExtensionStateContext.Provider>
}

const NexusAIAuthProviderWithOverrides: React.FC<{
	overrides?: Partial<NexusAIAuthContextType>
	children: React.ReactNode
}> = ({ overrides, children }) => {
	const authContext = useClineAuth()
	return <NexusAIAuthContext.Provider value={{ ...authContext, ...overrides }}>{children}</NexusAIAuthContext.Provider>
}

export const createStorybookDecorator =
	(overrideStates?: Partial<ExtensionStateContextType>, classNames?: string, authOverrides?: Partial<NexusAIAuthContextType>) =>
	(Story: any) => (
		<ExtensionStateProviderWithOverrides overrides={overrideStates}>
			<NexusAIAuthProviderWithOverrides overrides={authOverrides}>
				<div className={cn("max-w-lg mx-auto", classNames)}>
					<Story />
				</div>
			</NexusAIAuthProviderWithOverrides>
		</ExtensionStateProviderWithOverrides>
	)

export const StorybookWebview = StorybookDecoratorProvider()
