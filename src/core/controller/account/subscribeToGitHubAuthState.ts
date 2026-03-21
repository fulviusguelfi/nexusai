import { GitHubAuthState } from "@shared/proto/nexusai/account"
import { EmptyRequest } from "@shared/proto/nexusai/common"
import { StreamingResponseHandler } from "@/core/controller/grpc-handler"
import { GitHubAuthService } from "@/services/auth/GitHubAuthService"
import { Controller } from ".."

/**
 * Subscribes to GitHub auth state changes.
 * Sends the current state immediately, then broadcasts whenever the state changes.
 */
export async function subscribeToGitHubAuthState(
	controller: Controller,
	request: EmptyRequest,
	responseStream: StreamingResponseHandler<GitHubAuthState>,
	requestId?: string,
): Promise<void> {
	return GitHubAuthService.getInstance().subscribe(controller, request, responseStream, requestId)
}
