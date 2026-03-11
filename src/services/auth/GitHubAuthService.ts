import { GitHubAuthState } from "@shared/proto/cline/account"
import { EmptyRequest } from "@shared/proto/cline/common"
import * as vscode from "vscode"
import { Controller } from "@/core/controller"
import { getRequestRegistry, StreamingResponseHandler } from "@/core/controller/grpc-handler"
import { Logger } from "@/shared/services/Logger"

const GITHUB_AUTH_PROVIDER_ID = "github"
const GITHUB_SCOPES = ["read:user"]

/**
 * Singleton service managing GitHub authentication state via VS Code's
 * built-in GitHub authentication provider.
 *
 * Supports: web browser OAuth, passkeys, GitHub mobile app, and PATs —
 * all handled transparently by VS Code itself.
 */
export class GitHubAuthService {
	private static _instance: GitHubAuthService | undefined

	private _session: vscode.AuthenticationSession | undefined
	private _activeHandlers = new Set<StreamingResponseHandler<GitHubAuthState>>()
	private _sessionChangeDisposable: vscode.Disposable | undefined

	private constructor() {
		// Listen for GitHub session changes (sign in / sign out in VS Code globally)
		this._sessionChangeDisposable = vscode.authentication.onDidChangeSessions(async (e) => {
			if (e.provider.id === GITHUB_AUTH_PROVIDER_ID) {
				await this._refreshSession()
			}
		})
	}

	static getInstance(): GitHubAuthService {
		if (!GitHubAuthService._instance) {
			GitHubAuthService._instance = new GitHubAuthService()
		}
		return GitHubAuthService._instance
	}

	/** Sign in via VS Code GitHub auth flow (browser, passkey, mobile, PAT). */
	async signIn(): Promise<GitHubAuthState> {
		try {
			const session = await vscode.authentication.getSession(GITHUB_AUTH_PROVIDER_ID, GITHUB_SCOPES, {
				createIfNone: true,
			})
			this._session = session
			const state = this.buildState(session)
			await this._broadcastState(state)
			return state
		} catch (error) {
			Logger.log("[GitHubAuthService] Sign-in cancelled or failed:", error)
			return { isSignedIn: false }
		}
	}

	/** Sign out of GitHub. */
	async signOut(): Promise<void> {
		this._session = undefined
		await this._broadcastState({ isSignedIn: false })
	}

	/** Return current auth state without triggering a sign-in prompt. */
	getState(): GitHubAuthState {
		if (this._session) {
			return this.buildState(this._session)
		}
		return { isSignedIn: false }
	}

	/** Check for an existing session silently (no UI). */
	async refreshSilently(): Promise<void> {
		await this._refreshSession()
	}

	/**
	 * Subscribe to GitHub auth state changes.
	 * Sends the current state immediately, then streams updates.
	 */
	async subscribe(
		_controller: Controller,
		_request: EmptyRequest,
		responseStream: StreamingResponseHandler<GitHubAuthState>,
		requestId?: string,
	): Promise<void> {
		this._activeHandlers.add(responseStream)

		const cleanup = () => {
			this._activeHandlers.delete(responseStream)
		}
		if (requestId) {
			getRequestRegistry().registerRequest(requestId, cleanup, { type: "githubAuthState_subscription" }, responseStream)
		}

		// Send current state immediately
		try {
			await responseStream(this.getState(), false)
		} catch (err) {
			Logger.error("[GitHubAuthService] Error sending initial GitHub auth state:", err)
			this._activeHandlers.delete(responseStream)
		}
	}

	private buildState(session: vscode.AuthenticationSession): GitHubAuthState {
		return {
			isSignedIn: true,
			displayName: session.account.label,
			login: session.account.label,
		}
	}

	private async _refreshSession(): Promise<void> {
		try {
			const session = await vscode.authentication.getSession(GITHUB_AUTH_PROVIDER_ID, GITHUB_SCOPES, {
				createIfNone: false,
				silent: true,
			})
			this._session = session ?? undefined
		} catch {
			this._session = undefined
		}
		await this._broadcastState(this.getState())
	}

	private async _broadcastState(state: GitHubAuthState): Promise<void> {
		const sends = Array.from(this._activeHandlers).map(async (handler) => {
			try {
				await handler(state, false)
			} catch (err) {
				Logger.error("[GitHubAuthService] Error broadcasting GitHub auth state:", err)
				this._activeHandlers.delete(handler)
			}
		})
		await Promise.all(sends)
	}

	dispose(): void {
		this._sessionChangeDisposable?.dispose()
		GitHubAuthService._instance = undefined
	}
}
