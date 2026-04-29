/**
 * AudioCapturePool — pre-warm FFmpeg/dshow to eliminate the ~500ms startup latency.
 *
 * Strategy:
 *   - `preWarm()` spawns FFmpeg at startup and drains mic audio silently.
 *   - The pool marks itself `ready` once the first audio chunk arrives (dshow stable).
 *   - `lease()` returns the warm capture + its start-promise (or null if not ready).
 *   - After a lease, `preWarm()` is called immediately to prepare the next capture.
 *
 * Result: clicking the mic button → READY_TO_LISTEN is instantaneous.
 */

import { Logger } from "@/shared/services/Logger"
import { WindowsAudioCapture } from "./WindowsAudioCapture"

interface DrainCapture {
	capture: WindowsAudioCapture
	promise: Promise<void>
	deviceId?: string
}

export class AudioCapturePool {
	private static _held: DrainCapture | null = null
	private static _ready = false // true once first chunk arrived (dshow stable)
	private static _starting = false

	private static normalizeDeviceId(deviceId?: string): string | undefined {
		if (!deviceId) return undefined
		const trimmed = deviceId.trim().replace(/^"|"$/g, "")
		const withPrefix = trimmed.toLowerCase().startsWith("audio=") ? trimmed : `audio=${trimmed}`
		return withPrefix.toLowerCase()
	}

	/**
	 * Start a background FFmpeg capture that warms up dshow and drains silently.
	 * Safe to call multiple times — bails out immediately if already warming or ready.
	 */
	static async preWarm(deviceId?: string): Promise<void> {
		if (AudioCapturePool._starting || AudioCapturePool._held) return
		AudioCapturePool._starting = true
		AudioCapturePool._ready = false

		Logger.log("[AudioCapturePool] Starting pre-warm...")

		try {
			const requestedDeviceId = AudioCapturePool.normalizeDeviceId(deviceId)
			const capture = new WindowsAudioCapture()
			// maxDuration = 5 minutes to outlast any typical session
			const promise = capture.startCapture({
				sampleRate: 16000,
				channels: 1,
				duration: 300,
				deviceId,
				onChunk: () => {
					if (!AudioCapturePool._ready) {
						AudioCapturePool._ready = true
						// Detach the noop callback — no-op so it doesn't waste cycles
						capture.setChunkCallback(() => {})
						Logger.log("[AudioCapturePool] dshow stable — first chunk received, ready to lease")
					}
				},
				onError: (err) => {
					Logger.warn("[AudioCapturePool] Pre-warm error:", err.message)
					AudioCapturePool._held = null
					AudioCapturePool._ready = false
					AudioCapturePool._starting = false
				},
			})

			AudioCapturePool._held = { capture, promise, deviceId: requestedDeviceId }
		} catch (err) {
			Logger.warn("[AudioCapturePool] Pre-warm failed to start:", err)
		} finally {
			AudioCapturePool._starting = false
		}
	}

	/**
	 * Lease the pre-warmed capture.
	 * Returns `null` if the pool is not ready (caller falls back to fresh FFmpeg start).
	 * After lease, immediately starts warming the next capture.
	 */
	static lease(deviceId?: string): DrainCapture | null {
		if (!AudioCapturePool._held || !AudioCapturePool._ready) {
			Logger.log(
				`[AudioCapturePool] lease() — not ready (ready=${AudioCapturePool._ready}, held=${!!AudioCapturePool._held})`,
			)
			return null
		}

		const requestedDeviceId = AudioCapturePool.normalizeDeviceId(deviceId)
		const heldDeviceId = AudioCapturePool._held.deviceId
		if (requestedDeviceId && heldDeviceId && requestedDeviceId !== heldDeviceId) {
			Logger.log(
				`[AudioCapturePool] lease() — device mismatch (requested=${requestedDeviceId}, held=${heldDeviceId}), fallback to fresh capture`,
			)
			return null
		}

		const leased = AudioCapturePool._held
		AudioCapturePool._held = null
		AudioCapturePool._ready = false
		AudioCapturePool._starting = false

		Logger.log("[AudioCapturePool] Leased pre-warmed capture — starting next pre-warm")

		// Immediately start warming the next capture
		void AudioCapturePool.preWarm(leased.deviceId)

		return leased
	}

	/** True if a warm capture is available for immediate use */
	static get isWarm(): boolean {
		return AudioCapturePool._ready
	}
}
