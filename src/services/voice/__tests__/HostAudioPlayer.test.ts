import { afterEach, beforeEach, describe, it } from "mocha"
import "should"
import * as fs from "fs"
import * as sinon from "sinon"
import { Logger } from "@/shared/services/Logger"
import { buildWin32MciScript, playWavBuffer } from "../HostAudioPlayer"

const childProcessModule = require("child_process") as typeof import("child_process")

describe("HostAudioPlayer", () => {
	let execFileStub: sinon.SinonStub
	let loggerWarnStub: sinon.SinonStub
	let loggerDebugStub: sinon.SinonStub
	let fsWriteStub: sinon.SinonStub
	let fsUnlinkStub: sinon.SinonStub

	const getExecFileCallback = (...args: any[]) => {
		const maybeCallback = args[args.length - 1]
		if (typeof maybeCallback !== "function") {
			throw new Error("execFile callback missing in test stub")
		}
		return maybeCallback
	}

	beforeEach(() => {
		execFileStub = sinon.stub(childProcessModule, "execFile")
		loggerWarnStub = sinon.stub(Logger, "warn")
		loggerDebugStub = sinon.stub(Logger, "debug")
		fsWriteStub = sinon.stub(fs.promises, "writeFile").resolves()
		fsUnlinkStub = sinon.stub(fs.promises, "unlink").resolves()
	})

	afterEach(() => {
		sinon.restore()
	})

	describe("buildWin32MciScript", () => {
		it("builds Windows playback script without setaudio when output device is not selected", () => {
			const script = buildWin32MciScript("C:/tmp/test.wav")
			script.should.not.containEql("setaudio snd output to")
			script.should.containEql('if ($openRc -ne 0) { throw "MCI open failed rc=$openRc" }')
			script.should.containEql("play snd wait")
		})

		it("builds Windows playback script with setaudio when output device is selected", () => {
			const script = buildWin32MciScript("C:/tmp/test.wav", "Alto-falantes (USB Audio)")
			script.should.containEql("setaudio snd output to")
			script.should.containEql(
				'if ($setRc -ne 0) { throw "MCI setaudio failed rc=$setRc device=Alto-falantes (USB Audio)" }',
			)
			script.should.containEql("Alto-falantes (USB Audio)")
			script.should.containEql("play snd wait")
		})

		it("escapes single quotes in device name", () => {
			const script = buildWin32MciScript("C:/tmp/test.wav", "Device's Name")
			script.should.containEql("Device''s Name")
		})

		it("escapes single quotes in file path", () => {
			const script = buildWin32MciScript("C:/tmp/file's.wav")
			script.should.containEql("file''s.wav")
		})
	})

	describe("playWavBuffer", () => {
		it("resolves when MCI playback succeeds with device selection", async () => {
			execFileStub.callsFake((...args: any[]) => {
				const callback = getExecFileCallback(...args)
				setImmediate(() => callback(null, "", ""))
			})

			const wavBuf = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])
			await playWavBuffer(wavBuf, "Speakers")

			sinon.assert.called(execFileStub)
			const call = execFileStub.firstCall
			call.args[0].should.equal("powershell")
			const command = call.args[1][3]
			command.should.containEql("setaudio snd output to")
			command.should.containEql("Speakers")
		})

		it("resolves when MCI playback succeeds without device selection", async () => {
			execFileStub.callsFake((...args: any[]) => {
				const callback = getExecFileCallback(...args)
				setImmediate(() => callback(null, "", ""))
			})

			const wavBuf = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])
			await playWavBuffer(wavBuf)

			sinon.assert.called(execFileStub)
		})

		it("falls back to SoundPlayer when MCI fails and no output device was selected", async () => {
			const mciError = new Error("MCI failed")
			let callCount = 0

			execFileStub.callsFake((...args: any[]) => {
				const callback = getExecFileCallback(...args)
				callCount++
				if (callCount === 1) {
					// First call (MCI) fails
					setImmediate(() => callback(mciError, "", "Device not found"))
				} else {
					// Second call (SoundPlayer) succeeds
					setImmediate(() => callback(null, "", ""))
				}
			})

			const wavBuf = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])
			await playWavBuffer(wavBuf)

			sinon.assert.calledTwice(execFileStub)
			sinon.assert.called(loggerWarnStub)
		})

		it("rejects without falling back when selected output device playback fails", async () => {
			const mciError = new Error("MCI setaudio failed")

			execFileStub.callsFake((...args: any[]) => {
				const callback = getExecFileCallback(...args)
				setImmediate(() => callback(mciError, "", "Device not found"))
			})

			const wavBuf = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])

			try {
				await playWavBuffer(wavBuf, "NonExistentDevice")
				throw new Error("Should have rejected")
			} catch (err: any) {
				err.message.should.equal("MCI setaudio failed")
			}

			sinon.assert.calledOnce(execFileStub)
			loggerWarnStub
				.calledWithMatch("[HostAudioPlayer] Selected output device playback failed; not falling back to default device:")
				.should.be.true()
		})

		it("rejects when both MCI and SoundPlayer fail without selected output device", async () => {
			const mciError = new Error("MCI failed")
			const soundPlayerError = new Error("SoundPlayer failed")
			let callCount = 0

			execFileStub.callsFake((...args: any[]) => {
				const callback = getExecFileCallback(...args)
				callCount++
				if (callCount === 1) {
					setImmediate(() => callback(mciError, "", ""))
				} else {
					setImmediate(() => callback(soundPlayerError, "", ""))
				}
			})

			const wavBuf = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])

			try {
				await playWavBuffer(wavBuf)
				throw new Error("Should have rejected")
			} catch (err: any) {
				err.message.should.equal("SoundPlayer failed")
			}

			sinon.assert.calledTwice(execFileStub)
		})

		it("cleans up temp file on success", async () => {
			execFileStub.callsFake((...args: any[]) => {
				const callback = getExecFileCallback(...args)
				setImmediate(() => callback(null, "", ""))
			})

			const wavBuf = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])
			await playWavBuffer(wavBuf)

			sinon.assert.called(fsWriteStub)
			sinon.assert.called(fsUnlinkStub)
		})

		it("cleans up temp file even on failure", async () => {
			const mciError = new Error("MCI failed")
			const soundPlayerError = new Error("SoundPlayer failed")
			let callCount = 0

			execFileStub.callsFake((...args: any[]) => {
				const callback = getExecFileCallback(...args)
				callCount++
				if (callCount === 1) {
					setImmediate(() => callback(mciError, "", ""))
				} else {
					setImmediate(() => callback(soundPlayerError, "", ""))
				}
			})

			const wavBuf = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])

			try {
				await playWavBuffer(wavBuf, "InvalidDevice")
			} catch {
				// Expected
			}

			sinon.assert.called(fsWriteStub)
			sinon.assert.called(fsUnlinkStub)
		})
	})
})
