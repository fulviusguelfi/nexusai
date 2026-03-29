import { EventEmitter } from "events"
import * as fs from "fs"
import { afterEach, beforeEach, describe, it } from "mocha"
import * as os from "os"
import * as path from "path"
import "should"
import sinon from "sinon"
import { WhisperCliService } from "../WhisperCliService"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fake ChildProcess that emits close(exitCode) on nextTick */
function fakeProcess(exitCode = 0) {
	const emitter = new EventEmitter()
	const proc = {
		stdout: new EventEmitter(),
		stderr: new EventEmitter(),
		stdin: null,
		on: emitter.on.bind(emitter),
		emit: emitter.emit.bind(emitter),
	}
	setImmediate(() => emitter.emit("close", exitCode))
	return proc as any
}

/** Fake spawn that writes whisper-cli JSON output then exits cleanly */
function fakeWhisperSpawn(text: string, language = "pt") {
	return sinon.stub().callsFake((_cmd: string, args: string[]) => {
		const ofIdx = args.indexOf("-of")
		if (ofIdx !== -1) {
			const outputPrefix = args[ofIdx + 1]
			const json = {
				result: { language },
				transcription: text ? [{ text: ` ${text}` }] : [],
			}
			fs.writeFileSync(`${outputPrefix}.json`, JSON.stringify(json))
		}
		return fakeProcess(0)
	})
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WhisperCliService", () => {
	const storageDir = path.join(os.tmpdir(), `nexusai-test-whisper-${Date.now()}`)

	beforeEach(() => {
		WhisperCliService.clearInstance()
		fs.mkdirSync(storageDir, { recursive: true })
	})

	afterEach(() => {
		sinon.restore()
		WhisperCliService.clearInstance()
		fs.rmSync(storageDir, { recursive: true, force: true })
	})

	// ── Static helpers ────────────────────────────────────────────────────────

	describe("isPlatformSupported()", () => {
		it("returns a boolean", () => {
			WhisperCliService.isPlatformSupported().should.be.a.Boolean()
		})

		it("returns true on win32-x64, false elsewhere", () => {
			const expected = os.platform() === "win32" && os.arch() === "x64"
			WhisperCliService.isPlatformSupported().should.equal(expected)
		})
	})

	// ── Singleton ─────────────────────────────────────────────────────────────

	describe("singleton", () => {
		it("getInstance() returns the same instance on repeated calls", () => {
			const a = WhisperCliService.getInstance(storageDir)
			const b = WhisperCliService.getInstance(storageDir)
			a.should.equal(b)
		})

		it("clearInstance() forces a new instance to be created", () => {
			const a = WhisperCliService.getInstance(storageDir)
			WhisperCliService.clearInstance()
			const b = WhisperCliService.getInstance(storageDir)
			a.should.not.equal(b)
		})
	})

	// ── isModelDownloaded() ───────────────────────────────────────────────────

	describe("isModelDownloaded()", () => {
		it("returns false when model file is absent", () => {
			WhisperCliService.getInstance(storageDir).isModelDownloaded().should.be.false()
		})

		it("returns true when model file exists", () => {
			const modelsDir = path.join(storageDir, "voice", "whisper-models")
			fs.mkdirSync(modelsDir, { recursive: true })
			fs.writeFileSync(path.join(modelsDir, "ggml-small.bin"), Buffer.alloc(0))

			WhisperCliService.getInstance(storageDir).isModelDownloaded().should.be.true()
		})
	})

	// ── dispose() ─────────────────────────────────────────────────────────────

	describe("dispose()", () => {
		it("clears the singleton without throwing", () => {
			const svc = WhisperCliService.getInstance(storageDir)
			;(() => svc.dispose()).should.not.throw()
		})

		it("allows a fresh getInstance() after dispose", () => {
			const a = WhisperCliService.getInstance(storageDir)
			a.dispose()
			const b = WhisperCliService.getInstance(storageDir)
			a.should.not.equal(b)
		})
	})

	// ── transcribeWithLanguageDetection() — requires win32-x64 ───────────────

	describe("transcribeWithLanguageDetection()", () => {
		if (os.platform() !== "win32" || os.arch() !== "x64") {
			it("throws WHISPER_CLI_UNSUPPORTED_PLATFORM on non-Windows platforms", async () => {
				const svc = WhisperCliService.getInstance(storageDir)
				const float32 = new Float32Array(16000)
				await svc
					.transcribeWithLanguageDetection(float32, 16000)
					.should.be.rejectedWith(/WHISPER_CLI_UNSUPPORTED_PLATFORM/)
			})
			return
		}

		/** Prepopulate the fake binary and model so _ensure* methods skip download */
		function seedBinaryAndModel() {
			const binDir = path.join(storageDir, "voice", "whisper-cli", "Release")
			const modelsDir = path.join(storageDir, "voice", "whisper-models")
			fs.mkdirSync(binDir, { recursive: true })
			fs.mkdirSync(modelsDir, { recursive: true })
			fs.writeFileSync(path.join(binDir, "whisper-cli.exe"), Buffer.alloc(0))
			fs.writeFileSync(path.join(modelsDir, "ggml-small.bin"), Buffer.alloc(0))
		}

		it("returns trimmed text and detected language from JSON output", async function () {
			this.timeout(5_000)
			seedBinaryAndModel()

			const spawnStub = fakeWhisperSpawn("Olá mundo.", "pt")
			const svc = WhisperCliService.getInstance(storageDir, spawnStub)
			const float32 = new Float32Array(16000)

			const result = await svc.transcribeWithLanguageDetection(float32, 16000, "pt")

			result.text.should.equal("Olá mundo.")
			result.language.should.equal("pt")
		})

		it("concatenates multiple transcription segments", async function () {
			this.timeout(5_000)
			seedBinaryAndModel()

			const spawnStub = sinon.stub().callsFake((_cmd: string, args: string[]) => {
				const ofIdx = args.indexOf("-of")
				const outputPrefix = args[ofIdx + 1]
				const json = {
					result: { language: "pt" },
					transcription: [{ text: " Parte um." }, { text: " Parte dois." }],
				}
				fs.writeFileSync(`${outputPrefix}.json`, JSON.stringify(json))
				return fakeProcess(0)
			})

			const svc = WhisperCliService.getInstance(storageDir, spawnStub)
			const float32 = new Float32Array(16000)

			const result = await svc.transcribeWithLanguageDetection(float32, 16000)
			result.text.should.equal("Parte um. Parte dois.")
		})

		it("returns empty text for silence ([BLANK_AUDIO])", async function () {
			this.timeout(5_000)
			seedBinaryAndModel()

			const spawnStub = sinon.stub().callsFake((_cmd: string, args: string[]) => {
				const ofIdx = args.indexOf("-of")
				const outputPrefix = args[ofIdx + 1]
				const json = {
					result: { language: "en" },
					transcription: [{ text: " [BLANK_AUDIO]" }],
				}
				fs.writeFileSync(`${outputPrefix}.json`, JSON.stringify(json))
				return fakeProcess(0)
			})

			const svc = WhisperCliService.getInstance(storageDir, spawnStub)
			const float32 = new Float32Array(16000)

			const result = await svc.transcribeWithLanguageDetection(float32, 16000)
			result.text.should.equal("")
		})

		it("throws when subprocess exits with non-zero code", async function () {
			this.timeout(5_000)
			seedBinaryAndModel()

			const spawnStub = sinon.stub().returns(fakeProcess(1))
			const svc = WhisperCliService.getInstance(storageDir, spawnStub)
			const float32 = new Float32Array(16000)

			await svc.transcribeWithLanguageDetection(float32, 16000).should.be.rejectedWith(/exited with code 1/)
		})

		it("cleans up temp WAV and JSON files after transcription", async function () {
			this.timeout(5_000)
			seedBinaryAndModel()

			const createdFiles: string[] = []
			const spawnStub = sinon.stub().callsFake((_cmd: string, args: string[]) => {
				const ofIdx = args.indexOf("-of")
				const outputPrefix = args[ofIdx + 1]
				const jsonPath = `${outputPrefix}.json`
				fs.writeFileSync(jsonPath, JSON.stringify({ result: { language: "en" }, transcription: [] }))
				createdFiles.push(jsonPath)
				// Also track the -f (wav) path
				const fIdx = args.indexOf("-f")
				if (fIdx !== -1) createdFiles.push(args[fIdx + 1])
				return fakeProcess(0)
			})

			const svc = WhisperCliService.getInstance(storageDir, spawnStub)
			await svc.transcribeWithLanguageDetection(new Float32Array(16000), 16000)

			for (const file of createdFiles) {
				if (fs.existsSync(file)) {
					throw new Error(`Temp file should have been deleted: ${file}`)
				}
			}
		})
	})
})
