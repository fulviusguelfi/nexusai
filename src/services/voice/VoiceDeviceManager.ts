/**
 * Voice Device Manager
 * Auto-detects available audio devices and provides fallback chain
 */

import { Logger } from "@/shared/services/Logger"
import { enumerateWindowsAudioDevices } from "../audio/WindowsAudioCapture"

export interface AudioDevice {
	id: string
	name: string
	isDefault: boolean
	isActive: boolean
	lastChecked: number
}

export class VoiceDeviceManager {
	private static cachedDevices: Map<string, { devices: AudioDevice[]; timestamp: number }> = new Map()
	private static readonly CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
	private static selectedDeviceId: string | null = null

	/**
	 * Get list of available audio input devices
	 * Caches results for 5 minutes
	 */
	static async getAvailableDevices(): Promise<AudioDevice[]> {
		const now = Date.now()
		const cacheKey = "windows-devices"

		// Check cache
		const cached = VoiceDeviceManager.cachedDevices.get(cacheKey)
		if (cached && now - cached.timestamp < VoiceDeviceManager.CACHE_TTL_MS) {
			Logger.log("[VoiceDeviceManager] Using cached device list")
			return cached.devices
		}

		try {
			Logger.log("[VoiceDeviceManager] Enumerating Windows audio devices...")
			const deviceNames = await enumerateWindowsAudioDevices()

			Logger.log(`[VoiceDeviceManager] Found ${deviceNames.length} audio device(s): ${deviceNames.join(", ")}`)

			if (deviceNames.length === 0) {
				Logger.warn("[VoiceDeviceManager] No audio devices found")
				return []
			}

			// Convert to AudioDevice format
			const devices: AudioDevice[] = deviceNames.map((name, index) => ({
				id: `device-${index}`,
				name: VoiceDeviceManager.sanitizeDeviceName(name),
				isDefault: index === 0,
				isActive: true,
				lastChecked: now,
			}))

			Logger.log(
				`[VoiceDeviceManager] Found ${devices.length} device(s):`,
				devices.map((d) => d.name),
			)

			// Cache results
			VoiceDeviceManager.cachedDevices.set(cacheKey, {
				devices,
				timestamp: now,
			})

			return devices
		} catch (error) {
			Logger.error("[VoiceDeviceManager] Failed to enumerate devices:", error)
			throw new Error(`Failed to enumerate audio devices: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * Get the active device to use for recording
	 * Priority:
	 * 1. User-selected device
	 * 2. First available device
	 * 3. Throw error if none available
	 */
	static async getActiveDevice(): Promise<AudioDevice> {
		const devices = await VoiceDeviceManager.getAvailableDevices()

		if (devices.length === 0) {
			throw new Error("NO_DEVICES")
		}

		// If user selected a device, use it
		if (VoiceDeviceManager.selectedDeviceId) {
			const selected = devices.find((d) => d.id === VoiceDeviceManager.selectedDeviceId)
			if (selected) {
				Logger.log("[VoiceDeviceManager] Using user-selected device:", selected.name)
				return selected
			}
			Logger.warn("[VoiceDeviceManager] Selected device no longer available, using default")
		}

		// Use first device as default
		Logger.log("[VoiceDeviceManager] Using default device:", devices[0].name)
		return devices[0]
	}

	/**
	 * Get the device name/ID string for FFmpeg
	 * Format: 'audio=Device Name Here'
	 */
	static async getFFmpegDeviceString(deviceIndex = 0): Promise<string> {
		const devices = await VoiceDeviceManager.getAvailableDevices()

		if (devices.length === 0) {
			throw new Error("NO_DEVICES")
		}

		if (deviceIndex >= devices.length) {
			throw new Error(`Device index ${deviceIndex} out of range (${devices.length} devices available)`)
		}

		const device = devices[deviceIndex]
		return `audio=${device.name}`
	}

	/**
	 * Set user preference for audio device
	 */
	static setPreferredDevice(deviceId: string): void {
		Logger.log("[VoiceDeviceManager] Setting preferred device:", deviceId)
		VoiceDeviceManager.selectedDeviceId = deviceId
	}

	/**
	 * Clear cached devices (force re-enumeration)
	 * Useful if user plugged in/out devices
	 */
	static clearCache(): void {
		Logger.log("[VoiceDeviceManager] Clearing device cache")
		VoiceDeviceManager.cachedDevices.clear()
	}

	/**
	 * Sanitize device name from FFmpeg output
	 * Removes special characters and trims whitespace
	 */
	private static sanitizeDeviceName(name: string): string {
		return name.trim().replace(/^audio=|"/g, "")
	}

	/**
	 * Validate that a device still exists
	 */
	static async validateDevice(deviceId: string): Promise<boolean> {
		const devices = await VoiceDeviceManager.getAvailableDevices()
		return devices.some((d) => d.id === deviceId)
	}
}
