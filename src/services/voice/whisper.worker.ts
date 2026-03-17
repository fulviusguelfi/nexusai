/**
 * Whisper Worker Thread
 *
 * Runs @huggingface/transformers ONNX inference in a separate thread
 * to avoid blocking the VS Code extension host during transcription.
 *
 * Messages received from parent:
 *   { type: 'init', cacheDir: string }
 *   { type: 'transcribe', float32PCM: SharedArrayBuffer, sampleRate: number }
 *
 * Messages sent to parent:
 *   { type: 'ready' }
 *   { type: 'result', text: string }
 *   { type: 'error', message: string }
 */

import { parentPort } from "worker_threads"

if (!parentPort) {
	throw new Error("whisper.worker must be started as a worker thread")
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const transformers = require("@huggingface/transformers")
const { pipeline, env } = transformers

let transcriber: any = null
let modelCacheDir: string | null = null

parentPort.on("message", async (msg: any) => {
	if (!parentPort) return

	if (msg.type === "init") {
		modelCacheDir = msg.cacheDir
		env.cacheDir = modelCacheDir
		// Pre-warm the model on init for faster first transcription
		try {
			transcriber = await pipeline("automatic-speech-recognition", "Xenova/whisper-tiny", {
				dtype: "fp32",
				device: "cpu",
			})
			parentPort.postMessage({ type: "ready" })
		} catch (err: any) {
			parentPort.postMessage({ type: "error", message: `Model load failed: ${err?.message ?? err}` })
		}
		return
	}

	if (msg.type === "transcribe") {
		try {
			if (!transcriber) {
				// Lazy init if 'init' was skipped
				if (!modelCacheDir) {
					parentPort.postMessage({ type: "error", message: "Worker not initialised (no cacheDir)" })
					return
				}
				env.cacheDir = modelCacheDir
				transcriber = await pipeline("automatic-speech-recognition", "Xenova/whisper-tiny", {
					dtype: "fp32",
					device: "cpu",
				})
			}

			// Reconstruct Float32Array from transferred ArrayBuffer
			const float32 = new Float32Array(msg.float32PCM)

			const result = await transcriber(float32, {
				sampling_rate: msg.sampleRate ?? 16000,
				language: msg.language ?? "english",
				task: "transcribe",
			})

			const text: string = Array.isArray(result) ? (result[0]?.text ?? "") : (result?.text ?? "")
			parentPort.postMessage({ type: "result", text: text.trim() })
		} catch (err: any) {
			parentPort.postMessage({ type: "error", message: `Transcription failed: ${err?.message ?? err}` })
		}
		return
	}
})
