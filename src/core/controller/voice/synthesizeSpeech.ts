import type { Controller } from "@core/controller"
import type { SynthesizeRequest } from "@shared/proto/cline/voice"
import { SpeechResult } from "@shared/proto/cline/voice"
import { synthesizeEdgeTts } from "@/services/voice/EdgeTtsService"

/**
 * Synthesizes text to WAV audio using Edge TTS.
 * Returns the audio as a base64-encoded WAV string.
 */
export async function synthesizeSpeech(controller: Controller, request: SynthesizeRequest): Promise<SpeechResult> {
	const voice =
		request.voiceId ??
		(controller.stateManager.getGlobalStateKey("voiceEdgeTtsVoice") as string | undefined) ??
		"pt-BR-FranciscaNeural"

	const wavBuffer = await synthesizeEdgeTts(request.text, voice)
	const wavBase64 = wavBuffer.toString("base64")

	return SpeechResult.create({ wavBase64 })
}
