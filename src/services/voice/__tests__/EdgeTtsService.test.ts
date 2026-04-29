import { describe, it } from "mocha"
import "should"
import { buildEdgeTtsSpeechConfigMessage, EDGE_TTS_OUTPUT_FORMAT, extractEdgeAudioChunk } from "../EdgeTtsService"

describe("EdgeTtsService", () => {
	it("uses an Edge-supported output format in the speech config", () => {
		EDGE_TTS_OUTPUT_FORMAT.should.match(/^audio-24khz-\d+kbitrate-mono-mp3$/)

		const message = buildEdgeTtsSpeechConfigMessage("2026-04-27T00:00:00.000Z")
		const body = message.split("\r\n\r\n")[1]
		const config = JSON.parse(body)

		config.context.synthesis.audio.outputFormat.should.equal(EDGE_TTS_OUTPUT_FORMAT)
	})

	it("extracts audio bytes from binary frames containing internal Edge headers", () => {
		const audio = Buffer.from([0xff, 0xfb, 0x90, 0x64])
		const payload = Buffer.concat([
			Buffer.from([0x00, 0x00]),
			Buffer.from("X-RequestId:ABC\r\nPath:audio\r\nX-StreamId:1\r\n\r\n", "utf8"),
			audio,
		])

		const extracted = extractEdgeAudioChunk(payload)
		extracted.equals(audio).should.be.true()
	})
})
