import type { Controller } from "@core/controller"
import type { ExtensionMessage } from "@shared/ExtensionMessage"
import type { RecordAndRespondRequest, RecordAndRespondResponse } from "@shared/proto/cline/voice"
import { PreFlightChecks } from "@/services/voice/PreFlightChecks"
import { VoiceAgent, VoiceAgentState } from "@/services/voice/VoiceAgent"
import { VoskService } from "@/services/voice/VoskService"
import { Logger } from "@/shared/services/Logger"

/**
 * Global reference to active VoiceAgent instance
 * Allows stopping from RPC handlers
 */
let activeVoiceAgent: VoiceAgent | null = null

export function getActiveVoiceAgent(): VoiceAgent | null {
	return activeVoiceAgent
}

export function setActiveVoiceAgent(agent: VoiceAgent | null): void {
	activeVoiceAgent = agent
}

// Dynamically import getGlobalVoiceMessenger to avoid circular dependency
async function getVoiceMessenger() {
	try {
		const { getGlobalVoiceMessenger } = await import("@hosts/vscode/VscodeWebviewProvider")
		return getGlobalVoiceMessenger()
	} catch (err) {
		Logger.warn("[recordAndRespond] Could not import voice messenger:", err)
		return null
	}
}

/**
 * Complete voice pipeline: Record → STT → LLM → TTS
 *
 * CORRECT FLOW (User specification):
 * ===================================
 * Stage 1: Recording & STT (Speech-to-Text)
 *   - User speaks in their language (e.g., Portuguese)
 *   - Audio captured by microphone
 *   - Whisper STT transcribes to TEXT in ORIGINAL language (NOT translated)
 *   - Language auto-detected from audio (e.g., "pt" for Portuguese)
 *   - Text written to message box in original language
 *
 * Stage 2: User sends message
 *   - User presses send button to submit transcription
 *
 * Stage 3: LLM Processing
 *   - Message sent to LLM with language context in system prompt
 *   - LLM responds in SAME language as input (Portuguese → Portuguese)
 *   - NO separate LLM call for translation (this would break language detection)
 *
 * Stage 4: TTS (Text-to-Speech)
 *   - LLM response synthesized to audio in detected language
 *   - Audio played via speakers in original language
 *
 * KEY CONSTRAINTS:
 *   ❌ NO translation at ANY stage (original language preserved)
 *   ❌ NO separate LLM call for translation
 *   ✅ Language only used as metadata in LLM system prompt
 *   ✅ Text flows through pipeline in original language
 *   ✅ UI displays detected language as badge (informational only)
 *
 * Implementation:
 * 1. Run preflight checks (FFmpeg, models, internet)
 * 2. Initialize VoiceAgent to record audio
 * 3. Process with VoiceResponseHandler (STT → TTS, NO translation)
 * 4. Return transcription + detected language + response audio
 */
export async function recordAndRespond(
	controller: Controller,
	request: RecordAndRespondRequest,
): Promise<RecordAndRespondResponse> {
	const startTime = Date.now()
	const totalDurationMs = (): number => Date.now() - startTime
	const ts = () => `[T+${totalDurationMs()}ms]`

	try {
		Logger.log(`${ts()} 🎤 start_voice_recording recebido`)

		// Step 1: Preflight checks
		Logger.log(`${ts()} 📋 Step 1: Running preflight checks...`)
		const preflightResult = await PreFlightChecks.runAll()

		if (!preflightResult.ok) {
			const blockerMessages = preflightResult.blockers.map((b) => `${b.type}: ${b.message}`).join(" | ")

			Logger.error(`${ts()} ❌ Preflight check failed: ${blockerMessages}`)

			// Send error state to webview immediately so VoiceRecorder shows error
			try {
				const messenger = await getVoiceMessenger()
				if (messenger) {
					const message: ExtensionMessage = {
						type: "voice_agent_state_changed" as const,
						voice_agent_state_changed: {
							state: "IDLE" as VoiceAgentState,
							context: `System not ready: ${blockerMessages}`,
						},
					}
					Logger.log(`[recordAndRespond] Sending error state to webview: ${blockerMessages}`)
					await messenger(message)
				}
			} catch (err) {
				Logger.error("[recordAndRespond] Failed to send error state:", err)
			}

			return {
				success: false,
				transcriptionText: "",
				llmResponseText: "",
				audioWavBase64: "",
				totalDurationMs: totalDurationMs(),
				errorMessage: `System not ready: ${blockerMessages}`,
			}
		}

		Logger.log(`${ts()} ✅ Preflight checks passed`)

		// Step 2: Record audio with VoiceAgent + real-time Vosk STT
		Logger.log(`${ts()} 🎙️ Step 2: Recording audio with Vosk streaming STT...`)

		// Init Vosk streaming recognizer for real-time partials
		const voskInitStart = Date.now()
		const voskService = new VoskService(controller.context.globalStoragePath, async (partialText: string) => {
			// Fired for every new word — send live preview to webview
			if (partialText) {
				Logger.log(`[recordAndRespond] Vosk partial: "${partialText}"`)
				const messenger = await getVoiceMessenger()
				if (messenger) {
					await messenger({
						type: "voice_stt_partial",
						voice_stt_partial: { text: partialText },
					})
				}
			}
		})

		const voskReady = await voskService.init()
		Logger.log(`${ts()} ⏱ Vosk init: ${Date.now() - voskInitStart}ms, ready=${voskReady}`)
		if (!voskReady) {
			Logger.warn("[recordAndRespond] Vosk model not available — STT will return empty transcript")
		}

		const agent = new VoiceAgent({
			maxDuration: request.maxDurationMs || 120000,
			silenceThreshold: request.silenceThreshold || 0.01,
			silenceDurationMs: request.silenceDurationMs || 700,
			gracePeriodMs: request.gracePeriodMs ?? 2000,
			deviceId: request.inputDeviceId || undefined,
			// Feed each speech chunk directly to Vosk (sub-200ms real-time partials)
			onSpeechChunk: voskReady ? (chunk: Buffer) => voskService.acceptChunk(chunk) : undefined,
			stateCallback: (state: VoiceAgentState, context?: string) => {
				Logger.log(`  State: ${state}${context ? ` - ${context}` : ""}`)
				// Send state updates to webview (async, non-blocking)
				;(async () => {
					try {
						const messenger = await getVoiceMessenger()
						Logger.log(`[recordAndRespond] getVoiceMessenger returned: ${messenger ? "found" : "null"}`)
						if (messenger) {
							const message: ExtensionMessage = {
								type: "voice_agent_state_changed" as const,
								voice_agent_state_changed: {
									state,
									context: context || "",
								},
							}
							Logger.log(`[recordAndRespond] Sending voice_agent_state_changed: ${state}`)
							const result = await messenger(message)
							Logger.log(`[recordAndRespond] messenger returned: ${result}`)
						} else {
							Logger.warn("[recordAndRespond] No voice messenger available")
						}
					} catch (err) {
						Logger.error("[recordAndRespond] Failed to send state to webview:", err)
					}
				})()
			},
			errorCallback: (error) => {
				Logger.error(`  Error in VoiceAgent: ${error.userMessage}`)
			},
		})

		// Store reference for stop_voice_recording RPC
		setActiveVoiceAgent(agent)

		let recordResult: any
		try {
			recordResult = await agent.recordAndRespond()
		} finally {
			// Clear active agent reference
			setActiveVoiceAgent(null)
			agent.destroy()
		}

		if (!recordResult || recordResult.error) {
			voskService.free()
			const errorMsg = recordResult?.error?.userMessage || "Recording failed"
			Logger.error(`❌ Recording failed: ${errorMsg}`)

			return {
				success: false,
				transcriptionText: "",
				llmResponseText: "",
				audioWavBase64: "",
				totalDurationMs: totalDurationMs(),
				errorMessage: errorMsg,
			}
		}

		Logger.log(`${ts()} ✅ Audio recorded: ${recordResult.duration}ms`)

		// Step 3: Get final transcript from Vosk (no Whisper needed)
		Logger.log(`${ts()} 🔄 Step 3: Flushing Vosk final transcript...`)
		const finalStart = Date.now()
		const transcriptionText = voskReady ? await voskService.getFinalTranscript() : ""
		Logger.log(`${ts()} ⏱ Vosk finalize: ${Date.now() - finalStart}ms`)
		voskService.free()

		Logger.log(`${ts()} ✍️ Transcrição Vosk: "${transcriptionText}"`)

		if (!transcriptionText && voskReady) {
			Logger.warn("[recordAndRespond] Vosk returned empty transcript")
		}

		Logger.log(`${ts()} 🏁 Pipeline total: ${totalDurationMs()}ms`)
		Logger.log(`${ts()} ⏭️ Usuário enviará para o LLM — TTS após resposta`)

		// Signal that the next user message submission comes from voice input
		controller.pendingVoiceInput = true

		return {
			success: true,
			transcriptionText,
			llmResponseText: "",
			audioWavBase64: "",
			totalDurationMs: totalDurationMs(),
			detectedLanguage: "pt",
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error)
		Logger.error(`❌ recordAndRespond fatal error: ${errorMsg}`)

		return {
			success: false,
			transcriptionText: "",
			llmResponseText: "",
			audioWavBase64: "",
			totalDurationMs: totalDurationMs(),
			errorMessage: `Fatal error: ${errorMsg}`,
		}
	}
}
