import type { Controller } from "@core/controller"
import { VoiceDeviceManager } from "@services/voice/VoiceDeviceManager"
import { AudioDevice, AudioDevicesResponse } from "@shared/proto/cline/voice"
import { Logger } from "@shared/services/Logger"

/**
 * Enumerate audio input and output devices.
 * Routes through VoiceDeviceManager so the result is cached for 5 minutes —
 * subsequent calls (including the one inside VoiceAgent.initialize) hit the cache
 * instead of spawning a new FFmpeg process.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function enumerateAudioDevices(
	_controller: Controller,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_request: any,
): Promise<AudioDevicesResponse> {
	try {
		Logger.log("[EnumerateAudioDevices] Enumeration requested")

		// Use VoiceDeviceManager so result is shared/cached (avoids double FFmpeg spawn)
		const availableDevices = await VoiceDeviceManager.getAvailableDevices()
		const ffmpegDevices = availableDevices.map((d) => `audio=${d.name}`)
		Logger.log("[EnumerateAudioDevices] Devices (via VoiceDeviceManager cache):", ffmpegDevices)

		// Convert FFmpeg format "audio=Device Name" to proto format
		const inputDevices: AudioDevice[] = ffmpegDevices.map((deviceStr) => {
			// deviceStr is like "audio=Microfone (Jabra Link 380)"
			const deviceName = deviceStr.replace("audio=", "")
			return AudioDevice.create({
				deviceId: deviceStr,
				label: deviceName,
			})
		})

		Logger.log("[EnumerateAudioDevices] Mapped to proto format:", inputDevices)

		return AudioDevicesResponse.create({
			inputDevices,
			outputDevices: [], // Windows output enumeration not yet implemented
			error: undefined,
		})
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err)
		Logger.error("[EnumerateAudioDevices] Error:", errorMessage)

		return AudioDevicesResponse.create({
			inputDevices: [],
			outputDevices: [],
			error: errorMessage,
		})
	}
}
