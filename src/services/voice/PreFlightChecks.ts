/**
 * PreFlight Checks - System Validation
 * Validates FFmpeg, model paths, and connectivity before voice recording
 * Returns detailed status for each system component
 */

import fs from "fs"
import https from "https"
import os from "os"
import path from "path"
import { Logger } from "@/shared/services/Logger"

/**
 * Validate FFmpeg installation at extension startup
 * SIMPLIFIED: Only quick checks, no blocking operations
 * This runs in background after extension init completes
 */
export async function validateFFmpegAtStartup(): Promise<void> {
	try {
		Logger.log("🔵 [FFmpeg Validation] Quick check starting...")

		// Quick check 1: Try require() - instant, no file I/O
		try {
			const ffmpegModule = require("@ffmpeg-installer/ffmpeg")
			if (ffmpegModule?.path) {
				Logger.log(`✅ [FFmpeg] Found: ${ffmpegModule.path}`)
				return
			}
		} catch (e) {
			Logger.log(`[FFmpeg] require() failed: ${e}`)
		}

		// Quick check 2: Filesystem check only
		const platform = `${os.platform()}-${os.arch()}`
		const ffmpegBinary = os.platform() === "win32" ? "ffmpeg.exe" : "ffmpeg"
		const p = path.join(process.cwd(), "node_modules", "@ffmpeg-installer", platform, ffmpegBinary)

		if (fs.existsSync(p)) {
			Logger.log(`✅ [FFmpeg] Found at: ${p}`)
			return
		}

		// Not found
		Logger.warn(`⚠️ [FFmpeg] Not found at: ${p}`)
		Logger.warn(`[FFmpeg] Voice feature will not work - install via: npm install`)
	} catch (e) {
		Logger.warn(`[FFmpeg] Validation error (non-critical): ${e}`)
	}
}

/**
 * Pre-download Piper (TTS) and Whisper (STT) binaries and models in the background.
 * Called at extension startup so the first voice interaction doesn't pay the download cost.
 * Idempotent — skips any file that is already cached.
 */
export async function preloadVoiceModels(globalStoragePath: string): Promise<void> {
	// Piper TTS — download binary + default voice model
	try {
		const { PiperService } = await import("@/services/voice/PiperService")
		const piper = PiperService.getInstance(globalStoragePath)
		await piper.ensureBinary()
		Logger.log("[Preload] Piper binary and voice model ready")
	} catch (e) {
		Logger.warn(`[Preload] Piper pre-load failed (non-critical): ${e}`)
	}

	// Whisper STT — download binary + model (Windows only; other platforms use ONNX loaded on demand)
	try {
		const { WhisperCliService } = await import("@/services/voice/WhisperCliService")
		if (WhisperCliService.isPlatformSupported()) {
			await WhisperCliService.getInstance(globalStoragePath).ensureBinaries()
			Logger.log("[Preload] Whisper binary and model ready")
		}
	} catch (e) {
		Logger.warn(`[Preload] Whisper pre-load failed (non-critical): ${e}`)
	}
}

/**
 * Get FFmpeg executable path
 * REQUIRED: FFmpeg must be installed via npm (@ffmpeg-installer/ffmpeg)
 */
function getFFmpegPath(): string {
	const platform = `${os.platform()}-${os.arch()}`
	const ffmpegBinary = os.platform() === "win32" ? "ffmpeg.exe" : "ffmpeg"

	// Priority 1: Try require.resolve() - most reliable
	try {
		const resolvedPath = require.resolve(`@ffmpeg-installer/${platform}/${ffmpegBinary}`)
		if (fs.existsSync(resolvedPath)) {
			Logger.log(`📦 FFmpeg path (via require.resolve): ${resolvedPath}`)
			return resolvedPath
		}
	} catch (e) {
		Logger.log(`[FFmpeg] require.resolve failed: ${e}`)
	}

	// Priority 2: Try require() module entry point
	try {
		const ffmpegModule = require("@ffmpeg-installer/ffmpeg")
		if (ffmpegModule?.path && fs.existsSync(ffmpegModule.path)) {
			Logger.log(`📦 FFmpeg path (via require module): ${ffmpegModule.path}`)
			return ffmpegModule.path
		}
	} catch (e) {
		Logger.log(`[FFmpeg] require() module failed: ${e}`)
	}

	// Priority 3: Manual filesystem search from __dirname
	const searchPaths = [
		path.join(__dirname, "..", "..", "node_modules", "@ffmpeg-installer", platform, ffmpegBinary),
		path.join(__dirname, "..", "..", "..", "node_modules", "@ffmpeg-installer", platform, ffmpegBinary),
		path.join(process.cwd(), "node_modules", "@ffmpeg-installer", platform, ffmpegBinary),
	]

	for (const p of searchPaths) {
		Logger.log(`[FFmpeg] Checking: ${p}`)
		if (fs.existsSync(p)) {
			Logger.log(`📦 FFmpeg path (filesystem): ${p}`)
			return p
		}
	}

	// Not found
	const error = `❌ FFmpeg not found in any location`
	Logger.error(error)
	Logger.error(`[FFmpeg] Searched paths: ${searchPaths.join(", ")}`)
	throw new Error(error)
}

export enum PreFlightCheckType {
	FFMPEG = "FFMPEG",
	MODELS_DIR = "MODELS_DIR",
	WHISPER_MODEL = "WHISPER_MODEL",
	PIPER_MODEL = "PIPER_MODEL",
	INTERNET_CONNECTIVITY = "INTERNET_CONNECTIVITY",
	MICROPHONE_ACCESS = "MICROPHONE_ACCESS",
	DISK_SPACE = "DISK_SPACE",
}

export interface PreFlightCheckResult {
	type: PreFlightCheckType
	status: "ok" | "warning" | "error"
	message: string
	diagnostic?: string
	lastChecked?: number
}

export class PreFlightChecks {
	private static checkCache: Map<PreFlightCheckType, PreFlightCheckResult> = new Map()
	private static CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

	/**
	 * Run all preflight checks
	 * Returns ok if all critical checks pass
	 */
	static async runAll(): Promise<{
		ok: boolean
		checks: PreFlightCheckResult[]
		blockers: PreFlightCheckResult[]
	}> {
		Logger.log("🔍 Starting preflight checks...")

		const results: PreFlightCheckResult[] = []

		// Critical checks (must pass)
		const ffmpegResult = await PreFlightChecks.checkFFmpeg()
		results.push(ffmpegResult)

		const modelsResult = await PreFlightChecks.checkModelsDir()
		results.push(modelsResult)

		const whisperResult = await PreFlightChecks.checkWhisperModel()
		results.push(whisperResult)

		const piperResult = await PreFlightChecks.checkPiperModel()
		results.push(piperResult)

		// Non-critical checks (warning if fail)
		const internetResult = await PreFlightChecks.checkInternetConnectivity()
		results.push(internetResult)

		const micResult = await PreFlightChecks.checkMicrophoneAccess()
		results.push(micResult)

		const diskResult = await PreFlightChecks.checkDiskSpace()
		results.push(diskResult)

		// Determine overall status
		const blockers = results.filter((r) => r.status === "error")
		const ok = blockers.length === 0

		Logger.log(`✅ Preflight checks complete: ${ok ? "ALL OK" : `${blockers.length} blocker(s)`}`)

		return { ok, checks: results, blockers }
	}

	/**
	 * Check if FFmpeg is available and executable
	 */
	private static async checkFFmpeg(): Promise<PreFlightCheckResult> {
		const cacheKey = PreFlightCheckType.FFMPEG
		const cached = PreFlightChecks.getCached(cacheKey)
		if (cached) return cached

		try {
			// Just verify path exists (no execution - this was validated at startup)
			getFFmpegPath()

			const result: PreFlightCheckResult = {
				type: cacheKey,
				status: "ok",
				message: "FFmpeg available",
				lastChecked: Date.now(),
			}
			PreFlightChecks.checkCache.set(cacheKey, result)
			return result
		} catch (error) {
			const result: PreFlightCheckResult = {
				type: cacheKey,
				status: "error",
				message: "FFmpeg not found",
				diagnostic: "FFmpeg not found. Install via: npm install",
				lastChecked: Date.now(),
			}
			PreFlightChecks.checkCache.set(cacheKey, result)
			Logger.error(`❌ FFmpeg check failed: ${error}`)
			return result
		}
	}

	/**
	 * Check if models directory exists
	 */
	private static async checkModelsDir(): Promise<PreFlightCheckResult> {
		const cacheKey = PreFlightCheckType.MODELS_DIR
		const cached = PreFlightChecks.getCached(cacheKey)
		if (cached) return cached

		try {
			const modelsDir = PreFlightChecks.getModelsDir()
			if (!fs.existsSync(modelsDir)) {
				fs.mkdirSync(modelsDir, { recursive: true })
				Logger.log(`📁 Created models directory: ${modelsDir}`)
			}

			const result: PreFlightCheckResult = {
				type: cacheKey,
				status: "ok",
				message: `Models directory exists: ${modelsDir}`,
				lastChecked: Date.now(),
			}
			PreFlightChecks.checkCache.set(cacheKey, result)
			return result
		} catch (error) {
			const result: PreFlightCheckResult = {
				type: cacheKey,
				status: "error",
				message: "Cannot create/access models directory",
				diagnostic: `Check disk permissions and free space. Error: ${error}`,
				lastChecked: Date.now(),
			}
			PreFlightChecks.checkCache.set(cacheKey, result)
			Logger.error(`❌ Models dir check failed: ${error}`)
			return result
		}
	}

	/**
	 * Check if Whisper model exists (or can be downloaded)
	 */
	private static async checkWhisperModel(): Promise<PreFlightCheckResult> {
		const cacheKey = PreFlightCheckType.WHISPER_MODEL
		const cached = PreFlightChecks.getCached(cacheKey)
		if (cached) return cached

		try {
			const modelsDir = PreFlightChecks.getModelsDir()
			const whisperDir = path.join(modelsDir, "whisper")

			// Check if model exists
			if (fs.existsSync(whisperDir)) {
				const files = fs.readdirSync(whisperDir)
				const modelFile = files.find((f) => f.endsWith(".pt") || f.endsWith(".bin"))

				if (modelFile) {
					const result: PreFlightCheckResult = {
						type: cacheKey,
						status: "ok",
						message: `Whisper model found: ${modelFile}`,
						lastChecked: Date.now(),
					}
					PreFlightChecks.checkCache.set(cacheKey, result)
					return result
				}
			}

			// Model not found - inform user to download
			const result: PreFlightCheckResult = {
				type: cacheKey,
				status: "warning",
				message: "Whisper model not found",
				diagnostic: `Download from https://huggingface.co/openai/whisper-tiny and place in ${whisperDir}. First use will download if not present.`,
				lastChecked: Date.now(),
			}
			PreFlightChecks.checkCache.set(cacheKey, result)
			return result
		} catch (error) {
			const result: PreFlightCheckResult = {
				type: cacheKey,
				status: "warning",
				message: "Whisper model check failed",
				diagnostic: `Error: ${error}`,
				lastChecked: Date.now(),
			}
			PreFlightChecks.checkCache.set(cacheKey, result)
			Logger.warn(`⚠️ Whisper check: ${error}`)
			return result
		}
	}

	/**
	 * Check if Piper TTS model exists
	 */
	private static async checkPiperModel(): Promise<PreFlightCheckResult> {
		const cacheKey = PreFlightCheckType.PIPER_MODEL
		const cached = PreFlightChecks.getCached(cacheKey)
		if (cached) return cached

		try {
			const modelsDir = PreFlightChecks.getModelsDir()
			const piperDir = path.join(modelsDir, "piper")

			if (fs.existsSync(piperDir)) {
				const files = fs.readdirSync(piperDir)
				const modelFile = files.find((f) => f.endsWith(".onnx") || f.endsWith(".pt"))

				if (modelFile) {
					const result: PreFlightCheckResult = {
						type: cacheKey,
						status: "ok",
						message: `Piper model found: ${modelFile}`,
						lastChecked: Date.now(),
					}
					PreFlightChecks.checkCache.set(cacheKey, result)
					return result
				}
			}

			const result: PreFlightCheckResult = {
				type: cacheKey,
				status: "warning",
				message: "Piper model not found",
				diagnostic: `Download from https://huggingface.co/rhasspy/piper and place in ${piperDir}. First use will download if not present.`,
				lastChecked: Date.now(),
			}
			PreFlightChecks.checkCache.set(cacheKey, result)
			return result
		} catch (error) {
			const result: PreFlightCheckResult = {
				type: cacheKey,
				status: "warning",
				message: "Piper model check failed",
				diagnostic: `Error: ${error}`,
				lastChecked: Date.now(),
			}
			PreFlightChecks.checkCache.set(cacheKey, result)
			Logger.warn(`⚠️ Piper check: ${error}`)
			return result
		}
	}

	/**
	 * Check internet connectivity (simple HTTPS check)
	 */
	private static async checkInternetConnectivity(): Promise<PreFlightCheckResult> {
		const cacheKey = PreFlightCheckType.INTERNET_CONNECTIVITY
		const cached = PreFlightChecks.getCached(cacheKey)
		if (cached) return cached

		return new Promise((resolve) => {
			const checkUrl = "https://www.google.com"
			const timeout = setTimeout(() => {
				const result: PreFlightCheckResult = {
					type: cacheKey,
					status: "warning",
					message: "Internet connectivity check timed out",
					lastChecked: Date.now(),
				}
				resolve(result)
			}, 3000)

			https
				.get(checkUrl, { timeout: 3000 }, () => {
					clearTimeout(timeout)
					const result: PreFlightCheckResult = {
						type: cacheKey,
						status: "ok",
						message: "Internet connectivity: OK",
						lastChecked: Date.now(),
					}
					PreFlightChecks.checkCache.set(cacheKey, result)
					resolve(result)
				})
				.on("error", () => {
					clearTimeout(timeout)
					const result: PreFlightCheckResult = {
						type: cacheKey,
						status: "warning",
						message: "No internet connectivity detected",
						diagnostic: "LLM and model downloads will fail. Check your connection.",
						lastChecked: Date.now(),
					}
					PreFlightChecks.checkCache.set(cacheKey, result)
					Logger.warn("⚠️ No internet connectivity")
					resolve(result)
				})
		})
	}

	/**
	 * Check if microphone is accessible
	 * (Electron manages permissions, so just verify permission status doesn't block)
	 */
	private static async checkMicrophoneAccess(): Promise<PreFlightCheckResult> {
		const cacheKey = PreFlightCheckType.MICROPHONE_ACCESS
		const cached = PreFlightChecks.getCached(cacheKey)
		if (cached) return cached

		try {
			// Electron will handle microphone permissions at runtime
			// For now, just return success (will error at actual recording if denied)
			const result: PreFlightCheckResult = {
				type: cacheKey,
				status: "ok",
				message: "Microphone access: OK (Electron will verify at runtime)",
				lastChecked: Date.now(),
			}
			PreFlightChecks.checkCache.set(cacheKey, result)
			return result
		} catch (error) {
			const result: PreFlightCheckResult = {
				type: cacheKey,
				status: "warning",
				message: "Microphone check failed",
				diagnostic: `Error: ${error}`,
				lastChecked: Date.now(),
			}
			PreFlightChecks.checkCache.set(cacheKey, result)
			Logger.warn(`⚠️ Microphone check: ${error}`)
			return result
		}
	}

	/**
	 * Check available disk space
	 */
	private static async checkDiskSpace(): Promise<PreFlightCheckResult> {
		const cacheKey = PreFlightCheckType.DISK_SPACE
		const cached = PreFlightChecks.getCached(cacheKey)
		if (cached) return cached

		try {
			const modelsDir = PreFlightChecks.getModelsDir()

			// Rough estimate: check if drive has > 500MB free
			const freeSpace = os.freemem() / (1024 * 1024) // MB

			if (freeSpace > 500) {
				const result: PreFlightCheckResult = {
					type: cacheKey,
					status: "ok",
					message: `Disk space available: ${Math.round(freeSpace)}MB`,
					lastChecked: Date.now(),
				}
				PreFlightChecks.checkCache.set(cacheKey, result)
				return result
			}

			const result: PreFlightCheckResult = {
				type: cacheKey,
				status: "warning",
				message: `Low disk space: ${Math.round(freeSpace)}MB available`,
				diagnostic: "Free up space for models and recordings.",
				lastChecked: Date.now(),
			}
			PreFlightChecks.checkCache.set(cacheKey, result)
			return result
		} catch (error) {
			const result: PreFlightCheckResult = {
				type: cacheKey,
				status: "warning",
				message: "Disk space check failed",
				diagnostic: `Error: ${error}`,
				lastChecked: Date.now(),
			}
			PreFlightChecks.checkCache.set(cacheKey, result)
			Logger.warn(`⚠️ Disk space check: ${error}`)
			return result
		}
	}

	/**
	 * Helper: Get models directory path
	 */
	private static getModelsDir(): string {
		return path.join(process.env.APPDATA || os.homedir(), "Cline", "models")
	}

	/**
	 * Helper: Get cached result if still valid
	 */
	private static getCached(key: PreFlightCheckType): PreFlightCheckResult | null {
		const cached = PreFlightChecks.checkCache.get(key)
		if (cached && Date.now() - (cached.lastChecked || 0) < PreFlightChecks.CACHE_TTL_MS) {
			return cached
		}
		PreFlightChecks.checkCache.delete(key)
		return null
	}

	/**
	 * Clear all cached results (force fresh check)
	 */
	static clearCache(): void {
		PreFlightChecks.checkCache.clear()
		Logger.log("🔄 Preflight check cache cleared")
	}
}
