import type { Controller } from "@core/controller"
import type { SynthesizeRequest } from "@shared/proto/nexusai/voice"
import { SpeechResult } from "@shared/proto/nexusai/voice"
import { PiperService } from "@/services/voice/PiperService"

/**
 * Synthesizes text to WAV audio using local Piper TTS.
 * Returns the audio as a base64-encoded WAV string.
 */
export async function synthesizeSpeech(controller: Controller, request: SynthesizeRequest): Promise<SpeechResult> {
	const piper = PiperService.getInstance(controller.context.globalStoragePath)
	const voiceId = request.voiceId ?? (controller.stateManager.getGlobalStateKey("voicePiperVoice") as string | undefined)

	const wavBuffer = await piper.synthesize(request.text, voiceId)
	const wavBase64 = wavBuffer.toString("base64")

	return SpeechResult.create({ wavBase64 })
}
