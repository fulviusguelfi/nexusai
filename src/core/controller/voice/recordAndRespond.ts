import type { Controller } from "@core/controller"
import type { ExtensionMessage } from "@shared/ExtensionMessage"
import type { RecordAndRespondRequest, RecordAndRespondResponse } from "@shared/proto/cline/voice"
import { PreFlightChecks } from "@/services/voice/PreFlightChecks"
import { VoiceAgent, VoiceAgentState } from "@/services/voice/VoiceAgent"
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
	_controller: Controller,
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

		// Step 2: Record audio with VoiceAgent
		Logger.log(`${ts()} 🎙️ Step 2: Recording audio...`)

		const agent = new VoiceAgent({
			maxDuration: request.maxDurationMs || 30000,
			silenceThreshold: request.silenceThreshold || 0.01,
			silenceDurationMs: request.silenceDurationMs || 700,
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

		// Step 3: ONLY Speech-to-Text (transcription only, NO TTS)
		Logger.log(`${ts()} 🔄 Step 3: Processing with STT only...`)
		Logger.log(`${ts()} ⚡ Whisper iniciado — ${recordResult.audioData?.length ?? 0} bytes`)

		const sttResult = await VoiceResponseHandler.processSpeechToText(recordResult.audioData, {
			globalStoragePath: _controller.context.globalStoragePath,
			sttModel: request.sttModel || "whisper-tiny",
			userLanguage: "pt", // Hint to Whisper that user likely speaks Portuguese (Brasil)
			maxDuration: request.maxDurationMs,
			onProgress: (progress: number) => {
				Logger.log(`  STT: ${progress}%`)
				// TODO: Send progress updates to webview
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

		// Step 4: Return transcribed text ONLY (without audio)
		Logger.log(`${ts()} ✍️ Transcrição: "${sttResult.transcription.text}" [${sttResult.detectedLanguage}]`)
		Logger.log(`${ts()} 🏁 Pipeline total: ${totalDurationMs()}ms`)
		Logger.log(`${ts()} ⏭️ Usuário enviará para o LLM — TTS após resposta`)

		return {
			success: true,
			transcriptionText: sttResult.transcription.text,
			llmResponseText: "", // Empty - LLM hasn't responded yet
			audioWavBase64: "", // Empty - no TTS yet! TTS happens after LLM response
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
