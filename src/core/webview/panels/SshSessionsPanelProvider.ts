import { SshServerProfileRegistry } from "@services/ssh/SshServerProfileRegistry"
import type { SshSessionInfo } from "@services/ssh/SshSessionRegistry"
import { SshSessionRegistry } from "@services/ssh/SshSessionRegistry"
import type { SshServerProfile } from "@shared/ssh/SshServerProfile"
import * as vscode from "vscode"

/**
 * WebviewViewProvider for the "SSH Sessions" panel in the NexusAI Activity Bar container.
 * Shows two sections: saved server profiles and currently active SSH sessions.
 */
export class SshSessionsPanelProvider implements vscode.WebviewViewProvider {
	public static readonly viewId = "nexusai.sshPanel"

	private _view?: vscode.WebviewView
	private _disposeListeners: (() => void)[] = []

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this._view = webviewView

		webviewView.webview.options = { enableScripts: true }
		webviewView.webview.html = this._buildHtml(SshServerProfileRegistry.getAll(), SshSessionRegistry.getActiveSessions())

		// Handle remove-server requests from the webview
		webviewView.webview.onDidReceiveMessage(async (msg: { command: string; id?: string }) => {
			if (msg.command === "remove" && msg.id) {
				await SshServerProfileRegistry.remove(msg.id)
			}
		})

		// Refresh panel whenever saved servers or active sessions change
		const refresh = () => {
			if (this._view) {
				this._view.webview.html = this._buildHtml(
					SshServerProfileRegistry.getAll(),
					SshSessionRegistry.getActiveSessions(),
				)
			}
		}
		this._disposeListeners = [SshSessionRegistry.onDidChange(refresh), SshServerProfileRegistry.onDidChange(refresh)]

		webviewView.onDidDispose(() => {
			for (const fn of this._disposeListeners) fn()
			this._disposeListeners = []
			this._view = undefined
		})
	}

	private _buildHtml(saved: SshServerProfile[], sessions: SshSessionInfo[]): string {
		const savedRows =
			saved.length === 0
				? `<p class="empty">Nenhum servidor salvo</p>`
				: saved
						.map(
							(p) => `
			<div class="server">
				<div class="info">
					<strong>${escapeHtml(p.name)}</strong>
					<small>${escapeHtml(p.user)}@${escapeHtml(p.host)}:${p.port}${p.lastConnectedAt ? ` · ${formatAge(p.lastConnectedAt)}` : ""}</small>
				</div>
				<button class="remove-btn" onclick="removeServer('${escapeHtml(p.id)}')">✕</button>
			</div>`,
						)
						.join("")

		const sessionRows =
			sessions.length === 0
				? `<p class="empty">Nenhuma sessão ativa</p>`
				: sessions
						.map(
							(s) => `
			<div class="session">
				<div class="info">
					<strong>${escapeHtml(s.user)}@${escapeHtml(s.host)}:${s.port}</strong>
					<small>Conectado ${formatAge(s.connectedAt)}</small>
				</div>
			</div>`,
						)
						.join("")

		return /* html */ `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); padding: 8px; margin: 0; }
  h3 { font-size: 0.8em; text-transform: uppercase; color: var(--vscode-descriptionForeground); margin: 10px 0 4px; letter-spacing: 0.05em; }
  h3:first-child { margin-top: 0; }
  .server, .session { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 5px 0; border-bottom: 1px solid var(--vscode-widget-border, #444); }
  .server:last-child, .session:last-child { border-bottom: none; }
  .info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  strong { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  small { color: var(--vscode-descriptionForeground); font-size: 0.82em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .remove-btn { background: none; border: none; cursor: pointer; color: var(--vscode-descriptionForeground); padding: 2px 4px; border-radius: 3px; flex-shrink: 0; }
  .remove-btn:hover { color: var(--vscode-errorForeground); background: var(--vscode-inputValidation-errorBackground, rgba(255,0,0,0.1)); }
  .empty { color: var(--vscode-descriptionForeground); font-style: italic; margin: 2px 0; }
  .divider { border: none; border-top: 1px solid var(--vscode-widget-border, #444); margin: 8px 0; }
</style>
</head>
<body>
<script>
  const vscode = acquireVsCodeApi();
  function removeServer(id) { vscode.postMessage({ command: 'remove', id }); }
</script>
<h3>Servidores Salvos</h3>
${savedRows}
<hr class="divider">
<h3>Sessões Ativas</h3>
${sessionRows}
</body>
</html>`
	}
}

function escapeHtml(str: string): string {
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function formatAge(ts: number): string {
	const secs = Math.floor((Date.now() - ts) / 1000)
	if (secs < 60) return `${secs}s atrás`
	const mins = Math.floor(secs / 60)
	if (mins < 60) return `${mins}m atrás`
	return `${Math.floor(mins / 60)}h ${mins % 60}m atrás`
}
