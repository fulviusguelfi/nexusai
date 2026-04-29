import { describe, it } from "mocha"
import "should"
import { splitIntoSpeechChunks } from "../TtsChunking"

describe("splitIntoSpeechChunks", () => {
	it("returns a single chunk for a single sentence", () => {
		splitIntoSpeechChunks("Ola mundo.").should.deepEqual(["Ola mundo."])
	})

	it("merges short consecutive sentences into a larger chunk", () => {
		splitIntoSpeechChunks("Oi. Tudo bem? Vamos testar o audio.").should.deepEqual(["Oi. Tudo bem? Vamos testar o audio."])
	})

	it("keeps larger blocks separated when the combined chunk would grow too much", () => {
		const first = "Esta e uma sentenca relativamente longa para formar um bloco inicial de fala sem ficar curta demais."
		const second =
			"Aqui vai outra sentenca tambem longa o bastante para justificar um novo bloco e evitar um trecho grande demais para sintetizar de uma vez."
		splitIntoSpeechChunks(`${first} ${second}`).should.deepEqual([first, second])
	})
})
