/**
 * FasterWhisperService — Streaming Speech Recognition via faster-whisper (Python)
 *
 * Drop-in replacement for VoskService. Same public API, same JSON protocol.
 * Advantages over Vosk:
 *   - Multilingual (auto-detects PT-BR, EN, ES, etc.)
 *   - Higher quality (Whisper base/small models)
 *   - No native .node binaries — pure Python, no ABI issues
 *
 * Architecture: spawns whisper-worker.py under system Python (not Electron).
 * Communication: newline-delimited JSON over stdin/stdout.
 * Audio: PCM 16-bit LE, 16 kHz, mono — base64-encoded per chunk.
 */

import type { ChildProcess } from "child_process"
import path from "path"
import { Logger } from "@/shared/services/Logger"

// ─── FasterWhisperService ─────────────────────────────────────────────────────

export class FasterWhisperService {
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

	private _onPartial: (text: string) => void

	// ── Singleton (shared across sessions) ───────────────────────────────────
	private static _shared: FasterWhisperService | null = null
	private _isShared = false

	constructor(_globalStoragePath: string, onPartial: (text: string) => void) {
		this._onPartial = onPartial
	}

	/**
	 * Pre-warm the worker at extension startup so the first session starts instantly.
	 * faster-whisper downloads its model automatically on first use (~244MB for small).
	 */
	static async warmUp(globalStoragePath: string): Promise<void> {
		if (FasterWhisperService._shared) return
		Logger.log("[FasterWhisperService] warmUp: loading model in background...")
		const instance = new FasterWhisperService(globalStoragePath, () => {})
		instance._isShared = true
		const ok = await instance.init()
		if (ok) {
			FasterWhisperService._shared = instance
			Logger.log("[FasterWhisperService] warmUp: singleton ready")
		} else {
			Logger.warn("[FasterWhisperService] warmUp: init failed — singleton not available")
		}
	}

	/**
	 * Get the shared singleton, updating its onPartial callback for this session.
	 * Falls back to creating a new instance if singleton not ready.
	 */
	static getShared(globalStoragePath: string, onPartial: (text: string) => void): FasterWhisperService {
		if (FasterWhisperService._shared) {
			FasterWhisperService._shared.setOnPartial(onPartial)
			return FasterWhisperService._shared
		}
		return new FasterWhisperService(globalStoragePath, onPartial)
	}

	/** Replace the partial callback (e.g. between sessions). */
	setOnPartial(fn: (text: string) => void): void {
		this._onPartial = fn
	}

	// ── Compatibility shims (kept for call-site compatibility with VoskService) ──

	/** Always true — faster-whisper downloads its model automatically on first use. */
	static isModelReady(_globalStoragePath: string): boolean {
		return true
	}

	/** No-op — faster-whisper downloads the Whisper model automatically. */
	static async downloadModel(_globalStoragePath: string, _onProgress?: (pct: number) => void): Promise<void> {
		Logger.log("[FasterWhisperService] downloadModel: no-op — model auto-downloaded by Python worker")
	}

	// ── Lifecycle ─────────────────────────────────────────────────────────────

	/**
	 * Spawn the whisper Python worker and wait for it to load the model.
	 * Returns `true` on success.
	 */
	async init(): Promise<boolean> {
		this.initStartTime = Date.now()
		Logger.log("[FasterWhisperService] ⏱ init() called")

		// whisper-worker.py is copied to dist/ alongside extension.js by esbuild
		const workerPath = path.join(__dirname, "whisper-worker.py")

		Logger.log(`[FasterWhisperService] ⏱ Spawning worker at T+${Date.now() - this.initStartTime}ms: ${workerPath}`)

		return new Promise<boolean>((resolve) => {
			this.initResolve = resolve
			this.sentenceAccum = []
			this.lastPartial = ""
			this.chunkCount = 0

			// Use system Python — not Electron's bundled Node.js
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const { spawn } = require("child_process") as typeof import("child_process")
			this.worker = spawn("python", [workerPath], {
				stdio: ["pipe", "pipe", "pipe"],
			})

			this.worker.stdout!.setEncoding("utf8")
			this.worker.stdout!.on("data", (chunk: string) => this.handleStdout(chunk))

			this.worker.stderr!.setEncoding("utf8")
			this.worker.stderr!.on("data", (chunk: string) => {
				// Filter noisy HuggingFace download progress from stderr
				const text = chunk.trimEnd()
				if (!text.includes("UserWarning") && !text.includes("HF_HUB_DISABLE")) {
					Logger.log("[WhisperWorker stderr]", text)
				}
			})

			this.worker.on("error", (err: Error) => {
				Logger.error("[FasterWhisperService] Worker process error:", err.message)
				if (this.initResolve) {
					this.initResolve(false)
					this.initResolve = null
				}
			})

			this.worker.on("exit", (code: number | null) => {
				Logger.log("[FasterWhisperService] Worker exited, code:", code)
				this.worker = null
				if (this.finalResolve) {
					this.finalResolve(this.sentenceAccum.join(" ").trim())
					this.finalResolve = null
				}
			})

			this.sendToWorker({ type: "init", sampleRate: 16000 })
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
				Logger.log(`[FasterWhisperService] ✅ Worker ready in ${readyMs}ms (model load time)`)
				this.initResolve(true)
				this.initResolve = null
			} else if (this.resetResolve) {
				Logger.log(`[FasterWhisperService] ✅ Recognizer reset in ${readyMs}ms`)
				this.resetResolve()
				this.resetResolve = null
			} else {
				Logger.log("[FasterWhisperService] Worker re-ready after finalize")
			}
		} else if (msg.type === "error") {
			Logger.error("[FasterWhisperService] Worker error:", msg.message)
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
						`[FasterWhisperService] ⏱ First partial at chunk #${this.chunkCount} (+${Date.now() - this.firstChunkTime}ms since first chunk)`,
					)
				}
				this.lastPartial = combined
				Logger.log(`[FasterWhisperService] 🗣️ partial[${this.chunkCount}] → "${combined}"`)
				this._onPartial(combined)
			}
		} else if (msg.type === "sentence") {
			if (msg.text) {
				this.sentenceAccum.push(msg.text)
				this.lastPartial = ""
				this._onPartial(this.sentenceAccum.join(" "))
				Logger.log(`[FasterWhisperService] ✅ sentence[${this.chunkCount}] → "${msg.text}"`)
			}
		} else if (msg.type === "final") {
			const total = [...this.sentenceAccum]
			if (msg.text) total.push(msg.text)
			const result = total.join(" ").trim()
			const latencyMs = this.firstChunkTime > 0 ? Date.now() - this.firstChunkTime : 0
			Logger.log(
				`[FasterWhisperService] 🏁 final → "${result}" (${this.chunkCount} chunks, finalize latency ${latencyMs}ms)`,
			)
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
			Logger.warn("[FasterWhisperService] Failed to write to worker stdin:", err)
		}
	}

	/**
	 * Feed a PCM chunk (16-bit LE, 16 kHz, mono) to the recognizer.
	 * Fires the `onPartial` callback as rolling transcription emits results.
	 */
	acceptChunk(pcm: Buffer): void {
		if (!this.worker) {
			Logger.warn("[FasterWhisperService] acceptChunk called but worker is not running — skipping")
			return
		}
		this.chunkCount++
		if (this.chunkCount === 1) {
			this.firstChunkTime = Date.now()
			this.firstPartialTime = 0
		}
		if (this.chunkCount % 5 === 0) {
			Logger.log(`[FasterWhisperService] ⏱ acceptChunk #${this.chunkCount} (${pcm.length}B)`)
		}
		this.sendToWorker({ type: "chunk", data: pcm.toString("base64") })
	}

	/**
	 * Flush buffered audio and return the complete transcript.
	 * Call after recording stops. Singleton stays alive for next session.
	 */
	async getFinalTranscript(): Promise<string> {
		if (!this.worker) {
			Logger.warn("[FasterWhisperService] getFinalTranscript: worker not running")
			return this.sentenceAccum.join(" ").trim()
		}
		const finalReqTime = Date.now()
		Logger.log(
			`[FasterWhisperService] ⏱ getFinalTranscript: requesting final (${this.chunkCount} chunks, ${this.sentenceAccum.length} sentences so far)`,
		)
		return new Promise<string>((resolve) => {
			this.finalResolve = (result: string) => {
				Logger.log(`[FasterWhisperService] ⏱ Finalize response in ${Date.now() - finalReqTime}ms`)
				resolve(result)
			}
			this.sendToWorker({ type: "finalize" })
			// Safety timeout
			setTimeout(() => {
				if (this.finalResolve) {
					Logger.warn("[FasterWhisperService] getFinalTranscript timed out — returning accumulated")
					this.finalResolve(this.sentenceAccum.join(" ").trim())
					this.finalResolve = null
				}
			}, 30000) // Whisper can be slower than Vosk — allow 30s
		})
	}

	/**
	 * Reset the recognizer state for a new recording session.
	 * Clears accumulators; Python worker clears its audio buffer.
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
					Logger.warn("[FasterWhisperService] reset timed out — continuing anyway")
					this.resetResolve()
					this.resetResolve = null
				}
			}, 3000)
		})
	}

	/**
	 * Stop the worker. On singleton: resets state only (keeps Python process alive).
	 * On instance: kills the process.
	 */
	free(): void {
		if (this._isShared) {
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
}
