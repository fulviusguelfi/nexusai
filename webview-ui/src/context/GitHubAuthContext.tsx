import { EmptyRequest } from "@shared/proto/cline/common"
import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { AccountServiceClient } from "@/services/grpc-client"

export interface GitHubUser {
	login?: string
	displayName?: string
	avatarUrl?: string
	email?: string
}

export interface GitHubAuthContextType {
	isSignedIn: boolean
	githubUser: GitHubUser | null
	isSigningIn: boolean
	signIn: () => Promise<boolean>
	signOut: () => Promise<void>
}

export const GitHubAuthContext = createContext<GitHubAuthContextType | undefined>(undefined)

export const GitHubAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [isSignedIn, setIsSignedIn] = useState(false)
	const [githubUser, setGithubUser] = useState<GitHubUser | null>(null)
	const [isSigningIn, setIsSigningIn] = useState(false)

	// Subscribe to GitHub auth state changes from the extension
	useEffect(() => {
		const cancelSubscription = AccountServiceClient.subscribeToGitHubAuthState(EmptyRequest.create(), {
			onResponse: (state) => {
				setIsSignedIn(state.isSignedIn)
				if (state.isSignedIn) {
					setGithubUser({
						login: state.login,
						displayName: state.displayName,
						avatarUrl: state.avatarUrl,
						email: state.email,
					})
				} else {
					setGithubUser(null)
				}
			},
			onError: (error: Error) => {
				console.error("GitHub auth subscription error:", error)
			},
			onComplete: () => {
				console.log("GitHub auth subscription completed")
			},
		})

		return () => cancelSubscription()
	}, [])

	const signIn = async (): Promise<boolean> => {
		setIsSigningIn(true)
		try {
			const state = await AccountServiceClient.githubSignIn(EmptyRequest.create())
			setIsSignedIn(state.isSignedIn)
			if (state.isSignedIn) {
				setGithubUser({
					login: state.login,
					displayName: state.displayName,
					avatarUrl: state.avatarUrl,
					email: state.email,
				})
			}
			return state.isSignedIn
		} catch (error) {
			console.error("GitHub sign-in failed:", error)
			return false
		} finally {
			setIsSigningIn(false)
		}
	}

	const signOut = async () => {
		try {
			await AccountServiceClient.githubSignOut(EmptyRequest.create())
			setIsSignedIn(false)
			setGithubUser(null)
		} catch (error) {
			console.error("GitHub sign-out failed:", error)
		}
	}

	return (
		<GitHubAuthContext.Provider value={{ isSignedIn, githubUser, isSigningIn, signIn, signOut }}>
			{children}
		</GitHubAuthContext.Provider>
	)
}

export const useGitHubAuth = () => {
	const context = useContext(GitHubAuthContext)
	if (context === undefined) {
		throw new Error("useGitHubAuth must be used within a GitHubAuthProvider")
	}
	return context
}
