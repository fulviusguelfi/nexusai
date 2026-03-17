import { Empty, EmptyRequest } from "@shared/proto/cline/common"
import { GitHubAuthService } from "@/services/auth/GitHubAuthService"
import { Controller } from ".."

/**
 * Signs out of GitHub and clears the stored GitHub session.
 */
export async function githubSignOut(_controller: Controller, _: EmptyRequest): Promise<Empty> {
	await GitHubAuthService.getInstance().signOut()
	return {}
}
