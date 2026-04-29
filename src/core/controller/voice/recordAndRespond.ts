import type { Controller } from "@core/controller"
import type { ExtensionMessage } from "@shared/ExtensionMessage"
import type { RecordAndRespondRequest, RecordAndRespondResponse } from "@shared/proto/cline/voice"
import { PreFlightChecks } from "@/services/voice/PreFlightChecks"
import { VoiceAgent, VoiceAgentState } from "@/services/voice/VoiceAgent"
import { VoiceDeviceManager } from "@/services/voice/VoiceDeviceManager"
import { VoiceResponseHandler } from "@/services/voice/VoiceResponseHandler"
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
	request: RecordAndRespondRequest & {
		onAgentCreated?: (agent: VoiceAgent) => void
		onAgentDestroyed?: () => void
	},
): Promise<RecordAndRespondResponse> {
	const startTime = Date.now()
	const totalDurationMs = (): number => Date.now() - startTime
	const ts = () => `[T+${totalDurationMs()}ms]`

	const shouldRetryWithoutPreferredDevice = (recordResult: any): boolean => {
		if (!request.inputDeviceId || !recordResult?.error) {
			return false
		}

		const errorCode = String(recordResult.error.code || "").toUpperCase()
		const errorMessage = String(recordResult.error.userMessage || recordResult.error.message || "").toLowerCase()

		return (
			errorCode === "DEVICE_NOT_FOUND" ||
			errorMessage.includes("microphone not found") ||
			errorMessage.includes("device not found") ||
			errorMessage.includes("no microphones found")
		)
	}

	const runAgentRecording = async (deviceId?: string) => {
		const agent = new VoiceAgent({
			maxDuration: request.maxDurationMs || 120000,
			deviceId: deviceId || undefined,
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

		// Store reference for stop_voice_recording RPC (both module-level + Provider instance)
		setActiveVoiceAgent(agent)
		request.onAgentCreated?.(agent)
		Logger.log(`[recordAndRespond] Agent registered at T=${Date.now()}`)

		try {
			return await agent.recordAndRespond()
		} finally {
			// Clear active agent reference
			setActiveVoiceAgent(null)
			request.onAgentDestroyed?.()
			Logger.log(`[recordAndRespond] finally: calling agent.stop(from=finally) at T=${Date.now()}`)
			agent.stop("finally")
		}
	}

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

		// Step 2: Record audio with VoiceAgent (push-to-talk)
		Logger.log(`${ts()} 🎙️ Step 2: Recording audio (push-to-talk)...`)

		let recordResult: any = await runAgentRecording(request.inputDeviceId || undefined)

		if (shouldRetryWithoutPreferredDevice(recordResult)) {
			Logger.warn(
				`${ts()} ⚠️ Preferred input device is unavailable. Clearing cache and retrying once with auto-detected microphone.`,
			)
			VoiceDeviceManager.clearCache()
			recordResult = await runAgentRecording(undefined)
		}

		if (!recordResult || recordResult.error) {
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

		// Step 3: Single-shot STT (full recording -> single transcription)
		Logger.log(`${ts()} 🔄 Step 3: Running Whisper transcription...`)
		const sttResult = await VoiceResponseHandler.processSpeechToText(recordResult.audioData, {
			globalStoragePath: controller.context.globalStoragePath,
			sttModel: request.sttModel || "small",
			userLanguage: "pt",
			onProgress: (progress: number) => {
				void getVoiceMessenger().then((messenger) => {
					messenger?.({
						type: "voice_stt_progress",
						voice_stt_progress: { progress, stage: "transcribing" },
					})
				})
			},
		})

		if (sttResult.error) {
			Logger.error(`❌ STT failed: ${sttResult.error.message}`)

			return {
				success: false,
				transcriptionText: sttResult.transcription.text,
				llmResponseText: "",
				audioWavBase64: "",
				totalDurationMs: totalDurationMs(),
				errorMessage: sttResult.error.message,
				detectedLanguage: sttResult.detectedLanguage,
			}
		}

		Logger.log(`${ts()} ✍️ Transcrição: "${sttResult.transcription.text}"`)

		Logger.log(`${ts()} 🏁 Pipeline total: ${totalDurationMs()}ms`)
		Logger.log(`${ts()} ⏭️ Usuário enviará para o LLM — TTS após resposta`)

		// Signal that the next user message submission comes from voice input
		controller.pendingVoiceInput = true

		return {
			success: true,
			transcriptionText: sttResult.transcription.text,
			llmResponseText: "",
			audioWavBase64: "",
			totalDurationMs: totalDurationMs(),
			detectedLanguage: sttResult.detectedLanguage,
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
