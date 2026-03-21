import { Logger } from "@/shared/services/Logger"
import { NexusAIError } from "./NexusAIError"
import { IErrorProvider } from "./providers/IErrorProvider"

/**
 * Supported error provider types
 */
export type ErrorProviderType = "no-op"

/**
 * Configuration for error providers
 */
export interface ErrorProviderConfig {
	type: ErrorProviderType
	config?: Record<string, unknown>
}

/**
 * Factory class for creating error providers
 * Allows easy switching between different error tracking providers
 */
export class ErrorProviderFactory {
	/**
	 * Creates an error provider based on the provided configuration
	 * @param config Configuration for the error provider
	 * @returns IErrorProvider instance
	 */
	public static async createProvider(_config: ErrorProviderConfig): Promise<IErrorProvider> {
		return new NoOpErrorProvider()
	}

	/**
	 * Gets the default error provider configuration
	 * @returns Default no-op configuration
	 */
	public static getDefaultConfig(): ErrorProviderConfig {
		return { type: "no-op" }
	}
}

/**
 * No-operation error provider for when error logging is disabled
 * or for testing purposes
 */
class NoOpErrorProvider implements IErrorProvider {
	async captureException(error: Error | NexusAIError, properties?: Record<string, unknown>): Promise<void> {
		Logger.error("[NoOpErrorProvider] captureException called", { error: error.message || String(error), properties })
	}

	public logException(error: Error | NexusAIError, _properties?: Record<string, unknown>): void {
		// Use Logger.error directly to avoid potential infinite recursion through Logger
		Logger.error("[NoOpErrorProvider]", error.message || String(error))
	}

	public logMessage(
		message: string,
		level?: "error" | "warning" | "log" | "debug" | "info",
		properties?: Record<string, unknown>,
	): void {
		Logger.log("[NoOpErrorProvider]", { message, level, properties })
	}

	public isEnabled(): boolean {
		return true
	}

	public getSettings() {
		return {
			enabled: true,
			hostEnabled: true,
			level: "all" as const,
		}
	}

	public async dispose(): Promise<void> {
		Logger.info("[NoOpErrorProvider] Disposing")
	}
}
