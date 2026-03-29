import { spawn } from "child_process"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { fetch } from "@/shared/net"
import { Logger } from "@/shared/services/Logger"

// ---------------------------------------------------------------------------
// Release constants
// ---------------------------------------------------------------------------

const WHISPER_RELEASE_TAG = "v1.8.4"
const WHISPER_BASE_URL = `https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_RELEASE_TAG}`
const MODEL_BASE_URL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main"
const DEFAULT_MODEL = "ggml-small.bin"

/**
 * Platforms with official pre-built whisper-cli binaries.
 * Linux and macOS are absent — no pre-built binaries are available on the
 * official ggml-org/whisper.cpp releases. Those platforms fall back to
 * WhisperService (Xenova/ONNX) via VoiceResponseHandler.
 */
const PLATFORM_ASSETS: Record<string, { archive: string; binaryRelPath: string; isZip: boolean }> = {
	"win32-x64": {
		archive: "whisper-bin-x64.zip",
		binaryRelPath: path.join("Release", "whisper-cli.exe"),
		isZip: true,
	},
}

// ---------------------------------------------------------------------------
// Type alias for injectable spawn — allows Sinon stubbing in tests
// ---------------------------------------------------------------------------

type SpawnFn = typeof spawn

/**
 * WhisperCliService
 *
 * Speech-to-text via the pre-built whisper-cli binary (whisper.cpp).
 * Supported only on win32-x64 — check `isPlatformSupported()` before use.
 * Falls back gracefully: VoiceResponseHandler detects unsupported platforms
 * and delegates to WhisperService (Xenova/ONNX) instead.
 *
 * Binary and model are downloaded on first use to globalStoragePath and
 * cached — same pattern as PiperService.
 *
 * Usage:
 *   if (WhisperCliService.isPlatformSupported()) {
 *     const svc = WhisperCliService.getInstance(context.globalStoragePath)
 *     const { text, language } = await svc.transcribeWithLanguageDetection(float32, 16000, "pt")
 *   }
 */
export class WhisperCliService {
	private static _instance: WhisperCliService | undefined

	private readonly _binDir: string
	private readonly _modelsDir: string

	private constructor(
		private readonly _globalStoragePath: string,
		private readonly _spawnFn: SpawnFn = spawn,
	) {
		this._binDir = path.join(_globalStoragePath, "voice", "whisper-cli")
		this._modelsDir = path.join(_globalStoragePath, "voice", "whisper-models")
	}

	// ── Static API ────────────────────────────────────────────────────────────

	static getInstance(globalStoragePath: string, _testSpawn?: SpawnFn): WhisperCliService {
		if (!WhisperCliService._instance) {
			WhisperCliService._instance = new WhisperCliService(globalStoragePath, _testSpawn ?? spawn)
		}
		return WhisperCliService._instance
	}

	/** Reset the singleton — use only in tests. */
	static clearInstance(): void {
		WhisperCliService._instance = undefined
	}

	/** Returns true only on platforms that have a pre-built whisper-cli binary. */
	static isPlatformSupported(): boolean {
		return `${os.platform()}-${os.arch()}` in PLATFORM_ASSETS
	}

	// ── Public API ────────────────────────────────────────────────────────────

	/** Absolute path to the whisper-cli binary on disk (may not exist yet). */
	get binaryPath(): string {
		const platformKey = `${os.platform()}-${os.arch()}`
		const asset = PLATFORM_ASSETS[platformKey]
		if (!asset) throw new Error(`Unsupported platform: ${platformKey}`)
		return path.join(this._binDir, asset.binaryRelPath)
	}

	isBinaryInstalled(): boolean {
		try {
			return fs.existsSync(this.binaryPath)
		} catch {
			return false
		}
	}

	isModelDownloaded(): boolean {
		return fs.existsSync(path.join(this._modelsDir, DEFAULT_MODEL))
	}

	/**
	 * Transcribe Float32 PCM audio to text with language detection.
	 * Interface identical to WhisperService.transcribeWithLanguageDetection.
	 *
	 * @throws Error("WHISPER_CLI_UNSUPPORTED_PLATFORM") on non-Windows platforms
	 * @throws Error on download failure, subprocess error, or missing output
	 */
	async transcribeWithLanguageDetection(
		float32PCM: Float32Array,
		sampleRate: number,
		languageHint?: string,
	): Promise<{ text: string; language: string }> {
		if (!WhisperCliService.isPlatformSupported()) {
			throw new Error("WHISPER_CLI_UNSUPPORTED_PLATFORM")
		}

		await this._ensureBinary()
		await this._ensureModel()

		const pcm = this._float32ToPcm16(float32PCM)
		const wav = this._pcm16ToWav(pcm, sampleRate)

		const ts = Date.now()
		const wavPath = path.join(os.tmpdir(), `nexusai-whisper-${ts}.wav`)
		const outputPrefix = path.join(os.tmpdir(), `nexusai-whisper-${ts}`)
		const jsonPath = `${outputPrefix}.json`

		try {
			fs.writeFileSync(wavPath, wav)

			const args = [
				"-f",
				wavPath,
				"-m",
				path.join(this._modelsDir, DEFAULT_MODEL),
				"-l",
				languageHint ?? "auto",
				"-oj",
				"-of",
				outputPrefix,
			]

			Logger.log(
				`[WhisperCliService] Running transcription (${float32PCM.length / sampleRate}s audio, lang=${languageHint ?? "auto"})`,
			)
			await this._runBinary(args)

			if (!fs.existsSync(jsonPath)) {
				Logger.warn("[WhisperCliService] No JSON output produced — treating as silence")
				return { text: "", language: "unknown" }
			}

			const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"))
			const segments: Array<{ text: string }> = raw.transcription ?? []
			const text = segments
				.map((s) => s.text)
				.join("")
				.replace(/\[BLANK_AUDIO\]/gi, "")
				.trim()
			const language: string = raw.result?.language ?? "unknown"

			Logger.log(`[WhisperCliService] Transcribed: "${text}" [${language}]`)
			return { text, language }
		} finally {
			for (const f of [wavPath, jsonPath]) {
				try {
					fs.unlinkSync(f)
				} catch {
					// ignore — temp file already gone
				}
			}
		}
	}

	dispose(): void {
		WhisperCliService._instance = undefined
	}

	/**
	 * Pre-download binary and model if not already cached.
	 * Safe to call at startup — idempotent, skips if already present.
	 */
	async ensureBinaries(): Promise<void> {
		await this._ensureBinary()
		await this._ensureModel()
	}

	// ── Private helpers ───────────────────────────────────────────────────────

	private async _ensureBinary(): Promise<void> {
		if (this.isBinaryInstalled()) {
			Logger.log("[WhisperCliService] Binary ready (cached)")
			return
		}
		fs.mkdirSync(this._binDir, { recursive: true })
		await this._downloadBinary()
	}

	private async _ensureModel(): Promise<void> {
		if (this.isModelDownloaded()) {
			Logger.log("[WhisperCliService] Model ready (cached)")
			return
		}
		fs.mkdirSync(this._modelsDir, { recursive: true })
		await this._downloadModel()
	}

	private async _downloadBinary(): Promise<void> {
		const platformKey = `${os.platform()}-${os.arch()}`
		const asset = PLATFORM_ASSETS[platformKey]!

		const url = `${WHISPER_BASE_URL}/${asset.archive}`
		Logger.log(`[WhisperCliService] Downloading binary from ${url}…`)

		const response = await fetch(url)
		if (!response.ok) {
			throw new Error(`Failed to download whisper-cli binary: HTTP ${response.status}`)
		}

		const archivePath = path.join(this._binDir, asset.archive)
		fs.writeFileSync(archivePath, Buffer.from(await response.arrayBuffer()))

		if (asset.isZip) {
			await this._extractZip(archivePath, this._binDir)
		} else {
			await this._extractTarGz(archivePath, this._binDir)
		}
		fs.unlinkSync(archivePath)

		if (os.platform() !== "win32") {
			fs.chmodSync(this.binaryPath, 0o755)
		}
		Logger.log(`[WhisperCliService] Binary installed at ${this.binaryPath}`)
	}

	private async _downloadModel(): Promise<void> {
		const url = `${MODEL_BASE_URL}/${DEFAULT_MODEL}`
		Logger.log(`[WhisperCliService] Downloading model from ${url}… (~244 MB)`)

		const response = await fetch(url)
		if (!response.ok) {
			throw new Error(`Failed to download Whisper model: HTTP ${response.status}`)
		}

		const modelPath = path.join(this._modelsDir, DEFAULT_MODEL)
		fs.writeFileSync(modelPath, Buffer.from(await response.arrayBuffer()))
		Logger.log(`[WhisperCliService] Model installed at ${modelPath}`)
	}

	private _runBinary(args: string[]): Promise<void> {
		return new Promise((resolve, reject) => {
			const child = this._spawnFn(this.binaryPath, args, { stdio: ["ignore", "pipe", "pipe"] })

			child.stderr?.on("data", (data: Buffer) => {
				Logger.log(`[whisper-cli] ${data.toString().trimEnd()}`)
			})

			child.on("error", (err) => reject(new Error(`whisper-cli spawn error: ${err.message}`)))
			child.on("close", (code) => {
				if (code !== 0 && code !== null) {
					reject(new Error(`whisper-cli exited with code ${code}`))
				} else {
					resolve()
				}
			})
		})
	}

	/** Float32 normalized [-1, 1] → PCM 16-bit LE Buffer */
	private _float32ToPcm16(float32: Float32Array): Buffer {
		const buffer = Buffer.alloc(float32.length * 2)
		for (let i = 0; i < float32.length; i++) {
			const s = Math.max(-1, Math.min(1, float32[i]))
			buffer.writeInt16LE(Math.round(s * 32767), i * 2)
		}
		return buffer
	}

	/** Wrap raw 16-bit LE PCM in a minimal WAV container */
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
		header.writeUInt32LE(16, 16)
		header.writeUInt16LE(1, 20)
		header.writeUInt16LE(numChannels, 22)
		header.writeUInt32LE(sampleRate, 24)
		header.writeUInt32LE(byteRate, 28)
		header.writeUInt16LE(blockAlign, 32)
		header.writeUInt16LE(bitsPerSample, 34)
		header.write("data", 36)
		header.writeUInt32LE(dataSize, 40)

		return Buffer.concat([header, pcm])
	}

	private async _extractZip(archivePath: string, destDir: string): Promise<void> {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { promisify } = require("util")
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { exec } = require("child_process")
		const execAsync = promisify(exec)
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
}
