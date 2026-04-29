import { afterEach, beforeEach, describe, it } from "mocha"
import "should"
import sinon from "sinon"
import * as WindowsAudioCapture from "@/services/audio/WindowsAudioCapture"
import { VoiceDeviceManager } from "@/services/voice/VoiceDeviceManager"
import { enumerateAudioDevices } from "../enumerateAudioDevices"

describe("enumerateAudioDevices", () => {
	let clearCacheStub: sinon.SinonStub

	beforeEach(() => {
		clearCacheStub = sinon.stub(VoiceDeviceManager, "clearCache")
		sinon.stub(VoiceDeviceManager, "getAvailableDevices").resolves([
			{
				id: "mic-1",
				name: "Microfone (Jabra Link 380)",
				isDefault: true,
				isActive: true,
				lastChecked: Date.now(),
			},
		])
		sinon.stub(WindowsAudioCapture, "enumerateWindowsRenderDevices").resolves(["Alto-falantes (USB Audio)"])
	})

	afterEach(() => {
		sinon.restore()
	})

	it("returns host-side input and output device lists without Web API", async () => {
		const response = await enumerateAudioDevices({} as any, {})
		const inputDevices = response.inputDevices ?? []
		const outputDevices = response.outputDevices ?? []

		;(response.error === undefined || response.error === "").should.equal(true)
		inputDevices.length.should.equal(1)
		outputDevices.length.should.equal(1)
		inputDevices[0].deviceId.should.equal("audio=Microfone (Jabra Link 380)")
		inputDevices[0].label.should.equal("Microfone (Jabra Link 380)")
		outputDevices[0].deviceId.should.equal("Alto-falantes (USB Audio)")
		outputDevices[0].label.should.equal("Alto-falantes (USB Audio)")
		sinon.assert.calledOnce(clearCacheStub)
	})
})
