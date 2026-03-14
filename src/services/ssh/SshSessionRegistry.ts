export interface SshSessionInfo {
	taskId: string
	host: string
	port: number
	user: string
	connectedAt: number // unix ms
}

/**
 * Module-level registry of active SSH client connections, keyed by taskId.
 * SSH tool handlers store/retrieve their connection via this registry so that
 * state persists across multiple tool calls within the same task.
 */
export class SshSessionRegistry {
	// biome-ignore lint/suspicious/noExplicitAny: ssh2 Client type — dynamic import
	private static readonly sessions = new Map<string, any>()
	private static readonly metadata = new Map<string, SshSessionInfo>()
	private static readonly changeListeners = new Set<() => void>()

	// biome-ignore lint/suspicious/noExplicitAny: ssh2 Client type
	static set(taskId: string, client: any): void {
		SshSessionRegistry.sessions.set(taskId, client)
	}

	static setMetadata(taskId: string, info: Omit<SshSessionInfo, "taskId">): void {
		SshSessionRegistry.metadata.set(taskId, { taskId, ...info })
		SshSessionRegistry.notifyChange()
	}

	static onDidChange(listener: () => void): () => void {
		SshSessionRegistry.changeListeners.add(listener)
		return () => SshSessionRegistry.changeListeners.delete(listener)
	}

	private static notifyChange(): void {
		for (const fn of SshSessionRegistry.changeListeners) {
			fn()
		}
	}

	static getActiveSessions(): SshSessionInfo[] {
		return Array.from(SshSessionRegistry.metadata.values())
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
		SshSessionRegistry.metadata.delete(taskId)
		SshSessionRegistry.notifyChange()
	}
}
