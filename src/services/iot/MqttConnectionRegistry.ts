export interface MqttSessionInfo {
	taskId: string
	broker: string
	port: number
	clientId: string
	connectedAt: number // unix ms
}

/**
 * Module-level registry of active MQTT client connections, keyed by taskId.
 * Mirrors the SshSessionRegistry pattern for consistent lifecycle management.
 */
export class MqttConnectionRegistry {
	// biome-ignore lint/suspicious/noExplicitAny: mqtt Client type — dynamic import
	private static readonly clients = new Map<string, any>()
	private static readonly metadata = new Map<string, MqttSessionInfo>()
	private static readonly changeListeners = new Set<() => void>()

	// biome-ignore lint/suspicious/noExplicitAny: mqtt Client type
	static set(taskId: string, client: any): void {
		MqttConnectionRegistry.clients.set(taskId, client)
	}

	static setMetadata(taskId: string, info: Omit<MqttSessionInfo, "taskId">): void {
		MqttConnectionRegistry.metadata.set(taskId, { taskId, ...info })
		MqttConnectionRegistry.notifyChange()
	}

	static onDidChange(listener: () => void): () => void {
		MqttConnectionRegistry.changeListeners.add(listener)
		return () => MqttConnectionRegistry.changeListeners.delete(listener)
	}

	private static notifyChange(): void {
		for (const fn of MqttConnectionRegistry.changeListeners) {
			fn()
		}
	}

	static getActiveSessions(): MqttSessionInfo[] {
		return Array.from(MqttConnectionRegistry.metadata.values())
	}

	// biome-ignore lint/suspicious/noExplicitAny: mqtt Client type
	static get(taskId: string): any | undefined {
		return MqttConnectionRegistry.clients.get(taskId)
	}

	static has(taskId: string): boolean {
		return MqttConnectionRegistry.clients.has(taskId)
	}

	static delete(taskId: string): void {
		const client = MqttConnectionRegistry.clients.get(taskId)
		if (client) {
			try {
				client.end(true)
			} catch {
				// ignore errors on close
			}
			MqttConnectionRegistry.clients.delete(taskId)
		}
		MqttConnectionRegistry.metadata.delete(taskId)
		MqttConnectionRegistry.notifyChange()
	}
}
