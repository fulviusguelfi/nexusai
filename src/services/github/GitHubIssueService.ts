import { fetch } from "@/shared/net"
import { Logger } from "@/shared/services/Logger"

export interface GitHubIssue {
	number: number
	html_url: string
	title: string
}

/**
 * Creates GitHub issues via the REST API using a user-supplied access token.
 * Uses `fetch` from `@/shared/net` as required by network.md conventions.
 */
export class GitHubIssueService {
	private static readonly API_BASE = "https://api.github.com"

	/**
	 * Create an issue on the given repository.
	 *
	 * @param token    GitHub access token with `public_repo` or `repo` scope
	 * @param owner    Repository owner/organization
	 * @param repo     Repository name
	 * @param title    Issue title
	 * @param body     Issue body (Markdown)
	 * @param labels   Optional label strings
	 */
	static async createIssue(
		token: string,
		owner: string,
		repo: string,
		title: string,
		body: string,
		labels: string[] = [],
	): Promise<GitHubIssue> {
		const url = `${GitHubIssueService.API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`

		const response = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github+json",
				"Content-Type": "application/json",
				"X-GitHub-Api-Version": "2022-11-28",
			},
			body: JSON.stringify({ title, body, labels }),
		})

		if (!response.ok) {
			const errorText = await response.text().catch(() => "")
			Logger.error(`[GitHubIssueService] API error ${response.status}: ${errorText}`)
			throw new Error(`GitHub API error ${response.status}: ${response.statusText}`)
		}

		return (await response.json()) as GitHubIssue
	}
}
