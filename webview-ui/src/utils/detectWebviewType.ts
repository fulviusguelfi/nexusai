/**
 * Detects whether the current webview is running in the sidebar or editor panel
 * This is used to isolate state between the two webview instances
 */

export type WebviewType = "sidebar" | "editor"

/**
 * Determine if this webview is running in sidebar or editor panel
 * Editor panel has 'purpose=webviewPanel' in URL query params
 */
export function getWebviewType(): WebviewType {
	try {
		const params = new URLSearchParams(window.location.search)
		const purpose = params.get("purpose")
		return purpose === "webviewPanel" ? "editor" : "sidebar"
	} catch {
		// Fallback to sidebar if we can't parse
		return "sidebar"
	}
}

/**
 * Get a storage key prefix specific to this webview instance
 * Prevents sidebar and editor from sharing state via localStorage
 */
export function getStoragePrefix(): string {
	return `nexusai.${getWebviewType()}.`
}

/**
 * Get context ID for logging and state tracking
 */
export function getContextId(): string {
	return `${getWebviewType()}-${Date.now() % 100000}`
}
