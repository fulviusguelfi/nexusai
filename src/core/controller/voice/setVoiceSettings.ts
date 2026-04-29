import type { Controller } from "@core/controller"
import { VoiceSettings } from "@shared/proto/cline/voice"

/**
 * Returns the provided voice settings as-is (placeholder — persistence not yet implemented).
 */
export async function setVoiceSettings(_controller: Controller, request: VoiceSettings): Promise<VoiceSettings> {
	return VoiceSettings.create({
		whisperModel: request.whisperModel,
		piperVoice: "",
		speed: request.speed,
	})
}
