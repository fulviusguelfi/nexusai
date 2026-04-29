import { afterEach, beforeEach, describe, it } from "mocha"
import "should"
import sinon from "sinon"
import { AudioCapturePool } from "../AudioCapturePool"

describe("AudioCapturePool", () => {
	beforeEach(() => {
		;(AudioCapturePool as any)._held = null
		;(AudioCapturePool as any)._ready = false
		;(AudioCapturePool as any)._starting = false
	})

	afterEach(() => {
		sinon.restore()
		;(AudioCapturePool as any)._held = null
		;(AudioCapturePool as any)._ready = false
		;(AudioCapturePool as any)._starting = false
	})

	it("does not lease a pre-warmed capture for a different microphone", () => {
		sinon.stub(AudioCapturePool, "preWarm").resolves()

		const fakeCapture = { id: "steam" }
		;(AudioCapturePool as any)._held = {
			capture: fakeCapture,
			promise: Promise.resolve(),
			deviceId: "audio=Steam Streaming Microphone",
		}
		;(AudioCapturePool as any)._ready = true

		const leased = (AudioCapturePool as any).lease("audio=Microfone (Jabra Link 380)")

		should(leased).equal(null)
	})
})
