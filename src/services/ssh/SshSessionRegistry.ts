/**
 * Module-level registry of active SSH client connections, keyed by taskId.
 * SSH tool handlers store/retrieve their connection via this registry so that
 * state persists across multiple tool calls within the same task.
 */
export class SshSessionRegistry {
	// biome-ignore lint/suspicious/noExplicitAny: ssh2 Client type — dynamic import
	private static readonly sessions = new Map<string, any>()

	// biome-ignore lint/suspicious/noExplicitAny: ssh2 Client type
	static set(taskId: string, client: any): void {
		SshSessionRegistry.sessions.set(taskId, client)
	}

	// biome-ignore lint/suspicious/noExplicitAny: ssh2 Client type
	static get(taskId: string): any | undefined {
		return SshSessionRegistry.sessions.get(taskId)
	}

	static has(taskId: string): boolean {
		return SshSessionRegistry.sessions.has(taskId)
	}

	static delete(taskId: string): void {
		const client = SshSessionRegistry.sessions.get(taskId)
		if (client) {
			try {
				client.end()
			} catch {
				// ignore errors on close
			}
			SshSessionRegistry.sessions.delete(taskId)
		}
	}
}
