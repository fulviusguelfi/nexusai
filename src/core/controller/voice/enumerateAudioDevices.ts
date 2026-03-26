import type { Controller } from "@core/controller"
import { enumerateWindowsAudioDevices } from "@services/audio/WindowsAudioCapture"
import { AudioDevice, AudioDevicesResponse } from "@shared/proto/cline/voice"
import { Logger } from "@shared/services/Logger"

/**
 * Enumerate audio input and output devices
 * Returns real device names extracted from FFmpeg DirectShow enumeration
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function enumerateAudioDevices(
	_controller: Controller,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_request: any,
): Promise<AudioDevicesResponse> {
	try {
		Logger.log("[EnumerateAudioDevices] Enumeration requested")

		// Enumerate devices via FFmpeg DirectShow
		const ffmpegDevices = await enumerateWindowsAudioDevices()
		Logger.log("[EnumerateAudioDevices] FFmpeg returned:", ffmpegDevices)

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
