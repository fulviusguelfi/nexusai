import { spawn } from "child_process"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { fetch } from "@/shared/net"
import { Logger } from "@/shared/services/Logger"

/** Platform → asset filename on rhasspy/piper releases */
const PIPER_RELEASE_TAG = "2023.11.14-2"
const PIPER_BASE_URL = `https://github.com/rhasspy/piper/releases/download/${PIPER_RELEASE_TAG}`

const PLATFORM_ASSETS: Record<string, { archive: string; binary: string; isZip: boolean }> = {
	"win32-x64": { archive: "piper_windows_amd64.zip", binary: "piper.exe", isZip: true },
	"linux-x64": { archive: "piper_linux_x86_64.tar.gz", binary: "piper", isZip: false },
	"linux-arm64": { archive: "piper_linux_aarch64.tar.gz", binary: "piper", isZip: false },
	"darwin-x64": { archive: "piper_macos_x64.tar.gz", binary: "piper", isZip: false },
	"darwin-arm64": { archive: "piper_macos_aarch64.tar.gz", binary: "piper", isZip: false },
}

const DEFAULT_VOICE_ID = "en_US-lessac-medium"
const VOICE_MODEL_URL_ROOT = "https://huggingface.co/rhasspy/piper-voices/resolve/main"

const SUPPORTED_VOICE_IDS = new Set(["en_US-lessac-medium", "en_US-ryan-medium", "pt_BR-faber-medium", "pt_BR-cadu-medium"])

/**
 * PiperService
 *
 * Manages offline TTS using the pre-built Piper binary from rhasspy/piper.
 * Voice model (ONNX, ~55MB) and the binary are cached in globalStoragePath.
 *
 * Usage:
 *   const piper = PiperService.getInstance(context.globalStoragePath)
 *   await piper.ensureBinary()
 *   const wavBuffer = await piper.synthesize("Hello, world!")
 */
export class PiperService {
	private static _instance: PiperService | undefined

	private readonly _binDir: string
	private readonly _voicesDir: string

	private constructor(globalStoragePath: string) {
		this._binDir = path.join(globalStoragePath, "voice", "piper")
		this._voicesDir = path.join(globalStoragePath, "voice", "piper-voices")
	}

	static getInstance(globalStoragePath: string): PiperService {
		if (!PiperService._instance) {
			PiperService._instance = new PiperService(globalStoragePath)
		}
		return PiperService._instance
	}

	get binaryPath(): string {
		const platform = this._getPlatformKey()
		const asset = PLATFORM_ASSETS[platform]
		if (!asset) throw new Error(`Unsupported platform: ${platform}`)
		return path.join(this._binDir, asset.binary)
	}

	isBinaryInstalled(): boolean {
		try {
			return fs.existsSync(this.binaryPath)
		} catch {
			return false
		}
	}

	/**
	 * Download and extract the Piper binary and voice model if not already present.
	 * Idempotent — safe to call multiple times.
	 */
	async ensureBinary(voiceId = DEFAULT_VOICE_ID): Promise<void> {
		fs.mkdirSync(this._binDir, { recursive: true })
		fs.mkdirSync(this._voicesDir, { recursive: true })

		// 1. Download binary archive if needed
		if (!this.isBinaryInstalled()) {
			await this._downloadBinary()
		}

		// 2. Download voice ONNX + config if needed
		await this._ensureVoiceModel(voiceId)
	}

	/**
	 * Synthesize text to WAV audio using the Piper binary.
	 * Returns a Buffer containing WAV-format audio data.
	 */
	async synthesize(text: string, voiceId = DEFAULT_VOICE_ID): Promise<Buffer> {
		const requestedVoiceId = this._resolveVoiceId(voiceId)
		let effectiveVoiceId = requestedVoiceId

		try {
			await this.ensureBinary(effectiveVoiceId)
		} catch (error) {
			Logger.warn(`[PiperService] Failed to prepare voice "${effectiveVoiceId}", falling back to default:`, error)
			effectiveVoiceId = DEFAULT_VOICE_ID
			await this.ensureBinary(effectiveVoiceId)
		}

		return new Promise<Buffer>((resolve, reject) => {
			const modelFile = path.join(this._voicesDir, `${effectiveVoiceId}.onnx`)
			const configFile = path.join(this._voicesDir, `${effectiveVoiceId}.onnx.json`)

			if (!fs.existsSync(modelFile) || !fs.existsSync(configFile)) {
				reject(new Error(`Voice model not found after preparation: ${effectiveVoiceId}`))
				return
			}

			const args = ["--model", modelFile, "--config", configFile, "--output-raw"]
			const child = spawn(this.binaryPath, args, { stdio: ["pipe", "pipe", "pipe"] })

			const chunks: Buffer[] = []

			child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk))
			child.stderr.on("data", (data: Buffer) => {
				Logger.log(`[PiperService] stderr: ${data.toString().trim()}`)
			})

			child.on("error", (err) => reject(new Error(`Piper spawn error: ${err.message}`)))

			child.on("close", (code) => {
				if (code !== 0 && code !== null) {
					reject(new Error(`Piper exited with code ${code}`))
					return
				}
				const rawPcm = Buffer.concat(chunks)
				resolve(this._pcm16ToWav(rawPcm, 22050))
			})

			// Write text to stdin and close it
			child.stdin.write(text, "utf8")
			child.stdin.end()
		})
	}

	dispose(): void {
		PiperService._instance = undefined
	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	private _getPlatformKey(): string {
		return `${os.platform()}-${os.arch()}`
	}

	private async _downloadBinary(): Promise<void> {
		const platformKey = this._getPlatformKey()
		const asset = PLATFORM_ASSETS[platformKey]
		if (!asset) {
			throw new Error(
				`Piper TTS is not available for your platform (${platformKey}). ` +
					`Supported: ${Object.keys(PLATFORM_ASSETS).join(", ")}`,
			)
		}

		const url = `${PIPER_BASE_URL}/${asset.archive}`
		Logger.log(`[PiperService] Downloading Piper binary from ${url}…`)

		const response = await fetch(url)
		if (!response.ok) {
			throw new Error(`Failed to download Piper: HTTP ${response.status}`)
		}

		const arrayBuf = await response.arrayBuffer()
		const archivePath = path.join(this._binDir, asset.archive)
		fs.writeFileSync(archivePath, Buffer.from(arrayBuf))

		if (asset.isZip) {
			await this._extractZip(archivePath, this._binDir)
		} else {
			await this._extractTarGz(archivePath, this._binDir)
		}

		fs.unlinkSync(archivePath)

		// Make binary executable on Unix
		if (os.platform() !== "win32") {
			fs.chmodSync(this.binaryPath, 0o755)
		}

		Logger.log(`[PiperService] Binary installed at ${this.binaryPath}`)
	}

	private async _ensureVoiceModel(voiceId: string): Promise<void> {
		const resolvedVoiceId = this._resolveVoiceId(voiceId)
		const modelFile = path.join(this._voicesDir, `${resolvedVoiceId}.onnx`)
		const configFile = path.join(this._voicesDir, `${resolvedVoiceId}.onnx.json`)

		if (fs.existsSync(modelFile) && fs.existsSync(configFile)) {
			return
		}

		const voicePath = this._getVoicePath(resolvedVoiceId)
		Logger.log(`[PiperService] Downloading voice model ${resolvedVoiceId}…`)

		for (const [suffix, filePath] of [
			[".onnx", modelFile],
			[".onnx.json", configFile],
		] as const) {
			const url = `${VOICE_MODEL_URL_ROOT}/${voicePath}/${resolvedVoiceId}${suffix}`
			const response = await fetch(url)
			if (!response.ok) {
				throw new Error(`Failed to download voice model ${suffix}: HTTP ${response.status}`)
			}
			const buf = await response.arrayBuffer()
			fs.writeFileSync(filePath, Buffer.from(buf))
		}

		Logger.log(`[PiperService] Voice model ${resolvedVoiceId} installed.`)
	}

	private _resolveVoiceId(voiceId: string | undefined): string {
		if (!voiceId) {
			return DEFAULT_VOICE_ID
		}

		if (!SUPPORTED_VOICE_IDS.has(voiceId)) {
			Logger.warn(`[PiperService] Unsupported voice "${voiceId}". Falling back to ${DEFAULT_VOICE_ID}.`)
			return DEFAULT_VOICE_ID
		}

		return voiceId
	}

	private _getVoicePath(voiceId: string): string {
		const parts = voiceId.split("-")
		if (parts.length < 3) {
			throw new Error(`Invalid voice id format: ${voiceId}`)
		}

		const languageCode = parts[0]
		const speaker = parts[1]
		const quality = parts.slice(2).join("-")
		const languageFamily = languageCode.split("_")[0]

		return `${languageFamily}/${languageCode}/${speaker}/${quality}`
	}

	private async _extractZip(archivePath: string, destDir: string): Promise<void> {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { promisify } = require("util")
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { exec } = require("child_process")
		const execAsync = promisify(exec)
		// Use PowerShell on Windows (available in VS Code context)
		await execAsync(
			`powershell -NoProfile -Command "Expand-Archive -LiteralPath '${archivePath}' -DestinationPath '${destDir}' -Force"`,
		)
	}

	private async _extractTarGz(archivePath: string, destDir: string): Promise<void> {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { promisify } = require("util")
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { exec } = require("child_process")
		const execAsync = promisify(exec)
		await execAsync(`tar -xzf "${archivePath}" -C "${destDir}"`)
	}

	/**
	 * Wrap raw 16-bit LE PCM in a minimal WAV container.
	 * Piper outputs 16-bit mono PCM; sample rate depends on the voice model.
	 */
	private _pcm16ToWav(pcm: Buffer, sampleRate: number): Buffer {
		const numChannels = 1
		const bitsPerSample = 16
		const byteRate = (sampleRate * numChannels * bitsPerSample) / 8
		const blockAlign = (numChannels * bitsPerSample) / 8
		const dataSize = pcm.length
		const header = Buffer.alloc(44)

		header.write("RIFF", 0)
		header.writeUInt32LE(36 + dataSize, 4)
		header.write("WAVE", 8)
		header.write("fmt ", 12)
		header.writeUInt32LE(16, 16) // PCM chunk size
		header.writeUInt16LE(1, 20) // PCM format
		header.writeUInt16LE(numChannels, 22)
		header.writeUInt32LE(sampleRate, 24)
		header.writeUInt32LE(byteRate, 28)
		header.writeUInt16LE(blockAlign, 32)
		header.writeUInt16LE(bitsPerSample, 34)
		header.write("data", 36)
		header.writeUInt32LE(dataSize, 40)

		return Buffer.concat([header, pcm])
	}
}
