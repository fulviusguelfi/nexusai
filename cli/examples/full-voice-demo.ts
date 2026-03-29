#!/usr/bin/env node

/**
 * CLI Full Voice Example: Speech-to-Text + Text-to-Speech
 * Complete example showing STT and TTS offline without VS Code
 */

import { spawn } from "child_process"
import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import { WindowsAudioCapture } from "../../src/services/audio/WindowsAudioCapture"
import { PiperService } from "../../src/services/voice/PiperService"
import { WhisperService } from "../../src/services/voice/WhisperService"

async function playAudio(audioBuffer: Buffer): Promise<void> {
	return new Promise((resolve, reject) => {
		// Save to temp file and play
		const tempFile = path.join(process.env.TEMP || "/tmp", `audio-${Date.now()}.wav`)

		// Create WAV header for the raw PCM data
		const sampleRate = 22050 // Standard TTS output rate
		const numChannels = 1
		const bitsPerSample = 16
		const fileSize = audioBuffer.length + 36
		const byteRate = (sampleRate * numChannels * bitsPerSample) / 8
		const blockAlign = (numChannels * bitsPerSample) / 8

		// WAV header
		const header = Buffer.alloc(44)
		header.write("RIFF", 0)
		header.writeUInt32LE(fileSize, 4)
		header.write("WAVE", 8)
		header.write("fmt ", 12)
		header.writeUInt32LE(16, 16) // Subchunk1Size
		header.writeUInt16LE(1, 20) // AudioFormat (1 = PCM)
		header.writeUInt16LE(numChannels, 22)
		header.writeUInt32LE(sampleRate, 24)
		header.writeUInt32LE(byteRate, 28)
		header.writeUInt16LE(blockAlign, 32)
		header.writeUInt16LE(bitsPerSample, 34)
		header.write("data", 36)
		header.writeUInt32LE(audioBuffer.length, 40)

		const wavFile = Buffer.concat([header, audioBuffer])

		fs.writeFile(tempFile, wavFile)
			.then(() => {
				// Play using Windows built-in player
				const player = spawn("powershell", ["-Command", `[System.Media.SoundPlayer]::new('${tempFile}').PlaySync()`])

				player.on("close", () => {
					fs.unlink(tempFile).catch(() => {})
					resolve()
				})

				player.on("error", reject)
			})
			.catch(reject)
	})
}

async function main() {
	// Use system cache directory for models storage
	const modelCachePath = path.join(os.homedir(), ".cache", "nexusai-voice")

	const capture = new WindowsAudioCapture()
	const whisper = WhisperService.getInstance(modelCachePath)
	const piper = PiperService.getInstance(modelCachePath)

	try {
		// Step 1: Record user speech
		process.stdout.write("🎤 Recording your voice (5 seconds)...\nTell me something!\n\n")

		await capture.startCapture({
			duration: 5,
			onChunk: () => process.stdout.write("▁"),
		})

		const pcmBuffer = capture.stopCapture()
		const userAudio = WindowsAudioCapture.pcmToFloat32(pcmBuffer)

		process.stdout.write("\n✅ Recording complete.\n\n")

		// Step 2: Transcribe with Whisper (STT)
		process.stdout.write("🔄 Transcribing...\n")
		const transcribedText = await whisper.transcribe(userAudio, 16000)

		process.stdout.write(`📝 You said: "${transcribedText}"\n\n`)

		// Step 3: Generate response with TTS
		const responseText = `You said: ${transcribedText}. This is a text-to-speech response.`

		process.stdout.write("🔄 Synthesizing response with Piper TTS...\n")
		const audioBuffer = await piper.synthesize(responseText)
		process.stdout.write(`✅ Generated audio (${(audioBuffer.length / 1024).toFixed(1)} KB)\n\n`)

		// Step 4: Play audio
		process.stdout.write("🔊 Playing response...\n")
		await playAudio(audioBuffer)
		process.stdout.write("\n✨ Demo complete!\n")
	} catch (error) {
		process.stdout.write(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}\n`)
		if (error instanceof Error) {
			process.stdout.write(`${error.stack}\n`)
		}
		process.exit(1)
	}
}

main()
