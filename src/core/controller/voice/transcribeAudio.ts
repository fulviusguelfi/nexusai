import type { Controller } from "@core/controller"
import type { AudioChunk } from "@shared/proto/cline/voice"
import { TranscriptionResult } from "@shared/proto/cline/voice"
import { VoiceSessionManager } from "@/services/voice/VoiceSessionManager"
import { WhisperService } from "@/services/voice/WhisperService"

/**
 * Transcribes Float32 PCM audio using the local Whisper ONNX model.
 */
export async function transcribeAudio(controller: Controller, request: AudioChunk): Promise<TranscriptionResult> {
	const float32PCM = new Float32Array(
		request.float32Pcm.buffer,
		request.float32Pcm.byteOffset,
		request.float32Pcm.byteLength / 4,
	)
	const sampleRate = request.sampleRate || 16000

	const whisper = WhisperService.getInstance(controller.context.globalStoragePath)
	const text = await whisper.transcribe(float32PCM, sampleRate)

	// Persist the transcription in the session manager so the listen tool can resolve
	VoiceSessionManager.getInstance().setLastTranscription(text)

	return TranscriptionResult.create({ text, confidence: 1.0 })
}
