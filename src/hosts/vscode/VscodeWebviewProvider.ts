import { sendShowWebviewEvent } from "@core/controller/ui/subscribeToShowWebview"
import { WebviewProvider } from "@core/webview"
import * as vscode from "vscode"
import { handleGrpcRequest, handleGrpcRequestCancel } from "@/core/controller/grpc-handler"
import { HostProvider } from "@/hosts/host-provider"
import { ExtensionRegistryInfo } from "@/registry"
import type { ExtensionMessage } from "@/shared/ExtensionMessage"
import { Logger } from "@/shared/services/Logger"
import { WebviewMessage } from "@/shared/WebviewMessage"

/**
 * Reads audio duration from a WAV buffer's RIFF header.
 * Returns duration in milliseconds. Falls back to 2000ms on parse error.
 */
function getWavDurationMs(wavBuf: Buffer): number {
	try {
		if (wavBuf.length < 44) return 2000
		const byteRate = wavBuf.readUInt32LE(28) // bytes/second
		const dataSize = wavBuf.readUInt32LE(40) // PCM data chunk size
		if (byteRate === 0) return 2000
		return Math.ceil((dataSize / byteRate) * 1000)
	} catch {
		return 2000
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

/**
 * Split a text block into individual sentences for streaming TTS.
 * Splits on sentence-ending punctuation followed by whitespace or end-of-string.
 * Preserves non-empty segments; short fragments are merged with the previous sentence.
 */
function splitIntoSentences(text: string): string[] {
	// Split on . ! ? followed by space/newline/end, keeping the delimiter on the left side
	const raw = text.split(/(?<=[.!?。！？])\s+/)
	const result: string[] = []
	for (const part of raw) {
		const trimmed = part.trim()
		if (!trimmed) continue
		// Merge very short tails (e.g. single character) onto the previous sentence
		if (trimmed.length < 4 && result.length > 0) {
			result[result.length - 1] += " " + trimmed
		} else {
			result.push(trimmed)
		}
	}
	// If no splits happened, return the whole text as one sentence
	return result.length > 0 ? result : [text.trim()].filter(Boolean)
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

		// Wire VoiceSessionManager speak requests → PiperService → webview audio (sentence streaming)
		void import("@services/voice/VoiceSessionManager").then(({ VoiceSessionManager }) => {
			Logger.log("[VscodeWebviewProvider] Registering onSpeakRequest listener")
			const dispose = VoiceSessionManager.getInstance().onSpeakRequest(async (text: string) => {
				const ttsStart = Date.now()
				const tts = () => `[T+${Date.now() - ttsStart}ms]`
				Logger.log(
					`[TTS] 🎙️ ${tts()} onSpeakRequest FIRED — ${text?.length ?? 0} chars: "${text?.substring(0, 60)}${(text?.length ?? 0) > 60 ? "..." : ""}"`,
				)
				try {
					const { PiperService } = await import("@services/voice/PiperService")
					const { RhubarbService } = await import("@services/voice/RhubarbService")
					const { SpeakerGate } = await import("@services/voice/SpeakerGate")
					const voicePiperVoice =
						(this.controller.stateManager.getGlobalStateKey("voicePiperVoice") as string | undefined) ??
						"en_US-lessac-medium"

					const sentences = splitIntoSentences(text).filter((s) => s.trim())
					Logger.log(`[TTS] ${tts()} 🎵 ${sentences.length} sentence(s), voice="${voicePiperVoice}"`)

					// ── Pipeline helper: synthesize one sentence + extract lip sync ────────────
					const synthesize = async (sentence: string, idx: number) => {
						const t0 = Date.now()
						Logger.log(`[TTS] ${tts()} 🔤 Synth[${idx + 1}]: "${sentence.substring(0, 60)}"`)
						const wavBuf = await PiperService.getInstance(this.controller.context.globalStoragePath).synthesize(
							sentence,
							voicePiperVoice,
						)
						const synthMs = Date.now() - t0
						Logger.log(`[TTS] ${tts()} ✅ Synth[${idx + 1}] done: ${wavBuf.length}B in ${synthMs}ms`)
						const lipT = Date.now()
						const phonemeTimeline = await new RhubarbService().extractTimeline(wavBuf)
						Logger.log(
							`[TTS] ${tts()} 👄 LipSync[${idx + 1}]: ${phonemeTimeline.length} phonemes in ${Date.now() - lipT}ms`,
						)
						return { wavBuf, phonemeTimeline }
					}

					// ── Broadcast helpers — route to BOTH editor panel and sidebar ────────────
					// EditorPanel: useAvatarState drives lip sync via performance.now() ✅
					//              audio.play() blocked by autoplay policy there — silent fail ✅
					// Sidebar:     AudioPlayer (in VoiceRecorder) plays actual audio after user
					//              gesture — succeeds because user just clicked the mic button ✅
					const broadcast = (msg: ExtensionMessage) => {
						const gm = getGlobalVoiceMessenger()
						if (gm) {
							void gm(msg)
						}
						// Always also send to sidebar: AudioPlayer needs voice_agent_state_changed
						// to mount (PLAYING state) and voice_audio_play to play the WAV.
						void this.postMessageToWebview(msg)
					}

					SpeakerGate.getInstance().activate()
					broadcast({ type: "voice_agent_state_changed", voice_agent_state_changed: { state: "PLAYING", context: "" } })

					try {
						if (sentences.length === 0) return

						// Give React a moment to mount AudioPlayer before the first voice_audio_play arrives.
						// Pre-synthesize the first sentence during this window (net zero extra delay).
						Logger.log(`[TTS] ${tts()} 🚀 Pre-synthesizing sentence 1 (AudioPlayer mounting...)`)
						const preDelay = new Promise<void>((r) => setTimeout(r, 80)) // ~2 React render cycles
						let nextSynth: Promise<{ wavBuf: Buffer; phonemeTimeline: any[] }> = synthesize(sentences[0], 0)
						await preDelay // wait for AudioPlayer to mount

						for (let i = 0; i < sentences.length; i++) {
							// Await synthesis of the current sentence
							const { wavBuf, phonemeTimeline } = await nextSynth

							// Kick off synthesis of NEXT sentence NOW (parallel with playback below)
							if (i + 1 < sentences.length) {
								Logger.log(`[TTS] ${tts()} ⏩ Pipeline: pre-synthesizing sentence ${i + 2}`)
								nextSynth = synthesize(sentences[i + 1], i + 1)
							}

							const durationMs = getWavDurationMs(wavBuf)
							Logger.log(`[TTS] ${tts()} 🔊 Playing sentence ${i + 1}/${sentences.length}: ${durationMs}ms`)

							// Send WAV + phonemes to the active webview (editor panel or sidebar).
							// AudioPlayer.tsx will play the audio; useAvatarState will drive lip sync.
							broadcast({
								type: "voice_audio_play",
								voice_audio_play: { wavBase64: wavBuf.toString("base64"), phonemeTimeline },
							})

							// Wait for audio to finish on the webview side (duration + small buffer)
							await new Promise<void>((r) => setTimeout(r, durationMs + 200))
							Logger.log(`[TTS] ${tts()} ✅ Sentence ${i + 1} complete`)
						}

						Logger.log(`[TTS] ${tts()} 🏁 TTS pipeline complete — total ${Date.now() - ttsStart}ms`)
					} finally {
						SpeakerGate.getInstance().deactivate()
						broadcast({
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

		// One-time mic diagnostic checkpoint: detect whether getUserMedia works inside the
		// VS Code webview sandbox. Fires once per install (guarded by voice_mic_diagnostic_v1).
		const alreadyRan = this.controller.stateManager.getGlobalStateKey("voice_mic_diagnostic_v1")
		if (!alreadyRan) {
			this.controller.stateManager.setGlobalState("voice_mic_diagnostic_v1", true)
			// Give the webview a moment to render before posting
			setTimeout(() => {
				void this.postMessageToWebview({ type: "voice_mic_diagnostic" })
			}, 2000)
		}

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
				// Whisper STT removed — streaming STT (Web Speech API) is the only STT path.
				// This message type is kept as a no-op to avoid "unhandled message" errors
				// from any existing clients that may still send it.
				Logger.warn("[VscodeWebviewProvider] voice_float32_audio: Whisper STT removed, ignoring")
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
				try {
					const { SpeakerGate } = await import("@services/voice/SpeakerGate")
					if (SpeakerGate.getInstance().isBlocked()) {
						Logger.log("[VscodeWebviewProvider] Speaker gate active — ignoring recording request during TTS")
						break
					}
					const { recordAndRespond } = await import("@core/controller/voice/recordAndRespond")
					const rec = message.start_voice_recording!
					const voiceInputDeviceId = this.controller.stateManager.getGlobalStateKey("voiceInputDeviceId") as
						| string
						| undefined
					Logger.log("[VscodeWebviewProvider] Recording requested", {
						voiceInputDeviceId: voiceInputDeviceId || "UNDEFINED - will try first available device",
					})
					const response = await recordAndRespond(this.controller, {
						silenceDurationMs: rec.silenceThresholdMs || 700,
						gracePeriodMs: rec.gracePeriodMs ?? 2000,
						maxDurationMs: rec.maxDurationMs || 120000,
						inputDeviceId: voiceInputDeviceId || undefined,
					})
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
							errorMessage: `Voice recording error: ${err instanceof Error ? err.message : String(err)}`,
						},
					})
				}
				break
			}
			case "stop_voice_recording": {
				const { getActiveVoiceAgent } = await import("@core/controller/voice/recordAndRespond")
				getActiveVoiceAgent()?.destroy()
				break
			}
			case "voice_mic_diagnostic_result": {
				// Receive the one-time mic permission probe result from the webview.
				const { granted, errorName } = message.voice_mic_diagnostic_result ?? {}
				if (granted) {
					Logger.log("[VoiceDiagnostic] Mic access: GRANTED (getUserMedia succeeded inside webview)")
				} else {
					Logger.warn(
						`[VoiceDiagnostic] Mic access: DENIED — errorName=${errorName}. ` +
							"This is a permanent VS Code webview sandbox restriction (issue #119127). " +
							"STT is permanently disabled; TTS works normally.",
					)
					void vscode.window
						.showWarningMessage(
							"NexusAI: Microphone is not accessible in the VS Code webview (sandbox restriction). " +
								"Voice STT has been disabled. TTS continues to work normally.",
							"Learn More",
						)
						.then((choice) => {
							if (choice === "Learn More") {
								void vscode.env.openExternal(
									vscode.Uri.parse("https://github.com/microsoft/vscode/issues/119127"),
								)
							}
						})
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
		} catch {
			// Silently fail if editor panel is not available
		}

		return sidebarResult
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
