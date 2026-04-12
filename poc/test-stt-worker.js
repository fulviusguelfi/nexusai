/**
 * PoC test harness: spawns a Python STT worker and pipes audio from FFmpeg.
 *
 * Usage:
 *   node poc/test-stt-worker.js realtimestt
 *   node poc/test-stt-worker.js whisper
 *
 * Requirements:
 *   pip install RealtimeSTT        (for realtimestt)
 *   pip install faster-whisper     (for whisper)
 *   ffmpeg in PATH
 *
 * The test captures 8 seconds of mic audio, sends as chunks,
 * then sends 'finalize' and prints the result.
 *
 * Push-to-talk simulation: ctrl+C stops capture and triggers finalize.
 */

const { spawn } = require("child_process")
const path = require("path")
const readline = require("readline")

const WORKER = process.argv[2] || "whisper"
const SCRIPT_MAP = {
	realtimestt: path.join(__dirname, "stt-realtimestt-worker.py"),
	whisper: path.join(__dirname, "stt-whisper-worker.py"),
}

const scriptPath = SCRIPT_MAP[WORKER]
if (!scriptPath) {
	console.error(`Unknown worker: ${WORKER}. Use 'realtimestt' or 'whisper'`)
	process.exit(1)
}

const SAMPLE_RATE = 16000
const CHUNK_MS = 250 // send chunks every 250ms
const TEST_DURATION_S = 8 // auto-stop after 8s (or Ctrl+C)

console.log(`\n=== NexusAI STT PoC — ${WORKER} ===`)
console.log(`Script: ${scriptPath}`)
console.log(`Press Ctrl+C to finalize early.\n`)

// ── Spawn Python worker ───────────────────────────────────────────────────────
const worker = spawn("python", [scriptPath], {
	stdio: ["pipe", "pipe", "pipe"],
})

worker.stderr.on("data", (d) => process.stderr.write(`[worker stderr] ${d}`))
worker.on("exit", (code) => console.log(`\n[worker] exited with code ${code}`))

let workerReady = false
let lineBuffer = ""

function sendToWorker(obj) {
	worker.stdin.write(JSON.stringify(obj) + "\n")
}

worker.stdout.on("data", (data) => {
	lineBuffer += data.toString()
	let nl
	while ((nl = lineBuffer.indexOf("\n")) !== -1) {
		const line = lineBuffer.slice(0, nl).trim()
		lineBuffer = lineBuffer.slice(nl + 1)
		if (!line) continue
		try {
			const msg = JSON.parse(line)
			handleWorkerMessage(msg)
		} catch {
			console.log(`[worker raw] ${line}`)
		}
	}
})

function handleWorkerMessage(msg) {
	switch (msg.type) {
		case "ready":
			if (!workerReady) {
				workerReady = true
				console.log("[✅] Worker ready — starting mic capture...")
				startCapture().catch((e) => console.error(`[capture error] ${e}`))
			} else {
				console.log("[✅] Worker ready (reset)")
			}
			break
		case "partial":
			process.stdout.write(`\r[PARTIAL] ${msg.partial}                    `)
			break
		case "sentence":
			console.log(`\n[SENTENCE] ${msg.text}`)
			break
		case "final":
			console.log(`\n[FINAL]    ${msg.text}`)
			break
		case "error":
			console.error(`\n[ERROR] ${msg.message}`)
			break
		default:
			console.log(`[worker] ${JSON.stringify(msg)}`)
	}
}

// ── Init worker ───────────────────────────────────────────────────────────────
sendToWorker({ type: "init", sampleRate: SAMPLE_RATE })

// ── FFmpeg mic capture ────────────────────────────────────────────────────────
let ffmpeg = null
let finalizeTimeout = null

function enumerateAudioDevices() {
	return new Promise((resolve) => {
		const probe = spawn("ffmpeg", ["-f", "dshow", "-list_devices", "true", "-i", "dummy"], {
			stdio: ["ignore", "ignore", "pipe"],
		})
		let stderr = ""
		probe.stderr.on("data", (d) => (stderr += d.toString()))
		probe.on("close", () => {
			const devices = []
			for (const line of stderr.split("\n")) {
				const m = line.match(/"([^"]+)"\s+\(audio\)/)
				if (m) devices.push(m[1])
			}
			resolve(devices)
		})
	})
}

async function startCapture() {
	const devices = await enumerateAudioDevices()
	if (devices.length === 0) {
		console.error("[FFmpeg] No audio devices found. Is a microphone connected?")
		doFinalize()
		return
	}
	const deviceName = devices[0]
	console.log(`[FFmpeg] Using device: ${deviceName}`)

	// Auto-stop after TEST_DURATION_S
	finalizeTimeout = setTimeout(() => {
		console.log(`\n[auto-stop after ${TEST_DURATION_S}s]`)
		doFinalize()
	}, TEST_DURATION_S * 1000)

	// FFmpeg: capture from detected mic → raw PCM int16 mono 16kHz
	ffmpeg = spawn(
		"ffmpeg",
		["-f", "dshow", "-i", `audio=${deviceName}`, "-ar", String(SAMPLE_RATE), "-ac", "1", "-f", "s16le", "-"],
		{ stdio: ["ignore", "pipe", "pipe"] },
	)

	ffmpeg.stderr.on("data", (d) => {
		// ffmpeg is verbose on stderr; filter to just device selection lines
		const text = d.toString()
		if (text.includes("Input #") || text.includes("Stream #") || text.includes("Error")) {
			process.stderr.write(`[ffmpeg] ${text}`)
		}
	})

	const bytesPerChunk = (SAMPLE_RATE * 2 * CHUNK_MS) / 1000 // int16 = 2 bytes/sample
	let pcmBuffer = Buffer.alloc(0)

	ffmpeg.stdout.on("data", (data) => {
		pcmBuffer = Buffer.concat([pcmBuffer, data])
		while (pcmBuffer.length >= bytesPerChunk) {
			const chunk = pcmBuffer.slice(0, bytesPerChunk)
			pcmBuffer = pcmBuffer.slice(bytesPerChunk)
			sendToWorker({ type: "chunk", data: chunk.toString("base64") })
		}
	})

	ffmpeg.on("exit", (code) => {
		if (code !== null && code !== 0 && code !== 255) {
			console.error(`[ffmpeg] exited with code ${code}`)
		}
	})
}

function doFinalize() {
	if (finalizeTimeout) {
		clearTimeout(finalizeTimeout)
		finalizeTimeout = null
	}
	if (ffmpeg) {
		ffmpeg.kill("SIGTERM")
		ffmpeg = null
	}
	console.log("\n[→ finalize sent]")
	sendToWorker({ type: "finalize" })

	// Give worker 10s to respond, then exit
	setTimeout(() => {
		sendToWorker({ type: "exit" })
		setTimeout(() => process.exit(0), 1000)
	}, 10000)
}

// Ctrl+C → finalize
process.on("SIGINT", () => {
	console.log("\n[Ctrl+C detected — finalizing...]")
	doFinalize()
})
