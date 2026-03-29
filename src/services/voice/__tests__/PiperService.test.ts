import * as fs from "fs"
import { afterEach, beforeEach, describe, it } from "mocha"
import * as os from "os"
import * as path from "path"
import "should"
import sinon from "sinon"
import { PiperService } from "../PiperService"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PiperService", () => {
	let storageDir: string

	beforeEach(() => {
		storageDir = path.join(os.tmpdir(), `nexusai-test-piper-${Date.now()}`)
		fs.mkdirSync(storageDir, { recursive: true })

		// Reset singleton before each test
		try {
			PiperService.getInstance(storageDir).dispose()
		} catch {
			// ignore if already disposed
		}
	})

	afterEach(() => {
		sinon.restore()
		try {
			fs.rmSync(storageDir, { recursive: true, force: true })
		} catch {
			// ignore cleanup failures
		}
	})

	describe("singleton", () => {
		it("returns the same instance on repeated calls", () => {
			const a = PiperService.getInstance(storageDir)
			const b = PiperService.getInstance(storageDir)
			a.should.equal(b)
		})

		it("creates a fresh instance after dispose", () => {
			const a = PiperService.getInstance(storageDir)
			a.dispose()
			const b = PiperService.getInstance(storageDir)
			b.should.not.equal(a)
			b.dispose()
		})
	})

	describe("isBinaryInstalled()", () => {
		it("returns false when binary does not exist", () => {
			const service = PiperService.getInstance(storageDir)
			service.isBinaryInstalled().should.be.false()
		})

		it("returns true when binary file exists at binaryPath", () => {
			const service = PiperService.getInstance(storageDir)
			const binaryPath = service.binaryPath
			fs.mkdirSync(path.dirname(binaryPath), { recursive: true })
			fs.writeFileSync(binaryPath, "fake binary")

			service.isBinaryInstalled().should.be.true()
		})
	})

	describe("binaryPath", () => {
		it("returns a non-empty string", () => {
			const service = PiperService.getInstance(storageDir)
			service.binaryPath.should.be.a.String()
			service.binaryPath.length.should.be.greaterThan(0)
		})

		it("includes the storage dir in the binary path", () => {
			const service = PiperService.getInstance(storageDir)
			service.binaryPath.should.containEql(storageDir)
		})

		it("returns the alt path when binary exists in piper/ subdirectory", () => {
			const service = PiperService.getInstance(storageDir)
			const binaryName = os.platform() === "win32" ? "piper.exe" : "piper"
			const altPath = path.join(storageDir, "voice", "piper", "piper", binaryName)
			fs.mkdirSync(path.dirname(altPath), { recursive: true })
			fs.writeFileSync(altPath, "fake binary in subdir")

			// binaryPath should now return the alt path
			service.binaryPath.should.equal(altPath)
		})
	})

	describe("synthesize() — model not found error", () => {
		it("rejects with model-not-found when model files are absent", async () => {
			const service = PiperService.getInstance(storageDir)

			// Create the binary file so isBinaryInstalled() returns true
			const binaryPath = service.binaryPath
			fs.mkdirSync(path.dirname(binaryPath), { recursive: true })
			fs.writeFileSync(binaryPath, "fake binary")

			// Stub internal download to skip network calls
			sinon.stub(service as any, "_ensureVoiceModel").resolves()

			try {
				await service.synthesize("Hello world")
				throw new Error("should have rejected")
			} catch (err: any) {
				err.message.should.containEql("Voice model not found")
			}
		})
	})

	describe("_pcm16ToWav() header validation", () => {
		it("generates a 44-byte WAV header followed by PCM data", () => {
			const service = PiperService.getInstance(storageDir)
			const pcm = Buffer.alloc(100, 0)
			const wav = (service as any)._pcm16ToWav(pcm, 22050)

			// Total length = 44 (header) + pcm.length
			wav.length.should.equal(44 + pcm.length)
		})

		it("starts with RIFF and WAVE markers", () => {
			const service = PiperService.getInstance(storageDir)
			const pcm = Buffer.alloc(100, 0)
			const wav = (service as any)._pcm16ToWav(pcm, 22050)

			wav.toString("ascii", 0, 4).should.equal("RIFF")
			wav.toString("ascii", 8, 12).should.equal("WAVE")
			wav.toString("ascii", 12, 16).should.equal("fmt ")
			wav.toString("ascii", 36, 40).should.equal("data")
		})

		it("writes data chunk size equal to PCM buffer length", () => {
			const service = PiperService.getInstance(storageDir)
			const pcm = Buffer.alloc(200, 0)
			const wav = (service as any)._pcm16ToWav(pcm, 22050)

			wav.readUInt32LE(40).should.equal(pcm.length)
		})

		it("writes correct sample rate (22050 Hz)", () => {
			const service = PiperService.getInstance(storageDir)
			const pcm = Buffer.alloc(100, 0)
			const wav = (service as any)._pcm16ToWav(pcm, 22050)

			wav.readUInt32LE(24).should.equal(22050)
		})

		it("writes correct sample rate (16000 Hz)", () => {
			const service = PiperService.getInstance(storageDir)
			const pcm = Buffer.alloc(100, 0)
			const wav = (service as any)._pcm16ToWav(pcm, 16000)

			wav.readUInt32LE(24).should.equal(16000)
		})

		it("writes mono channel (1) at offset 22", () => {
			const service = PiperService.getInstance(storageDir)
			const pcm = Buffer.alloc(100, 0)
			const wav = (service as any)._pcm16ToWav(pcm, 22050)

			wav.readUInt16LE(22).should.equal(1)
		})

		it("writes 16 bits per sample at offset 34", () => {
			const service = PiperService.getInstance(storageDir)
			const pcm = Buffer.alloc(100, 0)
			const wav = (service as any)._pcm16ToWav(pcm, 22050)

			wav.readUInt16LE(34).should.equal(16)
		})

		it("writes PCM format tag (1) at offset 20", () => {
			const service = PiperService.getInstance(storageDir)
			const pcm = Buffer.alloc(100, 0)
			const wav = (service as any)._pcm16ToWav(pcm, 22050)

			wav.readUInt16LE(20).should.equal(1)
		})
	})
})
