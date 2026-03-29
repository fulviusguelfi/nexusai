import * as path from "path"
import { Worker } from "worker_threads"
import { Logger } from "@/shared/services/Logger"

const TRANSCRIPTION_TIMEOUT_MS = 60_000

/**
 * WhisperService
 *
 * Manages a single persistent worker thread running @huggingface/transformers
 * ONNX inference for local offline speech-to-text via Whisper-tiny (~75MB).
 *
 * Usage:
 *   const whisper = WhisperService.getInstance(context.globalStoragePath)
 *   const text = await whisper.transcribe(float32Array, 16000)
 */
export class WhisperService {
	private static _instance: WhisperService | undefined

	private _worker: Worker | null = null
	private _workerReady = false
	private readonly _cacheDir: string

	private constructor(
		globalStoragePath: string,
		private readonly _WorkerClass: typeof Worker = Worker,
	) {
		this._cacheDir = path.join(globalStoragePath, "voice", "models")
	}

	static getInstance(globalStoragePath: string): WhisperService {
		if (!WhisperService._instance) {
			WhisperService._instance = new WhisperService(globalStoragePath)
		}
		return WhisperService._instance
	}

	/** Check if the Whisper model has been downloaded to the cache. */
	isModelDownloaded(): boolean {
		try {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const fs = require("fs")
			return fs.existsSync(this._cacheDir) && fs.readdirSync(this._cacheDir).length > 0
		} catch {
			return false
		}
	}

	/** Transcribe Float32 PCM audio (16kHz mono) to text with automatic language detection. */
	async transcribeWithLanguageDetection(
		float32PCM: Float32Array,
		sampleRate: number,
		languageHint?: string, // Optional: hint to Whisper about the expected language (e.g., "pt" for Portuguese)
	): Promise<{ text: string; language: string }> {
		const worker = await this._getWorker()

		return new Promise<{ text: string; language: string }>((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error("Whisper transcription timed out after 60s"))
			}, TRANSCRIPTION_TIMEOUT_MS)

			const onMessage = (msg: any) => {
				if (msg.type === "debug") {
					// Log all debug messages from worker for language detection troubleshooting
					Logger.log(`[WhisperWorker] ${msg.message || "Debug info"}`)
					if (msg.resultStructure) {
						Logger.log(
							`  Result structure: type=${msg.resultStructure.resultType}, keys=[${msg.resultStructure.resultKeys}]`,
						)
						if (msg.resultStructure.firstElementKeys) {
							Logger.log(`  First element keys: [${msg.resultStructure.firstElementKeys}]`)
						}
						Logger.log(
							`  Has language field: ${msg.resultStructure.hasLanguageField}, First element has language: ${msg.resultStructure.firstElementHasLanguage}`,
						)
					}
					// Don't resolve/reject for debug messages, just log them
					return
				}
				if (msg.type === "result") {
					clearTimeout(timeout)
					worker.off("message", onMessage)
					worker.off("error", onError)
					resolve({
						text: msg.text,
						language: msg.language ?? "unknown",
					})
				} else if (msg.type === "error") {
					clearTimeout(timeout)
					worker.off("message", onMessage)
					worker.off("error", onError)
					reject(new Error(msg.message))
				}
			}

			const onError = (err: Error) => {
				clearTimeout(timeout)
				worker.off("message", onMessage)
				worker.off("error", onError)
				this._worker = null
				this._workerReady = false
				reject(err)
			}

			worker.on("message", onMessage)
			worker.on("error", onError)

			// Transfer the buffer for zero-copy
			const buffer = float32PCM.buffer.slice(0) as ArrayBuffer
			const message: any = { type: "transcribe", float32PCM: buffer, sampleRate }

			// Add language hint if provided
			if (languageHint) {
				message.language = languageHint
			}

			worker.postMessage(message, [buffer])
		})
	}

	/** Transcribe Float32 PCM audio (16kHz mono) to text. */
	async transcribe(float32PCM: Float32Array, sampleRate: number): Promise<string> {
		const result = await this.transcribeWithLanguageDetection(float32PCM, sampleRate)
		return result.text
	}

	/** Terminate the worker and clean up the singleton. */
	dispose(): void {
		this._worker?.terminate()
		this._worker = null
		this._workerReady = false
		WhisperService._instance = undefined
	}

	private async _getWorker(): Promise<Worker> {
		if (this._worker && this._workerReady) {
			return this._worker
		}

		// Terminate stale worker if any
		if (this._worker) {
			await this._worker.terminate().catch(() => {})
			this._worker = null
			this._workerReady = false
		}

		// The worker file is bundled to dist/whisper.worker.js by esbuild
		// Try multiple paths for different execution contexts (compiled vs tsx)
		let workerPath = path.join(__dirname, "whisper.worker.js")

		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const fs = require("fs")
		if (!fs.existsSync(workerPath)) {
			// Try dist/ relative to project root (for tsx execution)
			const altPath = path.join(process.cwd(), "dist", "whisper.worker.js")
			if (fs.existsSync(altPath)) {
				workerPath = altPath
			} else {
				throw new Error(`Whisper worker not found at ${workerPath} or ${altPath}`)
			}
		}

		return new Promise<Worker>((resolve, reject) => {
			const worker = new this._WorkerClass(workerPath)
			this._worker = worker

			const readyTimeout = setTimeout(() => {
				worker.terminate().catch(() => {})
				this._worker = null
				reject(new Error("Whisper worker failed to become ready within 30s"))
			}, 30_000)

			worker.once("message", (msg: any) => {
				if (msg.type === "ready") {
					clearTimeout(readyTimeout)
					this._workerReady = true
					resolve(worker)
				} else if (msg.type === "error") {
					clearTimeout(readyTimeout)
					this._worker = null
					reject(new Error(msg.message))
				}
			})

			worker.once("error", (err) => {
				clearTimeout(readyTimeout)
				this._worker = null
				reject(err)
			})

			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const fs = require("fs")
			fs.mkdirSync(this._cacheDir, { recursive: true })
			worker.postMessage({ type: "init", cacheDir: this._cacheDir })
			Logger.log("[WhisperService] Worker started, waiting for model load…")
		})
	}
}
