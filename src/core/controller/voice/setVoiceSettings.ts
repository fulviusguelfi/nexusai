import type { Controller } from "@core/controller"
import { VoiceSettings } from "@shared/proto/nexusai/voice"

/**
 * Persists voice settings (piper voice, speed) to global state
 * and returns the saved settings for confirmation.
 */
export async function setVoiceSettings(controller: Controller, request: VoiceSettings): Promise<VoiceSettings> {
	if (request.piperVoice) {
		await controller.stateManager.setGlobalState("voicePiperVoice", request.piperVoice)
	}

	const piperVoice = controller.stateManager.getGlobalStateKey("voicePiperVoice") ?? request.piperVoice ?? ""

	return VoiceSettings.create({
		whisperModel: request.whisperModel,
		piperVoice,
		speed: request.speed,
	})
}
