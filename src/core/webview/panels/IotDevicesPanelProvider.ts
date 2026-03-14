import { DeviceRegistry } from "@services/iot/DeviceRegistry"
import type { DeviceProfile } from "@shared/iot/DeviceProfile"
import * as vscode from "vscode"

/**
 * WebviewViewProvider for the "IoT Devices" panel in the NexusAI Activity Bar container.
 * Renders a lightweight HTML list of registered IoT devices and updates in real time.
 */
export class IotDevicesPanelProvider implements vscode.WebviewViewProvider {
	public static readonly viewId = "nexusai.iotPanel"

	private _view?: vscode.WebviewView
	private _disposeListener?: () => void

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this._view = webviewView

		webviewView.webview.options = { enableScripts: true }
		webviewView.webview.html = this._buildHtml(DeviceRegistry.getAll())

		// Update panel whenever devices change
		this._disposeListener = DeviceRegistry.onDidChange(() => {
			if (this._view) {
				this._view.webview.html = this._buildHtml(DeviceRegistry.getAll())
			}
		})

		webviewView.onDidDispose(() => {
			this._disposeListener?.()
			this._disposeListener = undefined
			this._view = undefined
		})
	}

	private _buildHtml(devices: DeviceProfile[]): string {
		const rows =
			devices.length === 0
				? `<p class="empty">No registered IoT devices</p>`
				: devices
						.map(
							(d) => `
			<div class="device">
				<div class="info">
					<strong>${escapeHtml(d.name)}</strong>
					<span class="meta">${escapeHtml(d.ip)} &bull; ${escapeHtml(d.type)} &bull; ${escapeHtml(d.protocol)}</span>
					${d.notes ? `<small>${escapeHtml(d.notes)}</small>` : ""}
				</div>
				<span class="badge ${d.trustedLocal ? "trusted" : ""}">${d.trustedLocal ? "trusted" : ""}</span>
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
  .device { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--vscode-widget-border, #444); }
  .device:last-child { border-bottom: none; }
  .info { display: flex; flex-direction: column; gap: 2px; }
  strong { font-weight: 600; }
  .meta { color: var(--vscode-descriptionForeground); font-size: 0.85em; }
  small { color: var(--vscode-descriptionForeground); font-size: 0.8em; font-style: italic; }
  .badge.trusted { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 1px 5px; border-radius: 3px; font-size: 0.75em; white-space: nowrap; }
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
