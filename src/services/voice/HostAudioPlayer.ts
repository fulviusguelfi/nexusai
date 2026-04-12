/**
 * HostAudioPlayer — plays WAV audio on the extension host (Node.js) side.
 *
 * VS Code webview autoplay policy blocks HTMLAudioElement.play() even for muted
 * elements, so audio playback must happen here in the extension host process.
 *
 * Strategy per platform:
 *   Windows  → PowerShell System.Media.SoundPlayer.PlaySync() via temp file
 *   macOS    → afplay (built-in)
 *   Linux    → aplay (ALSA), fallback to paplay (PulseAudio)
 */
import { execFile } from "child_process"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import { Logger } from "@/shared/services/Logger"

/**
 * Writes `wavBuf` to a temp file, plays it synchronously via the OS audio
 * stack, then deletes the temp file.  Resolves when playback finishes.
 * Rejects (non-fatally) on error so callers can fall back gracefully.
 */
export async function playWavBuffer(wavBuf: Buffer): Promise<void> {
	const tmpFile = path.join(os.tmpdir(), `nexusai-tts-${Date.now()}.wav`)
	try {
		await fs.promises.writeFile(tmpFile, wavBuf)
		await _playFile(tmpFile)
	} catch (err) {
		Logger.warn("[HostAudioPlayer] Playback failed:", err)
		throw err
	} finally {
		fs.promises.unlink(tmpFile).catch(() => {})
	}
}

function _playFile(filePath: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const p = process.platform

		if (p === "win32") {
			// PowerShell SoundPlayer: blocks until playback complete, no extra deps
			const escaped = filePath.replace(/'/g, "''")
			execFile(
				"powershell",
				["-NoProfile", "-NonInteractive", "-Command", `(New-Object System.Media.SoundPlayer '${escaped}').PlaySync()`],
				(err) => (err ? reject(err) : resolve()),
			)
		} else if (p === "darwin") {
			execFile("afplay", [filePath], (err) => (err ? reject(err) : resolve()))
		} else {
			// Linux: try aplay (ALSA) or paplay (PulseAudio)
			execFile("aplay", [filePath], (err) => {
				if (!err) return resolve()
				execFile("paplay", [filePath], (err2) => (err2 ? reject(err2) : resolve()))
			})
		}
	})
}
