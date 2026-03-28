/**
 * Windows Audio Capture using FFmpeg
 * Captures raw audio from the default microphone at 16kHz, 16-bit PCM
 * No VS Code / Electron dependency - works in CLI and standalone
 */

import { ChildProcess, execFile, spawn } from "child_process"
import { Logger } from "@/shared/services/Logger"

// Get FFmpeg path from npm package or use system install
let ffmpegPath: string
try {
	ffmpegPath = require("@ffmpeg-installer/ffmpeg").path
} catch {
	ffmpegPath = "ffmpeg"
}

export interface AudioCaptureOptions {
	duration?: number // Duration in seconds (undefined = stream until stopped)
	sampleRate?: number // Default 16000 Hz
	channels?: number // Default 1 (mono)
	deviceId?: string // Windows audio device name (default: first available)
	onChunk?: (chunk: Buffer) => void // Called for each audio chunk
	onError?: (error: Error) => void
}

/**
 * Enumerate available audio devices on Windows (for debugging)
 * Parses FFmpeg dshow output to extract AUDIO devices only
 */
export async function enumerateWindowsAudioDevices(): Promise<string[]> {
	return new Promise((resolve) => {
		const proc = spawn(ffmpegPath, ["-f", "dshow", "-list_devices", "true", "-i", "dummy"], {
			stdio: ["ignore", "pipe", "pipe"],
		})

		let output = ""
		const devices: string[] = []

		proc.stderr?.on("data", (data: Buffer) => {
			output += data.toString()
		})

		proc.on("close", () => {
			Logger.log("[WindowsAudioCapture] FFmpeg dshow output:")
			Logger.log(output)

			const lines = output.split("\n")
			Logger.log(`[WindowsAudioCapture] Total lines: ${lines.length}`)

			// FFmpeg dshow output format (with [in#0 @ ...] prefix):
			//   [in#0 @ 0000014f0bf487c0] "Device Name" (audio)
			//   [in#0 @ 0000014f0bf487c0]   Alternative name "@device_cm_..."
			// Extract all lines matching: "Device Name" (audio)

			for (const line of lines) {
				if (line.includes("(audio)")) {
					Logger.log(`[WindowsAudioCapture] Found audio line: "${line}"`)
					// Match quoted string followed by (audio), handling the [in#0 @ ...] prefix
					// Regex: .*"([^"]+)"\s*\(audio\)
					const match = line.match(/"([^"]+)"\s*\(audio\)/)
					if (match && match[1]) {
						const deviceId = `audio=${match[1]}`
						Logger.log(`[WindowsAudioCapture] Parsed device: ${deviceId}`)
						devices.push(deviceId)
					}
				}
			}

			Logger.log(`[WindowsAudioCapture] Found ${devices.length} devices total`)
			resolve(devices)
		})
	})
}

// PowerShell inline C# that calls MMDeviceAPI (WASAPI) to list active render endpoints.
// Runs entirely in-process via powershell.exe -Command — no external script file needed.
const PS_RENDER_DEVICES = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;
public class WasapiRender {
    const int CLSCTX_INPROC_SERVER = 1;
    static Guid CLSID = new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E");
    static Guid IID  = new Guid("A95664D2-9614-4F35-A746-DE8DB63617E6");
    [DllImport("ole32.dll")] static extern int CoCreateInstance(ref Guid c,IntPtr i,int x,ref Guid u,out IntPtr p);
    [ComImport,Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceEnumerator { int EnumAudioEndpoints(int f,uint s,out IntPtr pp); }
    [ComImport,Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceCollection { int GetCount(out uint n); int Item(uint i,out IntPtr pp); }
    [ComImport,Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice { int Activate(ref Guid id,uint c,IntPtr p,out IntPtr pp); int OpenPropertyStore(uint a,out IntPtr pp); int GetId(out IntPtr pp); int GetState(out uint s); }
    [ComImport,Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPropertyStore { int GetCount(out uint n); int GetAt(uint i,out IntPtr k); int GetValue(ref PK k,out PV v); int SetValue(ref PK k,ref PV v); int Commit(); }
    [StructLayout(LayoutKind.Sequential)] public struct PK { public Guid f; public uint p; }
    [StructLayout(LayoutKind.Sequential)] public struct PV { public ushort vt,r1,r2,r3; public IntPtr p; public uint p2; }
    public static List<string> List() {
        var r=new List<string>();
        IntPtr ep; CoCreateInstance(ref CLSID,IntPtr.Zero,CLSCTX_INPROC_SERVER,ref IID,out ep);
        var en=(IMMDeviceEnumerator)Marshal.GetObjectForIUnknown(ep);
        IntPtr cp; en.EnumAudioEndpoints(0,1,out cp);
        var col=(IMMDeviceCollection)Marshal.GetObjectForIUnknown(cp);
        uint n; col.GetCount(out n);
        for(uint i=0;i<n;i++){
            IntPtr dp; col.Item(i,out dp);
            var dev=(IMMDevice)Marshal.GetObjectForIUnknown(dp);
            IntPtr sp; dev.OpenPropertyStore(0,out sp);
            var st=(IPropertyStore)Marshal.GetObjectForIUnknown(sp);
            var k=new PK{f=new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),p=14};
            PV v; st.GetValue(ref k,out v);
            r.Add(Marshal.PtrToStringUni(v.p));
        }
        return r;
    }
}
'@
[WasapiRender]::List()
`

/**
 * Enumerate Windows audio render (output/speaker) devices via WASAPI.
 * Uses PowerShell + inline C# — no extra dependencies, no FFmpeg.
 */
export async function enumerateWindowsRenderDevices(): Promise<string[]> {
	return new Promise((resolve) => {
		execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", PS_RENDER_DEVICES], (err, stdout, stderr) => {
			if (err) {
				Logger.warn("[WindowsAudioCapture] PowerShell render enumeration failed:", err.message)
				resolve([])
				return
			}
			if (stderr) {
				Logger.log("[WindowsAudioCapture] PowerShell stderr:", stderr.trim())
			}
			const devices = stdout
				.split(/\r?\n/)
				.map((l) => l.trim())
				.filter(Boolean)
			Logger.log(`[WindowsAudioCapture] Render devices: ${devices.join(", ")}`)
			resolve(devices)
		})
	})
}

export class WindowsAudioCapture {
	private ffmpegProcess: ChildProcess | null = null
	private audioBuffer: Buffer[] = []
	private isRecording = false
	private recordingStartChunkIndex = 0 // Chunks before this index are warmup (excluded from output)
	private preRollData: Buffer[] = [] // Pre-roll chunks prepended when speech is detected

	/**
	 * Start capturing audio from microphone using FFmpeg
	 * Returns a Promise that resolves when recording completes (if duration set)
	 * or rejects on error
	 */
	async startCapture(options: AudioCaptureOptions = {}): Promise<void> {
		return new Promise(async (resolve, reject) => {
			try {
				const sampleRate = options.sampleRate || 16000
				const channels = options.channels || 1
				const duration = options.duration

				// Get device name: use provided option, or enumerate and use first available
				let deviceName = options.deviceId
				if (!deviceName) {
					// Auto-detect first available audio device on Windows
					const devices = await enumerateWindowsAudioDevices()
					if (devices.length > 0) {
						deviceName = devices[0]
						Logger.log("[WindowsAudioCapture] Auto-detected device:", deviceName)
					} else {
						throw new Error("No audio devices found")
					}
				}

				// Remove quotes if present
				deviceName = deviceName.replace(/^"|"$/g, "")

				// Ensure it has 'audio=' prefix for FFmpeg dshow
				if (!deviceName.startsWith("audio=")) {
					deviceName = `audio=${deviceName}`
				}

				// Don't wrap in quotes - spawn() passes array elements directly as args, not through shell
				const audioDeviceArg = deviceName

				Logger.log("[WindowsAudioCapture] Using device argument:", audioDeviceArg)

				const ffmpegArgs = [
					"-f",
					"dshow",
					"-i",
					audioDeviceArg,
					"-acodec",
					"pcm_s16le",
					"-ar",
					sampleRate.toString(),
					"-ac",
					channels.toString(),
					"-f",
					"s16le",
				]

				if (duration) {
					ffmpegArgs.push("-t", duration.toString())
				}

				ffmpegArgs.push("pipe:1")

				// Log the exact FFmpeg command for debugging
				Logger.log("[FFmpeg] Command:", ffmpegPath, ffmpegArgs.join(" "))

				this.ffmpegProcess = spawn(ffmpegPath, ffmpegArgs, {
					stdio: ["ignore", "pipe", "pipe"],
				})

				this.isRecording = true
				this.audioBuffer = []

				// Handle audio data
				this.ffmpegProcess.stdout?.on("data", (chunk: Buffer) => {
					this.audioBuffer.push(chunk)
					options.onChunk?.(chunk)
				})

				// Capture FFmpeg stderr for debugging
				this.ffmpegProcess.stderr?.on("data", (data: Buffer) => {
					const msg = data.toString()
					// Log FFmpeg errors and important messages
					if (msg.includes("error") || msg.includes("Error") || msg.includes("Cannot")) {
						Logger.warn("[WindowsAudioCapture] FFmpeg stderr:", msg.trim())
					}
				})

				// Handle process exit
				this.ffmpegProcess.on("exit", (code: number | null) => {
					this.isRecording = false
					Logger.log("[WindowsAudioCapture] FFmpeg exited with code:", code)
					// Accept normal exit or signals (0, 255, -2, -5, 130)
					// -5 often means SIGTERM on Windows in different encoding
					if (code === 0 || code === 255 || code === -2 || code === -5 || code === 130) {
						resolve()
					} else if (code && code < -10) {
						// Likely a signal code converted to negative
						resolve()
					} else if (this.audioBuffer.length > 0) {
						// If we got audio data, consider it success despite exit code
						const totalBytes = this.audioBuffer.reduce((sum, b) => sum + b.length, 0)
						Logger.warn(
							`[FFmpeg] Exit code ${code}, but captured ${this.audioBuffer.length} chunks (${totalBytes} bytes total)`,
						)
						resolve()
					} else {
						reject(new Error(`FFmpeg exited with code ${code}`))
					}
				})

				this.ffmpegProcess.on("error", (err: Error) => {
					this.isRecording = false
					options.onError?.(err)
					reject(err)
				})
			} catch (error) {
				reject(new Error(`Failed to start FFmpeg: ${error instanceof Error ? error.message : String(error)}`))
			}
		})
	}

	/**
	 * Mark where real recording starts (after warmup chunks are discarded).
	 * Chunks before this index will be excluded from stopCapture() output.
	 */
	markRecordingStart(): void {
		this.recordingStartChunkIndex = this.audioBuffer.length
		Logger.log(`[WindowsAudioCapture] Recording start marked at chunk index ${this.recordingStartChunkIndex}`)
	}

	/**
	 * Prepend pre-roll audio (captured just before speech detection) to the recording.
	 * Called when speech is first detected so the leading syllables aren't lost.
	 */
	prependToBuffer(data: Buffer): void {
		this.preRollData.push(data)
		Logger.log(`[WindowsAudioCapture] Pre-roll stored: ${data.length} bytes`)
	}

	/**
	 * Stop recording and return captured audio.
	 * Output = preRollData + audioBuffer[recordingStartChunkIndex:]
	 * (warmup chunks before recordingStartChunkIndex are excluded)
	 */
	stopCapture(): Buffer {
		if (this.ffmpegProcess) {
			this.ffmpegProcess.kill()
			this.ffmpegProcess = null
		}
		this.isRecording = false

		const recordingChunks = this.audioBuffer.slice(this.recordingStartChunkIndex)
		const allChunks = [...this.preRollData, ...recordingChunks]
		const totalBytes = allChunks.reduce((sum, b) => sum + b.length, 0)
		Logger.log(
			`[WindowsAudioCapture] stopCapture: preroll=${this.preRollData.length} chunks, recording=${recordingChunks.length} chunks, total=${totalBytes} bytes`,
		)
		return Buffer.concat(allChunks)
	}

	/**
	 * Get current recording status
	 */
	isCapturing(): boolean {
		return this.isRecording
	}

	/**
	 * Convert raw PCM audio (Int16LE) to Float32 array for Web Audio API compatibility
	 * (useful when sharing audio data between CLI and webview)
	 */
	static pcmToFloat32(buffer: Buffer): Float32Array {
		const float32 = new Float32Array(buffer.length / 2)
		for (let i = 0; i < float32.length; i++) {
			const int16 = buffer.readInt16LE(i * 2)
			float32[i] = int16 / 32768 // Normalize to -1..1
		}
		return float32
	}

	/**
	 * Convert Float32 array back to Int16LE PCM buffer
	 * (reverse operation for interoperability)
	 */
	static float32ToPcm(float32: Float32Array): Buffer {
		const buffer = Buffer.alloc(float32.length * 2)
		for (let i = 0; i < float32.length; i++) {
			const clamped = Math.max(-1, Math.min(1, float32[i]))
			const int16 = clamped < 0 ? clamped * 32768 : clamped * 32767
			buffer.writeInt16LE(Math.floor(int16), i * 2)
		}
		return buffer
	}
}
