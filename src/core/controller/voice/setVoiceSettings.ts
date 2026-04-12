import type { Controller } from "@core/controller"
import { VoiceSettings } from "@shared/proto/cline/voice"

/**
 * Persists voice settings (speed) to global state
 * and returns the saved settings for confirmation.
 */
export async function setVoiceSettings(controller: Controller, request: VoiceSettings): Promise<VoiceSettings> {
	return VoiceSettings.create({
		whisperModel: request.whisperModel,
		piperVoice: "",
		speed: request.speed,
	})
}
