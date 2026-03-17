import type { Controller } from "@core/controller"
import type { EmptyRequest } from "@shared/proto/cline/common"
import { VoiceStatus } from "@shared/proto/cline/voice"
import { PiperService } from "@/services/voice/PiperService"
import { VoiceSessionManager } from "@/services/voice/VoiceSessionManager"
import { WhisperService } from "@/services/voice/WhisperService"

/**
 * Returns the current voice subsystem status including model availability.
 */
export async function getVoiceStatus(controller: Controller, _request: EmptyRequest): Promise<VoiceStatus> {
	const storagePath = controller.context.globalStoragePath

	const whisper = WhisperService.getInstance(storagePath)
	const piper = PiperService.getInstance(storagePath)
	const session = VoiceSessionManager.getInstance()

	return VoiceStatus.create({
		whisperModelDownloaded: whisper.isModelDownloaded(),
		piperBinaryDownloaded: piper.isBinaryInstalled(),
		isRecording: session.isRecording,
		isSpeaking: session.isSpeaking,
		lastTranscription: session.lastTranscription,
	})
}
