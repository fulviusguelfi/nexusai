import { sendShowWebviewEvent } from "@core/controller/ui/subscribeToShowWebview"
import { WebviewProvider } from "@core/webview"
import * as vscode from "vscode"
import { handleGrpcRequest, handleGrpcRequestCancel } from "@/core/controller/grpc-handler"
import { HostProvider } from "@/hosts/host-provider"
import type { ExtensionMessage } from "@/shared/ExtensionMessage"
import { Logger } from "@/shared/services/Logger"
import type { WebviewMessage } from "@/shared/WebviewMessage"
import { setGlobalVoiceMessenger } from "./VscodeWebviewProvider"

/**
 * EditorWebviewPanelProvider opens NexusAI in a dedicated webview panel in the editor
 * (not in the sidebar). This allows for a wide layout with chat + avatar side-by-side.
 *
 * Key differences from sidebar:
 * - Uses vscode.WebviewPanel (editor panel) instead of vscode.WebviewView (sidebar)
 * - Can be positioned in ViewColumn.Two (beside editor)
 * - Shares the same WebviewProvider base class and React app
 * - Messages flow through the Controller singleton (synced with sidebar webview if both are open)
 */
export class EditorWebviewPanelProvider extends WebviewProvider implements vscode.Disposable {
	public static readonly PANEL_VIEW_TYPE = "nexusai.editorPanel"
	public static INSTANCE: EditorWebviewPanelProvider | undefined

	private panel?: vscode.WebviewPanel
	private disposables: vscode.Disposable[] = []

	override getWebviewUrl(filePath: string) {
		if (!this.panel) {
			throw new Error("Editor panel not initialized")
		}
		const uri = this.panel.webview.asWebviewUri(vscode.Uri.file(filePath))
		return uri.toString()
	}

	override getCspSource() {
		if (!this.panel) {
			throw new Error("Editor panel not initialized")
		}
		return this.panel.webview.cspSource
	}

	override isVisible() {
		return this.panel?.visible || false
	}

	override async postExtensionMessage(message: any): Promise<boolean | undefined> {
		return this.postMessageToWebview(message)
	}

	/**
	 * Creates and shows the editor panel. If a panel already exists, focuses it instead.
	 */
	public static async createOrShow(): Promise<EditorWebviewPanelProvider> {
		Logger.log("[EditorWebviewPanelProvider.createOrShow] Called")
		// If a panel already exists, focus it
		if (EditorWebviewPanelProvider.INSTANCE && EditorWebviewPanelProvider.INSTANCE.panel) {
			Logger.log("[EditorWebviewPanelProvider.createOrShow] Panel already exists, revealing")
			EditorWebviewPanelProvider.INSTANCE.panel.reveal(vscode.ViewColumn.Two)
			return EditorWebviewPanelProvider.INSTANCE
		}

		Logger.log("[EditorWebviewPanelProvider.createOrShow] Creating new panel")
		// Get context from existing WebviewProvider singleton
		const sidebarWebview = WebviewProvider.getInstance()
		const provider = new EditorWebviewPanelProvider(sidebarWebview.context)
		await provider.createPanel()

		EditorWebviewPanelProvider.INSTANCE = provider
		return provider
	}

	/**
	 * Creates and initializes the webview panel
	 */
	private async createPanel() {
		if (this.panel) {
			this.panel.reveal(vscode.ViewColumn.Two)
			return
		}

		// Create webview panel in editor area (ViewColumn.Two = beside the editor)
		this.panel = vscode.window.createWebviewPanel(
			EditorWebviewPanelProvider.PANEL_VIEW_TYPE,
			"NexusAI",
			{ viewColumn: vscode.ViewColumn.Two, preserveFocus: false },
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [vscode.Uri.file(HostProvider.get().extensionFsPath)],
			},
		)

		// Set HTML content (dev HMR or prod bundle)
		this.panel.webview.html =
			this.context.extensionMode === vscode.ExtensionMode.Development
				? await this.getHMRHtmlContent()
				: this.getHtmlContent()

		// Set up message listener
		this.setWebviewMessageListener(this.panel.webview)

		// Listen for visibility changes
		this.panel.onDidChangeViewState(
			async () => {
				if (this.panel?.visible) {
					Logger.log("[EditorWebviewPanelProvider] Panel is now visible - setting orientation to horizontal")
					await sendShowWebviewEvent(true)
					// Set layout to horizontal when editor panel is visible
					await this.postMessageToWebview({
						type: "setLayoutOrientation",
						orientation: "horizontal",
					})
					Logger.log("[EditorWebviewPanelProvider] Sent setLayoutOrientation message")
				}
			},
			null,
			this.disposables,
		)

		// Listen for disposal
		this.panel.onDidDispose(
			async () => {
				await this.dispose()
				EditorWebviewPanelProvider.INSTANCE = undefined
			},
			null,
			this.disposables,
		)

		Logger.log("[EditorWebviewPanelProvider] Panel created and visible")
	}

	/**
	 * Sets up the message listener for webview → extension communication
	 */
	private setWebviewMessageListener(webview: vscode.Webview) {
		Logger.log("[EditorWebviewPanelProvider] Setting up webview message listener")
		webview.onDidReceiveMessage(
			(message: WebviewMessage) => {
				this.handleWebviewMessage(message)
			},
			null,
			this.disposables,
		)

		// Send orientation message after listener is set up to ensure webview is ready
		// Use longer timeout for editor panel to ensure React has fully loaded
		const sendOrientationMessage = async () => {
			Logger.log("[EditorWebviewPanelProvider] Sending orientation message after listener setup")
			await this.postMessageToWebview({
				type: "setLayoutOrientation",
				orientation: "horizontal",
			})
			Logger.log("[EditorWebviewPanelProvider] Sent setLayoutOrientation message")
		}

		// Retry multiple times with increasing delays to ensure React is ready
		// and the message gets through
		setTimeout(sendOrientationMessage, 100)
		setTimeout(sendOrientationMessage, 300)
		setTimeout(sendOrientationMessage, 800)
		setTimeout(sendOrientationMessage, 1500)

		// Register voice messenger
		const postMessageToWebview = (response: ExtensionMessage) => this.postMessageToWebview(response)
		setGlobalVoiceMessenger(postMessageToWebview)
	}

	/**
	 * Handles messages from the webview
	 */
	private async handleWebviewMessage(message: WebviewMessage) {
		try {
			const postMessageToWebview = (msg: ExtensionMessage) => this.postMessageToWebview(msg)

			// Handle editor-specific messages
			if (message.type === "webview_ready") {
				Logger.log("[EditorWebviewPanelProvider] Received webview_ready signal")
				// Immediately send orientation to ensure avatar renders
				await this.postMessageToWebview({
					type: "setLayoutOrientation",
					orientation: "horizontal",
				})
				return
			}

			// Handle voice recording (STT pipeline)
			if (message.type === "start_voice_recording" && message.start_voice_recording) {
				try {
					const { SpeakerGate } = await import("@services/voice/SpeakerGate")
					if (SpeakerGate.getInstance().isBlocked()) {
						Logger.log("[EditorWebviewPanelProvider] Speaker gate active — ignoring recording request during TTS")
						return
					}
					// Point the global voice messenger at the editor panel for the duration of this
					// recording so that partials, state changes, and audio-level messages are routed
					// here (editor panel) rather than to the sidebar.
					setGlobalVoiceMessenger(postMessageToWebview)
					const { recordAndRespond } = await import("@core/controller/voice/recordAndRespond")
					const silenceThresholdMs = message.start_voice_recording.silenceThresholdMs || 700
					const gracePeriodMs = message.start_voice_recording.gracePeriodMs ?? 2000
					const maxDurationMs = message.start_voice_recording.maxDurationMs || 120000
					const voiceInputDeviceId = this.controller.stateManager.getGlobalStateKey("voiceInputDeviceId") as
						| string
						| undefined

					Logger.log("[EditorWebviewPanelProvider] Recording requested", {
						voiceInputDeviceId: voiceInputDeviceId || "UNDEFINED - will try first available device",
						silenceThresholdMs,
						gracePeriodMs,
						maxDurationMs,
					})

					const response = await recordAndRespond(this.controller, {
						silenceDurationMs: silenceThresholdMs,
						gracePeriodMs,
						maxDurationMs,
						inputDeviceId: voiceInputDeviceId || undefined,
					})

					// Send detected language as separate event for UI badge display
					if (response.detectedLanguage && response.detectedLanguage !== "en") {
						postMessageToWebview({
							type: "voice_language_detected",
							voice_language_detected: {
								languageCode: response.detectedLanguage,
								languageName: this.getLanguageName(response.detectedLanguage),
							},
						})
					}

					postMessageToWebview({
						type: "voice_result",
						voice_result: {
							transcriptionText: response.transcriptionText,
							llmResponseText: response.llmResponseText,
							audioWavBase64: response.audioWavBase64,
							totalDurationMs: response.totalDurationMs,
							success: response.success,
							errorMessage: response.errorMessage,
							detectedLanguage: response.detectedLanguage,
						},
					})
				} catch (err) {
					Logger.error("[EditorWebviewPanelProvider] Voice record and respond failed:", err)
					postMessageToWebview({
						type: "voice_result",
						voice_result: {
							transcriptionText: "",
							llmResponseText: "",
							audioWavBase64: "",
							totalDurationMs: 0,
							success: false,
							errorMessage: `Voice recording error: ${err instanceof Error ? err.message : String(err)}`,
						},
					})
				}
				return
			}

			if (message.grpc_request) {
				await handleGrpcRequest(this.controller, postMessageToWebview, message.grpc_request)
			} else if (message.grpc_request_cancel) {
				await handleGrpcRequestCancel(postMessageToWebview, message.grpc_request_cancel)
			} else if ("trpc_request" in message && message.trpc_request) {
				// Lazy import to avoid circular deps
				const { handleTrpcRequest } = await import("@core/trpc/handler")
				await handleTrpcRequest(this.controller, postMessageToWebview, message.trpc_request)
			}
		} catch (error) {
			Logger.error("[EditorWebviewPanelProvider] Error handling message:", error)
		}
	}

	public async postMessageToWebview(message: ExtensionMessage): Promise<boolean | undefined> {
		if (!this.panel) {
			Logger.warn("[EditorWebviewPanelProvider] postMessageToWebview: panel not available")
			return undefined
		}

		Logger.log("[EditorWebviewPanelProvider] Posting message to webview:", message.type)

		try {
			return await this.panel.webview.postMessage(message)
		} catch (error) {
			Logger.error("[EditorWebviewPanelProvider] Failed to post message:", error)
			return undefined
		}
	}

	private getLanguageName(languageCode: string): string {
		const languageMap: Record<string, string> = {
			en: "English",
			pt: "Português",
			"pt-BR": "Português (Brasil)",
			"pt-PT": "Português (Portugal)",
			es: "Español",
			"es-ES": "Español (España)",
			"es-MX": "Español (México)",
			fr: "Français",
			de: "Deutsch",
			it: "Italiano",
			ja: "日本語",
			zh: "中文",
			"zh-CN": "中文 (简体)",
			"zh-TW": "中文 (繁體)",
			ko: "한국어",
			ru: "Русский",
			nl: "Nederlands",
			pl: "Polski",
			tr: "Türkçe",
			ar: "العربية",
			hi: "हिन्दी",
		}
		return languageMap[languageCode] || languageCode
	}

	/**
	 * Cleanup when panel is disposed
	 */
	public override async dispose() {
		Logger.log("[EditorWebviewPanelProvider] Disposing editor panel")
		this.disposables?.forEach((d) => d.dispose?.())
		this.disposables = []
		this.panel?.dispose()
		this.panel = undefined
		await this.controller.dispose()
		EditorWebviewPanelProvider.INSTANCE = undefined
	}
}
