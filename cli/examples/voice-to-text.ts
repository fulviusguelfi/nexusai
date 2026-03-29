#!/usr/bin/env node

/**
 * CLI Voice STT Example
 * Records audio from microphone and transcribes using Whisper offline
 * Shows how to use WindowsAudioCapture + WhisperService without any VS Code dependency
 */

import * as os from "os"
import * as path from "path"
import { WindowsAudioCapture } from "../../src/services/audio/WindowsAudioCapture"
import { WhisperService } from "../../src/services/voice/WhisperService"

async function main() {
	// Use system cache directory for models storage
	const modelCachePath = path.join(os.homedir(), ".cache", "nexusai-voice")

	// Initialize services
	const capture = new WindowsAudioCapture()
	const whisper = WhisperService.getInstance(modelCachePath)

	try {
		// Step 1: Record audio
		process.stdout.write("🎤 Recording audio for 10 seconds...\n(Speak into your microphone)\n")

		let audioBytes = 0
		await capture.startCapture({
			duration: 10,
			sampleRate: 16000,
			onChunk: (chunk) => {
				audioBytes += chunk.length
				process.stdout.write("▌")
			},
		})

		const pcmBuffer = capture.stopCapture()
		const float32Audio = WindowsAudioCapture.pcmToFloat32(pcmBuffer)

		process.stdout.write(`\n✅ Recorded ${(audioBytes / 1024).toFixed(1)} KB\n\n`)

		// Step 2: Transcribe with Whisper (sample rate must match capture rate)
		process.stdout.write("🔄 Transcribing...\n")
		const text = await whisper.transcribe(float32Audio, 16000)

		process.stdout.write("\n📝 Transcription:\n")
		process.stdout.write(`   "${text}"\n`)
		process.stdout.write("\n✨ Done!\n")
	} catch (error) {
		process.stdout.write(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}\n`)
		process.exit(1)
	}
}

main()
