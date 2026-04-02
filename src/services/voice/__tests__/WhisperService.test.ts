/**
 * WhisperService unit tests — issue #81
 *
 * Uses a mock Worker to avoid touching the real whisper.worker.js binary.
 *
 * Design: _getWorker() creates `new this._WorkerClass(path)` then waits for a
 * "message" event with { type: "ready" }.  It never calls postMessage itself.
 * So the FakeWorker must emit "ready" when it is constructed, not on postMessage.
 */
import { EventEmitter } from "events"
import { afterEach, beforeEach, describe, it } from "mocha"
import "should"
import sinon from "sinon"
import { WhisperService } from "../WhisperService"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type FakeWorker = {
	postMessage: sinon.SinonStub
	on: (evt: string, fn: (...args: unknown[]) => void) => FakeWorker
	once: (evt: string, fn: (...args: unknown[]) => void) => FakeWorker
	off: (evt: string, fn: (...args: unknown[]) => void) => FakeWorker
	terminate: sinon.SinonStub
	_emit: (evt: string, payload?: unknown) => void
}

/** Creates a fake Worker emitter. readyOn controls what the worker emits after construction. */
function makeFakeWorker(readyOn: "ready" | "error" | "workerError" = "ready"): FakeWorker {
	const emitter = new EventEmitter()

	const worker: FakeWorker = {
		postMessage: sinon.stub(),
		on: (evt, fn) => {
			emitter.on(evt, fn)
			return worker
		},
		once: (evt, fn) => {
			emitter.once(evt, fn)
			return worker
		},
		off: (evt, fn) => {
			emitter.off(evt, fn)
			return worker
		},
		terminate: sinon.stub().resolves(),
		_emit: (evt, payload) => emitter.emit(evt, payload),
	}

	return worker
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WhisperService", () => {
	let workerInstance: FakeWorker

	beforeEach(() => {
		WhisperService["_instance"] = undefined
	})

	afterEach(() => {
		sinon.restore()
		WhisperService["_instance"] = undefined
	})

	// ── Singleton ─────────────────────────────────────────────────────────────

	describe("getInstance()", () => {
		it("returns the same instance on repeated calls", () => {
			const a = WhisperService.getInstance("/tmp/test-1")
			const b = WhisperService.getInstance("/tmp/test-1")
			a.should.equal(b)
		})
	})

	// ── isModelDownloaded ──────────────────────────────────────────────────────

	describe("isModelDownloaded()", () => {
		it("returns false when cache directory does not exist", () => {
			const svc = WhisperService.getInstance(`/tmp/nexusai-test-${Date.now()}`)
			svc.isModelDownloaded().should.be.false()
		})
	})

	// ── dispose ────────────────────────────────────────────────────────────────

	describe("dispose()", () => {
		it("clears the singleton and sets worker to null", () => {
			const svc = WhisperService.getInstance("/tmp/test-dispose")
			svc.dispose()
			const svc2 = WhisperService.getInstance("/tmp/test-dispose")
			svc2.should.not.equal(svc)
		})
	})

	// ── Transcription ──────────────────────────────────────────────────────────

	describe("transcribeWithLanguageDetection()", () => {
		/**
		 * Build a WhisperService with an injected FakeWorker.
		 *
		 * The FakeWorker constructor stub emits "ready" via setImmediate so that
		 * _getWorker()'s `worker.once("message", ...)` resolves automatically.
		 * Individual tests then configure `workerInstance.postMessage` to emit
		 * transcription results.
		 */
		function buildService(readyOn: "ready" | "error" | "workerError" = "ready") {
			workerInstance = makeFakeWorker(readyOn)

			const FakeWorkerCtor = sinon.stub().callsFake(() => {
				// Emit the startup event in a future tick so the "once" listener is set first
				if (readyOn === "ready") {
					setImmediate(() => workerInstance._emit("message", { type: "ready" }))
				} else if (readyOn === "error") {
					setImmediate(() => workerInstance._emit("message", { type: "error", message: "load failed" }))
				} else {
					setImmediate(() => workerInstance._emit("error", new Error("worker crashed")))
				}
				return workerInstance
			}) as unknown as typeof import("worker_threads").Worker

			const fsModule = require("fs") as typeof import("fs")
			sinon.stub(fsModule, "existsSync").returns(true)
			sinon.stub(fsModule, "mkdirSync").returns(undefined as any)

			WhisperService["_instance"] = undefined
			const svc = ((WhisperService as any)["_instance"] = new (WhisperService as any)("/tmp/test-svc", FakeWorkerCtor))
			return svc as WhisperService
		}

		it("resolves with text and language on successful transcription", async () => {
			const svc = buildService()

			workerInstance.postMessage = sinon.stub().callsFake((_msg: any) => {
				setImmediate(() =>
					workerInstance._emit("message", {
						type: "result",
						text: "olá mundo",
						language: "pt",
					}),
				)
			})

			const pcm = new Float32Array(16000)
			const result = await svc.transcribeWithLanguageDetection(pcm, 16000)

			result.text.should.equal("olá mundo")
			result.language.should.equal("pt")
		})

		it("passes languageHint in the postMessage payload", async () => {
			const svc = buildService()

			let transcribeMsg: any = null
			workerInstance.postMessage = sinon.stub().callsFake((msg: any) => {
				transcribeMsg = msg
				setImmediate(() =>
					workerInstance._emit("message", {
						type: "result",
						text: "hello",
						language: "en",
					}),
				)
			})

			const pcm = new Float32Array(8000)
			await svc.transcribeWithLanguageDetection(pcm, 16000, "en")

			transcribeMsg.should.not.be.null()
			transcribeMsg.language.should.equal("en")
		})

		it("rejects when worker sends error type", async () => {
			const svc = buildService()

			workerInstance.postMessage = sinon.stub().callsFake((_msg: any) => {
				setImmediate(() =>
					workerInstance._emit("message", {
						type: "error",
						message: "inference failed",
					}),
				)
			})

			const pcm = new Float32Array(8000)
			await svc.transcribeWithLanguageDetection(pcm, 16000).should.be.rejectedWith("inference failed")
		})

		it("transcribe() convenience method returns text string", async () => {
			const svc = buildService()

			workerInstance.postMessage = sinon.stub().callsFake((_msg: any) => {
				setImmediate(() =>
					workerInstance._emit("message", {
						type: "result",
						text: "test transcription",
						language: "en",
					}),
				)
			})

			const pcm = new Float32Array(4000)
			const text = await svc.transcribe(pcm, 16000)
			text.should.equal("test transcription")
		})
	})
})
