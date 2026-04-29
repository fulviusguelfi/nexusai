/**
 * HostAudioPlayer — plays WAV audio on the extension host (Node.js) side.
 *
 * VS Code webview autoplay policy blocks HTMLAudioElement.play() even for muted
 * elements, so audio playback must happen here in the extension host process.
 *
 * Strategy per platform:
 *   Windows  → PowerShell + winmm MCI (mciSendString) → fallback SoundPlayer
 *   macOS    → afplay (built-in)
 *   Linux    → aplay (ALSA), fallback to paplay (PulseAudio)
 */
import { execFile } from "child_process"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import { Logger } from "@/shared/services/Logger"

function detectAudioFormat(buf: Buffer): "wav" | "mp3" | "unknown" {
	if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WAVE") {
		return "wav"
	}
	if (buf.length >= 3 && buf.toString("ascii", 0, 3) === "ID3") {
		return "mp3"
	}
	if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) {
		return "mp3"
	}
	return "unknown"
}

/**
 * Writes `wavBuf` to a temp file, plays it synchronously via the OS audio
 * stack, then deletes the temp file.  Resolves when playback finishes.
 * Rejects (non-fatally) on error so callers can fall back gracefully.
 */
export async function playWavBuffer(wavBuf: Buffer, outputDeviceId?: string): Promise<void> {
	const format = detectAudioFormat(wavBuf)
	const fileExt = format === "mp3" ? "mp3" : "wav"
	const tmpFile = path.join(os.tmpdir(), `nexusai-tts-${Date.now()}.${fileExt}`)
	try {
		await fs.promises.writeFile(tmpFile, wavBuf)
		Logger.debug(
			`[HostAudioPlayer] Audio header: ${wavBuf.slice(0, 4).toString("ascii")} format=${format} size=${wavBuf.length}`,
		)
		await _playFile(tmpFile, outputDeviceId)
	} catch (err) {
		Logger.warn("[HostAudioPlayer] Playback failed:", err)
		throw err
	} finally {
		fs.promises.unlink(tmpFile).catch(() => {})
	}
}

function _playFile(filePath: string, outputDeviceId?: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const p = process.platform

		if (p === "win32") {
			_playWin32(filePath, outputDeviceId, resolve, reject)
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

/**
 * Windows playback via winmm MCI API (mciSendString).
 * MCI supports any standard PCM sample rate (8 / 16 / 22.05 / 24 / 44.1 / 48 kHz),
 * unlike System.Media.SoundPlayer which can fail on non-standard rates.
 */
export function buildWin32MciScript(
	filePath: string,
	outputDeviceId?: string,
	mciType: "waveaudio" | "mpegvideo" = "waveaudio",
): string {
	// In PowerShell single-quoted strings, backslashes are literal — no escaping needed.
	// Only single quotes need doubling.
	const escaped = filePath.replace(/'/g, "''")
	const escapedOutput = outputDeviceId?.replace(/'/g, "''")
	const setAudioOutputCmd = escapedOutput
		? [
				`$setRc = [Win32.MCI]::mciSendString("setaudio snd output to \`"${escapedOutput}\`"", [IntPtr]::Zero, 0, [IntPtr]::Zero)`,
				`if ($setRc -ne 0) { throw "MCI setaudio failed rc=$setRc device=${escapedOutput}" }`,
			].join("; ")
		: "$null = $null"

	// MCI approach: open waveaudio device → play wait → close
	// "play snd wait" blocks until playback completes — equivalent to PlaySync()
	return [
		`Add-Type -MemberDefinition '[DllImport("winmm.dll",CharSet=CharSet.Auto)] public static extern int mciSendString(string cmd,IntPtr ret,int retLen,IntPtr hwnd);' -Name MCI -Namespace Win32 -ErrorAction SilentlyContinue`,
		`$f = '${escaped}'`,
		`$openRc = [Win32.MCI]::mciSendString("open \`"$f\`" type ${mciType} alias snd", [IntPtr]::Zero, 0, [IntPtr]::Zero)`,
		`if ($openRc -ne 0) { throw "MCI open failed rc=$openRc" }`,
		setAudioOutputCmd,
		`$playRc = [Win32.MCI]::mciSendString("play snd wait", [IntPtr]::Zero, 0, [IntPtr]::Zero)`,
		`[void][Win32.MCI]::mciSendString("close snd", [IntPtr]::Zero, 0, [IntPtr]::Zero)`,
		`if ($playRc -ne 0) { throw "MCI play failed rc=$playRc" }`,
	].join("; ")
}

function _playWin32(
	filePath: string,
	outputDeviceId: string | undefined,
	resolve: () => void,
	reject: (err: Error) => void,
): void {
	const mciType: "waveaudio" | "mpegvideo" = filePath.toLowerCase().endsWith(".mp3") ? "mpegvideo" : "waveaudio"
	const mciScript = buildWin32MciScript(filePath, outputDeviceId, mciType)

	execFile(
		"powershell",
		["-NoProfile", "-NonInteractive", "-Command", mciScript],
		{ timeout: 60000 },
		(err, _stdout, stderr) => {
			if (!err) return resolve()
			// Log stderr so we can diagnose future issues
			if (stderr) Logger.warn("[HostAudioPlayer] PowerShell stderr:", stderr.trim())
			if (outputDeviceId) {
				Logger.warn("[HostAudioPlayer] Selected output device playback failed; not falling back to default device:", err)
				return reject(err)
			}
			Logger.warn("[HostAudioPlayer] MCI playback failed, trying SoundPlayer fallback:", err)
			_playWin32SoundPlayer(filePath, resolve, reject)
		},
	)
}

/** Fallback: System.Media.SoundPlayer (works for PCM 8/11/22/44 kHz) */
function _playWin32SoundPlayer(filePath: string, resolve: () => void, reject: (err: Error) => void): void {
	const escaped = filePath.replace(/'/g, "''")
	execFile(
		"powershell",
		["-NoProfile", "-NonInteractive", "-Command", `(New-Object System.Media.SoundPlayer '${escaped}').PlaySync()`],
		{ timeout: 60000 },
		(err, _stdout, stderr) => {
			if (!err) return resolve()
			if (stderr) Logger.warn("[HostAudioPlayer] SoundPlayer stderr:", stderr.trim())
			reject(err)
		},
	)
}
