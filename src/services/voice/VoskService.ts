/**
 * VoskService — Streaming Speech Recognition (child-process architecture)
 *
 * vosk/ffi-napi/ref-napi use native .node binaries incompatible with Electron 39+.
 * Solution: spawn vosk-worker.js as a child process under system Node.js,
 * which has the correct ABI for the prebuilt binaries.
 *
 * Communication: newline-delimited JSON over stdin/stdout.
 * Audio: PCM 16-bit LE, 16 kHz, mono — base64-encoded per chunk.
 */

import type { ChildProcess } from "child_process"
import fs from "fs"
import https from "https"
import path from "path"
import { Logger } from "@/shared/services/Logger"

// ─── Constants ───────────────────────────────────────────────────────────────

const MODEL_DIR_NAME = "vosk-model-small-pt-0.3"
const MODEL_URL = "https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip"

// ─── VoskService ─────────────────────────────────────────────────────────────

export class VoskService {
	private worker: ChildProcess | null = null
	private stdoutBuf = ""
	private sentenceAccum: string[] = []
	private lastPartial = ""
	private chunkCount = 0
	private initResolve: ((ok: boolean) => void) | null = null
	private finalResolve: ((text: string) => void) | null = null
	private resetResolve: (() => void) | null = null
	private initStartTime = 0
	private firstChunkTime = 0
	private firstPartialTime = 0

	private readonly modelPath: string
	private _onPartial: (text: string) => void

	// ── Singleton (shared across sessions) ───────────────────────────────────
	private static _shared: VoskService | null = null
	private _isShared = false

	constructor(globalStoragePath: string, onPartial: (text: string) => void) {
		this.modelPath = VoskService.getModelPath(globalStoragePath)
		this._onPartial = onPartial
	}

	/**
	 * Pre-warm the model at extension startup. Subsequent calls to getShared()
	 * will return immediately without spawning a new worker.
	 */
	static async warmUp(globalStoragePath: string): Promise<void> {
		if (VoskService._shared) return
		if (!VoskService.isModelReady(globalStoragePath)) {
			Logger.log("[VoskService] warmUp: model not present — skipping")
			return
		}
		Logger.log("[VoskService] warmUp: loading model in background...")
		const instance = new VoskService(globalStoragePath, () => {})
		instance._isShared = true
		const ok = await instance.init()
		if (ok) {
			VoskService._shared = instance
			Logger.log("[VoskService] warmUp: singleton ready")
		} else {
			Logger.warn("[VoskService] warmUp: init failed — singleton not available")
		}
	}

	/**
	 * Get the shared singleton, updating its onPartial callback for this session.
	 * Falls back to creating a new instance if singleton not ready.
	 */
	static getShared(globalStoragePath: string, onPartial: (text: string) => void): VoskService {
		if (VoskService._shared) {
			VoskService._shared.setOnPartial(onPartial)
			return VoskService._shared
		}
		// Fallback: new instance (will init() on first use)
		return new VoskService(globalStoragePath, onPartial)
	}

	/** Replace the partial callback (e.g. between sessions). */
	setOnPartial(fn: (text: string) => void): void {
		this._onPartial = fn
	}

	// ── Static helpers ────────────────────────────────────────────────────────

	static getModelPath(globalStoragePath: string): string {
		return path.join(globalStoragePath, "voice", "vosk-models", MODEL_DIR_NAME)
	}

	static isModelReady(globalStoragePath: string): boolean {
		const p = VoskService.getModelPath(globalStoragePath)
		// small models put final.mdl at root; larger models put it under am/
		return fs.existsSync(path.join(p, "final.mdl")) || fs.existsSync(path.join(p, "am", "final.mdl"))
	}

	// ── Lifecycle ─────────────────────────────────────────────────────────────

	/**
	 * Spawn the vosk worker process and wait for it to load the model.
	 * Returns `true` on success, `false` if model not found or worker fails.
	 */
	async init(): Promise<boolean> {
		this.initStartTime = Date.now()
		Logger.log(`[VoskService] ⏱ init() called, modelPath: ${this.modelPath}`)

		const rootMdl = path.join(this.modelPath, "final.mdl")
		const amMdl = path.join(this.modelPath, "am", "final.mdl")
		const rootExists = fs.existsSync(rootMdl)
		const amExists = fs.existsSync(amMdl)
		Logger.log(`[VoskService] final.mdl at root=${rootExists}, at am/=${amExists}`)

		if (!rootExists && !amExists) {
			Logger.warn("[VoskService] Model not found at", this.modelPath, "— STT unavailable")
			return false
		}

		// vosk-worker.js is bundled by esbuild alongside extension.js into dist/
		const workerPath = path.join(__dirname, "vosk-worker.js")
		// node_modules lives one level above dist/
		const nodeModulesPath = path.join(__dirname, "..", "node_modules")

		Logger.log(`[VoskService] ⏱ Spawning worker at T+${Date.now() - this.initStartTime}ms: ${workerPath}`)
		Logger.log("[VoskService] NODE_PATH:", nodeModulesPath)

		if (!fs.existsSync(workerPath)) {
			Logger.error("[VoskService] vosk-worker.js not found at:", workerPath)
			return false
		}

		return new Promise<boolean>((resolve) => {
			this.initResolve = resolve
			this.sentenceAccum = []
			this.lastPartial = ""
			this.chunkCount = 0

			// Use system Node.js (from PATH) — avoids Electron 39 ABI mismatch with ref-napi
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const { spawn } = require("child_process") as typeof import("child_process")
			this.worker = spawn("node", [workerPath], {
				env: { ...process.env, NODE_PATH: nodeModulesPath },
				stdio: ["pipe", "pipe", "pipe"],
			})

			this.worker.stdout!.setEncoding("utf8")
			this.worker.stdout!.on("data", (chunk: string) => this.handleStdout(chunk))

			this.worker.stderr!.setEncoding("utf8")
			this.worker.stderr!.on("data", (chunk: string) => Logger.log("[VoskWorker stderr]", chunk.trimEnd()))

			this.worker.on("error", (err: Error) => {
				Logger.error("[VoskService] Worker process error:", err.message)
				if (this.initResolve) {
					this.initResolve(false)
					this.initResolve = null
				}
			})

			this.worker.on("exit", (code: number | null) => {
				Logger.log("[VoskService] Worker exited, code:", code)
				this.worker = null
				if (this.finalResolve) {
					this.finalResolve(this.sentenceAccum.join(" ").trim())
					this.finalResolve = null
				}
			})

			this.sendToWorker({ type: "init", modelPath: this.modelPath, sampleRate: 16000 })
		})
	}

	private handleStdout(chunk: string): void {
		this.stdoutBuf += chunk
		let nl: number
		while ((nl = this.stdoutBuf.indexOf("\n")) !== -1) {
			const line = this.stdoutBuf.slice(0, nl).trim()
			this.stdoutBuf = this.stdoutBuf.slice(nl + 1)
			if (!line) continue
			let msg: any
			try {
				msg = JSON.parse(line)
			} catch {
				continue
			}
			this.handleWorkerMsg(msg)
		}
	}

	private handleWorkerMsg(msg: any): void {
		if (msg.type === "ready") {
			const readyMs = Date.now() - this.initStartTime
			if (this.initResolve) {
				Logger.log(`[VoskService] ✅ Worker ready in ${readyMs}ms (model load time)`)
				this.initResolve(true)
				this.initResolve = null
			} else if (this.resetResolve) {
				Logger.log(`[VoskService] ✅ Recognizer reset in ${readyMs}ms`)
				this.resetResolve()
				this.resetResolve = null
			} else {
				// ready after finalize — no pending resolver, just note it
				Logger.log("[VoskService] Worker re-ready after finalize")
			}
		} else if (msg.type === "error") {
			Logger.error("[VoskService] Worker error:", msg.message)
			if (this.initResolve) {
				this.initResolve(false)
				this.initResolve = null
			}
		} else if (msg.type === "partial") {
			const combined = [...this.sentenceAccum, msg.partial].join(" ").trim()
			if (combined !== this.lastPartial) {
				if (this.firstPartialTime === 0) {
					this.firstPartialTime = Date.now()
					Logger.log(
						`[VoskService] ⏱ First partial at chunk #${this.chunkCount} (+${Date.now() - this.firstChunkTime}ms since first chunk)`,
					)
				}
				this.lastPartial = combined
				Logger.log(`[VoskService] 🗣️ partial[${this.chunkCount}] → "${combined}"`)
				this._onPartial(combined)
			}
		} else if (msg.type === "sentence") {
			if (msg.text) {
				this.sentenceAccum.push(msg.text)
				this.lastPartial = ""
				this._onPartial(this.sentenceAccum.join(" "))
				Logger.log(`[VoskService] ✅ sentence[${this.chunkCount}] → "${msg.text}"`)
			}
		} else if (msg.type === "final") {
			const total = [...this.sentenceAccum]
			if (msg.text) total.push(msg.text)
			const result = total.join(" ").trim()
			const latencyMs = this.firstChunkTime > 0 ? Date.now() - this.firstChunkTime : 0
			Logger.log(`[VoskService] 🏁 final → "${result}" (${this.chunkCount} chunks, finalize latency ${latencyMs}ms)`)
			if (this.finalResolve) {
				this.finalResolve(result)
				this.finalResolve = null
			}
		}
	}

	private sendToWorker(msg: object): void {
		if (!this.worker?.stdin) return
		try {
			this.worker.stdin.write(JSON.stringify(msg) + "\n")
		} catch (err) {
			Logger.warn("[VoskService] Failed to write to worker stdin:", err)
		}
	}

	/**
	 * Feed a PCM chunk (16-bit LE, 16 kHz, mono) to the recognizer.
	 * Fires the `onPartial` callback whenever new words are available.
	 */
	acceptChunk(pcm: Buffer): void {
		if (!this.worker) {
			Logger.warn("[VoskService] acceptChunk called but worker is not running — skipping")
			return
		}
		this.chunkCount++
		if (this.chunkCount === 1) {
			this.firstChunkTime = Date.now()
			this.firstPartialTime = 0
		}
		if (this.chunkCount % 5 === 0) {
			Logger.log(`[VoskService] ⏱ acceptChunk #${this.chunkCount} (${pcm.length}B)`)
		}
		this.sendToWorker({ type: "chunk", data: pcm.toString("base64") })
	}

	/**
	 * Flush any buffered audio and return the complete transcript.
	 * Call this after recording has stopped.
	 * When using the singleton, the worker stays alive and resets for the next session.
	 */
	async getFinalTranscript(): Promise<string> {
		if (!this.worker) {
			Logger.warn("[VoskService] getFinalTranscript: worker not running")
			return this.sentenceAccum.join(" ").trim()
		}
		const finalReqTime = Date.now()
		Logger.log(
			`[VoskService] ⏱ getFinalTranscript: requesting final (${this.chunkCount} chunks, ${this.sentenceAccum.length} sentences so far)`,
		)
		return new Promise<string>((resolve) => {
			this.finalResolve = (result: string) => {
				Logger.log(`[VoskService] ⏱ Finalize response in ${Date.now() - finalReqTime}ms`)
				resolve(result)
			}
			this.sendToWorker({ type: "finalize" })
			// Safety timeout — returns accumulated text if worker doesn't respond in time
			setTimeout(() => {
				if (this.finalResolve) {
					Logger.warn("[VoskService] getFinalTranscript timed out — returning accumulated")
					this.finalResolve(this.sentenceAccum.join(" ").trim())
					this.finalResolve = null
				}
			}, 5000)
		})
	}

	/**
	 * Reset the recognizer state for a new recording session (singleton use).
	 * Clears accumulators and creates a new Kaldi recognizer without reloading the model.
	 */
	async reset(): Promise<void> {
		this.sentenceAccum = []
		this.lastPartial = ""
		this.chunkCount = 0
		this.firstChunkTime = 0
		this.firstPartialTime = 0
		if (!this.worker) return
		return new Promise<void>((resolve) => {
			this.resetResolve = resolve
			this.initStartTime = Date.now()
			this.sendToWorker({ type: "reset" })
			setTimeout(() => {
				if (this.resetResolve) {
					Logger.warn("[VoskService] reset timed out — continuing anyway")
					this.resetResolve()
					this.resetResolve = null
				}
			}, 3000)
		})
	}

	/**
	 * Gracefully stop the worker process.
	 * When called on the singleton, only resets accumulators (keeps worker alive).
	 */
	free(): void {
		if (this._isShared) {
			// Singleton: just reset state, keep worker running for next session
			this.sentenceAccum = []
			this.lastPartial = ""
			this.chunkCount = 0
			this.firstChunkTime = 0
			this.firstPartialTime = 0
			return
		}
		if (this.worker) {
			this.sendToWorker({ type: "exit" })
			setTimeout(() => {
				if (this.worker) {
					this.worker.kill()
					this.worker = null
				}
			}, 500)
		}
	}

	// ── Model download ────────────────────────────────────────────────────────

	/**
	 * Download and extract the `vosk-model-small-pt-0.3` model to
	 * `globalStoragePath/voice/vosk-models/`.
	 * Idempotent — skips the download if model already present.
	 */
	static async downloadModel(globalStoragePath: string, onProgress?: (pct: number) => void): Promise<void> {
		if (VoskService.isModelReady(globalStoragePath)) {
			Logger.log("[VoskService] Model already present — skipping download")
			return
		}

		const modelsDir = path.join(globalStoragePath, "voice", "vosk-models")
		fs.mkdirSync(modelsDir, { recursive: true })

		const zipPath = path.join(modelsDir, `${MODEL_DIR_NAME}.zip`)
		Logger.log("[VoskService] Downloading Vosk model from:", MODEL_URL)
		await downloadFile(MODEL_URL, zipPath, onProgress)

		Logger.log("[VoskService] Extracting Vosk model...")
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const extractZip = require("extract-zip") as (src: string, opts: { dir: string }) => Promise<void>
		await extractZip(zipPath, { dir: modelsDir })

		try {
			fs.unlinkSync(zipPath)
		} catch {
			// ignore cleanup errors
		}

		Logger.log("[VoskService] Model ready at:", VoskService.getModelPath(globalStoragePath))
	}
}

// ─── HTTP download helper ─────────────────────────────────────────────────────

async function downloadFile(url: string, dest: string, onProgress?: (pct: number) => void): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const request = (target: string): void => {
			https
				.get(target, (res) => {
					// Follow redirects
					if (res.statusCode === 301 || res.statusCode === 302) {
						const location = res.headers.location
						res.resume()
						if (!location) {
							reject(new Error("Redirect with no location"))
							return
						}
						request(location)
						return
					}

					if (res.statusCode !== 200) {
						reject(new Error(`HTTP ${res.statusCode} for ${target}`))
						return
					}

					const total = Number.parseInt(res.headers["content-length"] ?? "0", 10)
					let downloaded = 0

					const file = fs.createWriteStream(dest)
					res.on("data", (chunk: Buffer) => {
						downloaded += chunk.length
						if (onProgress && total > 0) {
							onProgress(Math.round((downloaded / total) * 100))
						}
					})

					res.pipe(file)
					file.on("finish", () => {
						file.close()
						resolve()
					})
					file.on("error", (err) => {
						try {
							fs.unlinkSync(dest)
						} catch {
							// ignore
						}
						reject(err)
					})
				})
				.on("error", reject)
		}

		request(url)
	})
}
