#!/usr/bin/env node

/**
 * CLI entry point for Voice STT (Speech-to-Text)
 * Run: node dist/cli/voice-stt.js
 */

import * as os from "os"
import * as path from "path"
import { WindowsAudioCapture } from "../src/services/audio/WindowsAudioCapture"
import { WhisperService } from "../src/services/voice/WhisperService"

async function main() {
	const modelCachePath = path.join(os.homedir(), ".cache", "nexusai-voice")

	const capture = new WindowsAudioCapture()
	const whisper = WhisperService.getInstance(modelCachePath)

	try {
		process.stdout.write("🎤 Recording audio for 5 seconds...\n(Speak now!)\n\n")

		let audioBytes = 0
		await capture.startCapture({
			duration: 5,
			sampleRate: 16000,
			onChunk: (chunk) => {
				audioBytes += chunk.length
				process.stdout.write("█")
			},
		})

		const pcmBuffer = capture.stopCapture()
		const float32Audio = WindowsAudioCapture.pcmToFloat32(pcmBuffer)

		process.stdout.write(`\n\n✅ Recorded: ${(audioBytes / 1024).toFixed(1)} KB\n\n`)

		process.stdout.write("🔄 Loading Whisper model and transcribing...\n")
		const text = await whisper.transcribe(float32Audio, 16000)

		process.stdout.write("\n📝 You said:\n")
		process.stdout.write(`   "${text}"\n\n`)
		process.stdout.write("✨ Done!\n")

		process.exit(0)
	} catch (error) {
		process.stdout.write(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}\n`)
		process.exit(1)
	}
}

main()
