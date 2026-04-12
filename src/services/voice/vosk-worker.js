// vosk-worker.js
// Runs as a child process under system Node.js (not Electron).
// This avoids the ffi-napi / ref-napi ABI incompatibility with Electron 39+.
//
// Protocol: newline-delimited JSON over stdin/stdout.
//   stdin  (parent → worker): { type: 'init', modelPath, sampleRate? }
//                              { type: 'chunk', data: '<base64 PCM>' }
//                              { type: 'finalize' }   ← flushes result, keeps model alive, sends 'ready'
//                              { type: 'reset' }      ← free recognizer, create new one, sends 'ready'
//                              { type: 'exit' }
//   stdout (worker → parent): { type: 'ready' }
//                              { type: 'partial', partial: '...' }
//                              { type: 'sentence', text: '...' }
//                              { type: 'final', text: '...' }
//                              { type: 'error', message: '...' }

const vosk = require("vosk")

let model = null
let recognizer = null
let currentSampleRate = 16000
let inputBuf = ""

// ─── helpers ─────────────────────────────────────────────────────────────────

function send(obj) {
	process.stdout.write(JSON.stringify(obj) + "\n")
}

// vosk API >= 0.3.44 returns objects directly; older versions return JSON strings.
// This helper handles both.
function extractText(result) {
	if (!result) return ""
	if (typeof result === "object") return (result.text || "").trim()
	try {
		return (JSON.parse(result).text || "").trim()
	} catch {
		return ""
	}
}

function extractPartial(result) {
	if (!result) return ""
	if (typeof result === "object") return (result.partial || "").trim()
	try {
		return (JSON.parse(result).partial || "").trim()
	} catch {
		return ""
	}
}

function safeParse(s) {
	try {
		return JSON.parse(s)
	} catch {
		return null
	}
}

function cleanup() {
	if (recognizer) {
		try {
			recognizer.free()
		} catch (_) {}
		recognizer = null
	}
	if (model) {
		try {
			model.free()
		} catch (_) {}
		model = null
	}
}

function resetRecognizer() {
	if (recognizer) {
		try {
			recognizer.free()
		} catch (_) {}
		recognizer = null
	}
	if (model) {
		try {
			recognizer = new vosk.Recognizer({ model, sampleRate: currentSampleRate })
		} catch (e) {
			send({ type: "error", message: String(e) })
		}
	}
}

// ─── message handler ─────────────────────────────────────────────────────────

function handleMsg(msg) {
	if (msg.type === "init") {
		vosk.setLogLevel(-1)
		try {
			currentSampleRate = msg.sampleRate || 16000
			model = new vosk.Model(msg.modelPath)
			recognizer = new vosk.Recognizer({ model, sampleRate: currentSampleRate })
			send({ type: "ready" })
		} catch (e) {
			send({ type: "error", message: String(e) })
		}
	} else if (msg.type === "chunk") {
		if (!recognizer) return
		const pcm = Buffer.from(msg.data, "base64")
		const isFinal = recognizer.acceptWaveform(pcm)
		if (isFinal) {
			const text = extractText(recognizer.result())
			send({ type: "sentence", text })
		} else {
			const partial = extractPartial(recognizer.partialResult())
			if (partial) send({ type: "partial", partial })
		}
	} else if (msg.type === "finalize") {
		if (!recognizer) {
			send({ type: "final", text: "" })
			return
		}
		const text = extractText(recognizer.finalResult())
		send({ type: "final", text })
		// Keep model alive — reset recognizer for next session
		resetRecognizer()
		send({ type: "ready" })
	} else if (msg.type === "reset") {
		// Discard current recognizer, create fresh one (no result returned)
		resetRecognizer()
		send({ type: "ready" })
	} else if (msg.type === "exit") {
		cleanup()
		process.exit(0)
	}
}

// ─── stdin reader ─────────────────────────────────────────────────────────────

process.stdin.setEncoding("utf8")
process.stdin.on("data", (data) => {
	inputBuf += data
	let nl
	while ((nl = inputBuf.indexOf("\n")) !== -1) {
		const line = inputBuf.slice(0, nl).trim()
		inputBuf = inputBuf.slice(nl + 1)
		if (!line) continue
		const msg = safeParse(line)
		if (msg) handleMsg(msg)
	}
})

process.stdin.on("end", () => {
	cleanup()
	process.exit(0)
})

process.on("uncaughtException", (err) => {
	send({ type: "error", message: String(err) })
	process.exit(1)
})
