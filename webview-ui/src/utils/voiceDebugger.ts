/**
 * Centralized voice/recording logging for debugging
 * Collects logs in memory and allows export for troubleshooting
 */

export interface VoiceLog {
	timestamp: number
	module: string
	level: "info" | "warn" | "error"
	message: string
	data?: unknown
}

class VoiceLogStore {
	private logs: VoiceLog[] = []
	private readonly MAX_LOGS = 500

	log(module: string, level: "info" | "warn" | "error", message: string, data?: unknown) {
		const entry: VoiceLog = {
			timestamp: Date.now(),
			module,
			level,
			message,
			data,
		}

		this.logs.push(entry)

		// Keep memory bounded
		if (this.logs.length > this.MAX_LOGS) {
			this.logs.shift()
		}

		// Also log to console with nice formatting
		const icon = level === "error" ? "❌" : level === "warn" ? "⚠️" : "✅"
		console[level](`${icon} [${module}] ${message}`, data)
	}

	info(module: string, message: string, data?: unknown) {
		this.log(module, "info", message, data)
	}

	warn(module: string, message: string, data?: unknown) {
		this.log(module, "warn", message, data)
	}

	error(module: string, message: string, data?: unknown) {
		this.log(module, "error", message, data)
	}

	/**
	 * Export all logs as JSON string for sharing
	 */
	export(): string {
		return JSON.stringify(
			{
				exported: new Date().toISOString(),
				totalLogs: this.logs.length,
				logs: this.logs,
			},
			null,
			2,
		)
	}

	/**
	 * Get logs in last N milliseconds
	 */
	getRecent(ms = 60000): VoiceLog[] {
		const cutoff = Date.now() - ms
		return this.logs.filter((log) => log.timestamp >= cutoff)
	}

	/**
	 * Clear all logs
	 */
	clear() {
		this.logs = []
	}
}

// Single instance
export const voiceLogStore = new VoiceLogStore()

// Expose in window for console debugging
declare global {
	interface Window {
		__nexusaiVoiceLogs?: (action?: "export" | "clear" | "recent") => string | void
	}
}

if (typeof window !== "undefined") {
	window.__nexusaiVoiceLogs = (action = "export") => {
		if (action === "export") return voiceLogStore.export()
		if (action === "clear") return voiceLogStore.clear()
		if (action === "recent") return voiceLogStore.export() // For now, same as export
	}
}
