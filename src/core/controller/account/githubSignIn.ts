import { GitHubAuthState } from "@shared/proto/nexusai/account"
import { EmptyRequest } from "@shared/proto/nexusai/common"
import { GitHubAuthService } from "@/services/auth/GitHubAuthService"
import { Controller } from ".."

/**
 * Handles GitHub sign-in via VS Code's built-in GitHub authentication provider.
 * Supports web browser OAuth, passkeys, GitHub mobile app, and PATs —
 * all handled transparently by VS Code.
 */
export async function githubSignIn(_controller: Controller, _: EmptyRequest): Promise<GitHubAuthState> {
	return GitHubAuthService.getInstance().signIn()
}
