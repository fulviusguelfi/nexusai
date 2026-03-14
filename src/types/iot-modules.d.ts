// Type stubs for third-party modules without @types packages

// biome-ignore lint/suspicious/noExplicitAny: dynamic client interface
declare module "mqtt" {
	export interface MqttClient {
		connected: boolean
		publish(
			topic: string,
			message: string | Buffer,
			options: { qos?: 0 | 1 | 2; retain?: boolean },
			callback?: (err?: Error) => void,
		): void
		subscribe(topic: string, options: { qos?: 0 | 1 | 2 }, callback?: (err?: Error) => void): void
		unsubscribe(topic: string, callback?: (err?: Error) => void): void
		on(event: "connect" | "reconnect" | "close" | "disconnect" | "offline" | "error", listener: (arg?: unknown) => void): this
		on(event: "message", listener: (topic: string, payload: Buffer) => void): this
		once(event: string, listener: (arg?: unknown) => void): this
		removeListener(event: string, listener: (...args: unknown[]) => void): this
		end(force?: boolean, callback?: () => void): void
	}

	export function connect(brokerUrl: string, opts?: Record<string, unknown>): MqttClient
}

// biome-ignore lint/suspicious/noExplicitAny: dynamic bonjour interface
declare module "bonjour-service" {
	export interface RemoteService {
		name: string
		type: string
		host: string
		port: number
		referer: { address: string }
		[key: string]: unknown
	}

	export interface Browser {
		stop(): void
	}

	export class Bonjour {
		findAll(query: Record<string, unknown>, callback: (service: RemoteService) => void): Browser
		destroy(): void
	}
}
