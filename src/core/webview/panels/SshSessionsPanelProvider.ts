import type { SshSessionInfo } from "@services/ssh/SshSessionRegistry"
import { SshSessionRegistry } from "@services/ssh/SshSessionRegistry"
import * as vscode from "vscode"

/**
 * WebviewViewProvider for the "SSH Sessions" panel in the NexusAI Activity Bar container.
 * Renders a lightweight HTML list of active SSH sessions and updates in real time.
 */
export class SshSessionsPanelProvider implements vscode.WebviewViewProvider {
	public static readonly viewId = "nexusai.sshPanel"

	private _view?: vscode.WebviewView
	private _disposeListener?: () => void

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this._view = webviewView

		webviewView.webview.options = { enableScripts: true }
		webviewView.webview.html = this._buildHtml(SshSessionRegistry.getActiveSessions())

		// Update panel whenever sessions change
		this._disposeListener = SshSessionRegistry.onDidChange(() => {
			if (this._view) {
				const sessions = SshSessionRegistry.getActiveSessions()
				this._view.webview.html = this._buildHtml(sessions)
			}
		})

		webviewView.onDidDispose(() => {
			this._disposeListener?.()
			this._disposeListener = undefined
			this._view = undefined
		})
	}

	private _buildHtml(sessions: SshSessionInfo[]): string {
		const rows =
			sessions.length === 0
				? `<p class="empty">No active SSH sessions</p>`
				: sessions
						.map(
							(s) => `
			<div class="session">
				<span class="icon">$(plug)</span>
				<div class="info">
					<strong>${escapeHtml(s.user)}@${escapeHtml(s.host)}:${s.port}</strong>
					<small>Connected ${formatAge(s.connectedAt)}</small>
				</div>
			</div>`,
						)
						.join("")

		return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
<style>
  body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); padding: 8px; margin: 0; }
  .session { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--vscode-widget-border, #444); }
  .session:last-child { border-bottom: none; }
  .info { display: flex; flex-direction: column; gap: 2px; }
  strong { font-weight: 600; }
  small { color: var(--vscode-descriptionForeground); font-size: 0.85em; }
  .empty { color: var(--vscode-descriptionForeground); font-style: italic; margin: 0; }
</style>
</head>
<body>
${rows}
</body>
</html>`
	}
}

function escapeHtml(str: string): string {
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function formatAge(connectedAt: number): string {
	const secs = Math.floor((Date.now() - connectedAt) / 1000)
	if (secs < 60) return `${secs}s ago`
	const mins = Math.floor(secs / 60)
	if (mins < 60) return `${mins}m ago`
	return `${Math.floor(mins / 60)}h ${mins % 60}m ago`
}
