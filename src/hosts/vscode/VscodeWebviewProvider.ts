import { sendShowWebviewEvent } from "@core/controller/ui/subscribeToShowWebview"
import { WebviewProvider } from "@core/webview"
import { spawn } from "child_process"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import * as vscode from "vscode"
import { handleGrpcRequest, handleGrpcRequestCancel } from "@/core/controller/grpc-handler"
import { HostProvider } from "@/hosts/host-provider"
import { ExtensionRegistryInfo } from "@/registry"
import type { ExtensionMessage } from "@/shared/ExtensionMessage"
import { Logger } from "@/shared/services/Logger"
import { WebviewMessage } from "@/shared/WebviewMessage"

/**
 * Plays a WAV buffer directly on the extension host (bypasses webview autoplay restrictions).
 * Windows: System.Media.SoundPlayer via PowerShell
 * macOS: afplay
 * Linux: aplay
 */
async function playWavOnHost(wavBuf: Buffer): Promise<void> {
	const tmpFile = path.join(os.tmpdir(), `nexusai_tts_${Date.now()}.wav`)
	fs.writeFileSync(tmpFile, wavBuf)
	try {
		await new Promise<void>((resolve, reject) => {
			let child: ReturnType<typeof spawn>
			const safeFile = tmpFile.replace(/'/g, "''")
			if (process.platform === "win32") {
				child = spawn("powershell", [
					"-NoProfile",
					"-NonInteractive",
					"-Command",
					`$p=[System.Media.SoundPlayer]::new('${safeFile}');$p.PlaySync();$p.Dispose()`,
				])
			} else if (process.platform === "darwin") {
				child = spawn("afplay", [tmpFile])
			} else {
				child = spawn("aplay", [tmpFile])
			}
			child.on("close", (code) => {
				if (code === 0 || code === null) resolve()
				else reject(new Error(`Audio player exited with code ${code}`))
			})
			child.on("error", reject)
		})
	} finally {
		try {
			fs.unlinkSync(tmpFile)
		} catch {
			// ignore cleanup errors
		}
	}
}

// Global messenger instance for voice state updates
let globalVoiceMessenger: ((message: ExtensionMessage) => Promise<boolean | undefined>) | null = null

export function setGlobalVoiceMessenger(messenger: ((message: ExtensionMessage) => Promise<boolean | undefined>) | null): void {
	globalVoiceMessenger = messenger
}

export function getGlobalVoiceMessenger(): ((message: ExtensionMessage) => Promise<boolean | undefined>) | null {
	return globalVoiceMessenger
}

export class VscodeWebviewProvider extends WebviewProvider implements vscode.WebviewViewProvider {
	// Used in package.json as the view's id. This value cannot be changed due to how vscode caches
	// views based on their id, and updating the id would break existing instances of the extension.
	public static readonly SIDEBAR_ID = ExtensionRegistryInfo.views.Sidebar

	private webview?: vscode.WebviewView
	private disposables: vscode.Disposable[] = []

	override getWebviewUrl(path: string) {
		if (!this.webview) {
			throw new Error("Webview not initialized")
		}
		const uri = this.webview.webview.asWebviewUri(vscode.Uri.file(path))
		return uri.toString()
	}

	override getCspSource() {
		if (!this.webview) {
			throw new Error("Webview not initialized")
		}
		return this.webview.webview.cspSource
	}

	override isVisible() {
		return this.webview?.visible || false
	}

	public getWebview(): vscode.WebviewView | undefined {
		return this.webview
	}

	/**
	 * Initializes and sets up the webview when it's first created.
	 *
	 * @param webviewView - The sidebar webview view instance to be resolved
	 * @returns A promise that resolves when the webview has been fully initialized
	 */
	public async resolveWebviewView(webviewView: vscode.WebviewView): Promise<void> {
		this.webview = webviewView

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,
			localResourceRoots: [vscode.Uri.file(HostProvider.get().extensionFsPath)],
		}

		webviewView.webview.html =
			this.context.extensionMode === vscode.ExtensionMode.Development
				? await this.getHMRHtmlContent()
				: this.getHtmlContent()

		// Sets up an event listener to listen for messages passed from the webview view context
		// and executes code based on the message that is received
		this.setWebviewMessageListener(webviewView.webview)

		// Logs show up in bottom panel > Debug Console
		//Logger.log("registering listener")

		// Listen for when the sidebar becomes visible
		// https://github.com/microsoft/vscode-discussions/discussions/840

		// onDidChangeVisibility is only available on the sidebar webview
		// Otherwise WebviewView and WebviewPanel have all the same properties except for this visibility listener
		// WebviewPanel is not currently used in the extension
		webviewView.onDidChangeVisibility(
			async () => {
				if (this.webview?.visible) {
					// View becoming visible should not steal editor focus.
					await sendShowWebviewEvent(true)

					// Automatically open editor panel when sidebar becomes visible
					// (safe now with per-context storage keys)
					try {
						const { EditorWebviewPanelProvider } = await import("./EditorWebviewPanelProvider")
						await EditorWebviewPanelProvider.createOrShow()
						Logger.log("[VscodeWebviewProvider] Automatically opened editor panel with sidebar")
					} catch (error) {
						Logger.warn("[VscodeWebviewProvider] Failed to auto-open editor panel:", error)
					}
				}
			},
			null,
			this.disposables,
		)

		// Listen for when the view is disposed
		// This happens when the user closes the view or when the view is closed programmatically
		webviewView.onDidDispose(
			async () => {
				await this.dispose()
			},
			null,
			this.disposables,
		)

		// Listen for configuration changes
		vscode.workspace.onDidChangeConfiguration(
			async (e) => {
				if (e && e.affectsConfiguration("nexusai.mcpMarketplace.enabled")) {
					// Update state when marketplace tab setting changes
					await this.controller.postStateToWebview()
				}
			},
			null,
			this.disposables,
		)

		// if the extension is starting a new session, clear previous task state
		this.controller.clearTask()

		// Wire VoiceSessionManager speak requests → PiperService → webview audio
		void import("@services/voice/VoiceSessionManager").then(({ VoiceSessionManager }) => {
			Logger.log("[VscodeWebviewProvider] Registering onSpeakRequest listener")
			const dispose = VoiceSessionManager.getInstance().onSpeakRequest(async (text: string) => {
				Logger.log(
					`[TTS] 🎙️ onSpeakRequest EVENT FIRED! text length=${text?.length ?? 0}: "${text?.substring(0, 60)}${(text?.length ?? 0) > 60 ? "..." : ""}"`,
				)
				try {
					const { PiperService } = await import("@services/voice/PiperService")
					const { SpeakerGate } = await import("@services/voice/SpeakerGate")
					const voicePiperVoice =
						(this.controller.stateManager.getGlobalStateKey("voicePiperVoice") as string | undefined) ??
						"en_US-lessac-medium"
					Logger.log(`[TTS] 🎵 Synthesizing with voice="${voicePiperVoice}"`)
					const wavBuf = await PiperService.getInstance(this.controller.context.globalStoragePath).synthesize(
						text,
						voicePiperVoice,
					)
					Logger.log(`[TTS] ✅ Synthesis done: ${wavBuf.length} bytes WAV`)

					// Extract lip sync phoneme timeline (non-blocking — fallback to empty on error)
					const { RhubarbService } = await import("@services/voice/RhubarbService")
					const phonemeTimeline = await new RhubarbService().extractTimeline(wavBuf)
					Logger.log(`[TTS] 👄 Lip sync timeline extracted: ${phonemeTimeline.length} phoneme entries`)

					// Send WAV + phoneme timeline to webview for lip sync timing
					void this.postMessageToWebview({
						type: "voice_audio_play",
						voice_audio_play: {
							wavBase64: wavBuf.toString("base64"),
							phonemeTimeline,
						},
					})
					Logger.log(`[TTS] 📤 voice_audio_play message sent to webview`)

					SpeakerGate.getInstance().activate()
					void this.postMessageToWebview({
						type: "voice_agent_state_changed",
						voice_agent_state_changed: { state: "PLAYING", context: "" },
					})
					try {
						Logger.log("[TTS] 🔊 Playing audio on host...")
						await playWavOnHost(wavBuf)
						Logger.log("[TTS] ✅ Host audio playback complete")
					} finally {
						SpeakerGate.getInstance().deactivate()
						void this.postMessageToWebview({
							type: "voice_agent_state_changed",
							voice_agent_state_changed: { state: "IDLE", context: "" },
						})
					}
				} catch (err) {
					Logger.error("[TTS] ❌ TTS speak error:", err)
				}
			})
			this.disposables.push({ dispose })
		})

		Logger.log("[VscodeWebviewProvider] Webview view resolved")

		// Title setting logic removed to allow VSCode to use the container title primarily.
	}

	/**
	 * Sets up an event listener to listen for messages passed from the webview context and
	 * executes code based on the message that is received.
	 *
	 * IMPORTANT: When passing methods as callbacks in JavaScript/TypeScript, the method's
	 * 'this' context can be lost. This happens because the method is passed as a
	 * standalone function reference, detached from its original object.
	 *
	 * The Problem:
	 * Doing: webview.onDidReceiveMessage(this.controller.handleWebviewMessage)
	 * Would cause 'this' inside handleWebviewMessage to be undefined or wrong,
	 * leading to "TypeError: this.setUserInfo is not a function"
	 *
	 * The Solution:
	 * We wrap the method call in an arrow function, which:
	 * 1. Preserves the lexical scope's 'this' binding
	 * 2. Ensures handleWebviewMessage is called as a method on the controller instance
	 * 3. Maintains access to all controller methods and properties
	 *
	 * Alternative solutions could use .bind() or making handleWebviewMessage an arrow
	 * function property, but this approach is clean and explicit.
	 *
	 * @param webview The webview instance to attach the message listener to
	 */
	private setWebviewMessageListener(webview: vscode.Webview) {
		webview.onDidReceiveMessage(
			(message) => {
				this.handleWebviewMessage(message)
			},
			null,
			this.disposables,
		)
	}

	/**
	 * Sets up an event listener to listen for messages passed from the webview context and
	 * executes code based on the message that is received.
	 *
	 * @param webview A reference to the extension webview
	 */
	async handleWebviewMessage(message: WebviewMessage) {
		const postMessageToWebview = (response: ExtensionMessage) => this.postMessageToWebview(response)

		// Register global voice messenger for use in recordAndRespond
		setGlobalVoiceMessenger(postMessageToWebview)

		switch (message.type) {
			case "grpc_request": {
				if (message.grpc_request) {
					await handleGrpcRequest(this.controller, postMessageToWebview, message.grpc_request)
				}
				break
			}
			case "grpc_request_cancel": {
				if (message.grpc_request_cancel) {
					await handleGrpcRequestCancel(postMessageToWebview, message.grpc_request_cancel)
				}
				break
			}
			case "trpc_request": {
				if (message.trpc_request) {
					const { handleTrpcRequest } = await import("@core/trpc/handler")
					await handleTrpcRequest(this.controller, postMessageToWebview, message.trpc_request)
				}
				break
			}
			case "voice_float32_audio": {
				if (message.voice_float32_audio) {
					const { buffer, sampleRate } = message.voice_float32_audio
					const float32 = new Float32Array(buffer)
					try {
						const { VoiceSessionManager } = await import("@services/voice/VoiceSessionManager")
						const { WhisperService } = await import("@services/voice/WhisperService")
						const whisper = WhisperService.getInstance(this.controller.context.globalStoragePath)
						const text = await whisper.transcribe(float32, sampleRate)
						VoiceSessionManager.getInstance().setLastTranscription(text)
						postMessageToWebview({ type: "voice_transcription", voice_transcription: { text } })
					} catch (err) {
						Logger.error("[VscodeWebviewProvider] voice transcription failed:", err)
						postMessageToWebview({ type: "voice_transcription", voice_transcription: { text: "" } })
					}
				}
				break
			}
			case "debug_voice_error": {
				const errorData = message.debug_voice_error
				if (errorData) {
					const output = [
						"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
						"🎙️ VOICE PERMISSION ERROR",
						"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
						`Time: ${errorData.timestamp}`,
						`Stage: ${errorData.stage}`,
						`Error: ${errorData.errorName}: ${errorData.errorMessage}`,
						`Device: ${errorData.deviceId}`,
						"",
					]

					// OS-specific instructions
					if (process.platform === "win32") {
						output.push(
							"📍 FIX FOR WINDOWS:",
							`1. Open Settings → Privacy & Security → Microphone`,
							`2. Toggle "Let desktop apps access your microphone" ON`,
							`3. Scroll down and ensure VSCode is in the "Allow" list`,
							`4. Restart VSCode and try again`,
							"",
						)
					} else if (process.platform === "darwin") {
						output.push(
							"📍 FIX FOR MACOS:",
							"1. Go to System Settings → Privacy & Security → Microphone",
							"2. Ensure VSCode is in the list with permission granted",
							"3. If VSCode isn't listed, restart VSCode to trigger prompt",
							"4. Grant permission when prompt appears",
							"",
						)
					} else {
						output.push(
							"📍 FIX FOR LINUX:",
							"1. Check PulseAudio/PipeWire permissions",
							`2. Run: pactl list clients | grep Code`,
							"3. Ensure microphone device is accessible in system settings",
							"",
						)
					}

					output.push("For more details, check the NexusAI output panel below.")

					Logger.info(`[VoiceDebug] ${output.join("\n")}`)
				}
				break
			}
			case "start_voice_recording": {
				if (message.start_voice_recording) {
					try {
						const { SpeakerGate } = await import("@services/voice/SpeakerGate")
						if (SpeakerGate.getInstance().isBlocked()) {
							Logger.log("[VscodeWebviewProvider] Speaker gate active — ignoring recording request during TTS")
							break
						}
						const { recordAndRespond } = await import("@core/controller/voice/recordAndRespond")
						const silenceThresholdMs = message.start_voice_recording.silenceThresholdMs || 700
						const gracePeriodMs = message.start_voice_recording.gracePeriodMs ?? 2000
						const voiceInputDeviceId = this.controller.stateManager.getGlobalStateKey("voiceInputDeviceId") as
							| string
							| undefined

						Logger.log("[VscodeWebviewProvider] Recording requested", {
							voiceInputDeviceId: voiceInputDeviceId || "UNDEFINED - will try first available device",
							silenceThresholdMs,
							gracePeriodMs,
						})

						const response = await recordAndRespond(this.controller, {
							silenceDurationMs: silenceThresholdMs,
							gracePeriodMs,
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
						Logger.error("[VscodeWebviewProvider] Voice record and respond failed:", err)
						postMessageToWebview({
							type: "voice_result",
							voice_result: {
								transcriptionText: "",
								llmResponseText: "",
								audioWavBase64: "",
								totalDurationMs: 0,
								success: false,
								errorMessage: err instanceof Error ? err.message : "Unknown error",
							},
						})
					}
				}
				break
			}
			case "stop_voice_recording": {
				// Stop active recording (push-to-talk release)
				if (message.stop_voice_recording) {
					try {
						const { getActiveVoiceAgent } = await import("@core/controller/voice/recordAndRespond")
						const agent = getActiveVoiceAgent()
						if (agent) {
							Logger.log("[VscodeWebviewProvider] Stopping voice recording...")
							agent.stop()
						} else {
							Logger.warn("[VscodeWebviewProvider] No active voice agent to stop")
						}
					} catch (err) {
						Logger.error("[VscodeWebviewProvider] Failed to stop voice recording:", err)
					}
				}
				break
			}
			default: {
				Logger.error("Received unhandled WebviewMessage type:", JSON.stringify(message))
			}
		}
	}

	/**
	 * Sends a message from the extension to the webview.
	 *
	 * @param message - The message to send to the webview
	 * @returns A thenable that resolves to a boolean indicating success, or undefined if the webview is not available
	 */
	public async postMessageToWebview(message: ExtensionMessage): Promise<boolean | undefined> {
		if (!this.webview) {
			Logger.warn("[VscodeWebviewProvider] postMessageToWebview: webview not available")
			return undefined
		}
		const result = this.webview.webview.postMessage(message)
		if (message.type === "voice_agent_state_changed") {
			Logger.log(
				`[VscodeWebviewProvider] Sent voice_agent_state_changed to webview: ${message.voice_agent_state_changed?.state}`,
			)
		}
		return result
	}

	/**
	 * Implementation of abstract method - sends extension message to webview
	 * Also routes message to editor panel if it exists (dual-panel support)
	 */
	async postExtensionMessage(message: any): Promise<boolean | undefined> {
		// Send to sidebar
		const sidebarResult = await this.postMessageToWebview(message)

		// Also send to editor panel if it's open (for state sync between sidebar and editor)
		try {
			// Dynamic import to avoid circular dependency
			const { EditorWebviewPanelProvider } = await import("./EditorWebviewPanelProvider")
			if (EditorWebviewPanelProvider.INSTANCE) {
				await EditorWebviewPanelProvider.INSTANCE.postMessageToWebview(message)
			}
		} catch (error) {
			// Silently fail if editor panel is not available
		}

		return sidebarResult
	}

	/**
	 * Convert ISO 639-1 language code to human-readable name
	 * Used for displaying language badge in UI (e.g., "pt" → "Português")
	 */
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

	override async dispose() {
		// WebviewView doesn't have a dispose method, it's managed by VSCode
		// We just need to clean up our disposables
		while (this.disposables.length) {
			const x = this.disposables.pop()
			if (x) {
				x.dispose()
			}
		}
		super.dispose()
	}
}
