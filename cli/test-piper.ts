#!/usr/bin/env node

/**
 * Test Piper binary download and installation
 */

import * as os from "os"
import * as path from "path"
import { PiperService } from "../src/services/voice/PiperService"

async function main() {
	const modelCachePath = path.join(os.homedir(), ".cache", "nexusai-voice")

	const piper = PiperService.getInstance(modelCachePath)

	try {
		process.stdout.write("🔄 Checking if Piper binary is installed...\n")
		if (piper.isBinaryInstalled()) {
			process.stdout.write("✅ Piper binary already installed\n")
		} else {
			process.stdout.write("⬇️  Downloading Piper binary (this may take a while)\n")
			await piper.ensureBinary()
			process.stdout.write("✅ Piper binary installed successfully!\n")
		}

		process.stdout.write("\n🔊 Testing synthesis...\n")
		const audio = await piper.synthesize("Hello, this is a test of Piper text to speech.")
		process.stdout.write(`✅ Generated audio: ${(audio.length / 1024).toFixed(1)} KB\n`)

		process.stdout.write("\n✨ Success!\n")
		process.exit(0)
	} catch (error) {
		process.stdout.write(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}\n`)
		if (error instanceof Error && error.stack) {
			process.stdout.write(`${error.stack}\n`)
		}
		process.exit(1)
	}
}

main()
