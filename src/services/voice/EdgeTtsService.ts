/**
 * EdgeTtsService
 *
 * Synthesizes speech using the Microsoft Edge Read Aloud service (same voices
 * as the Edge browser's built-in TTS). No API key required — uses the same
 * public token the Edge browser uses.
 *
 * Transport: MP3 frames from Edge, normalized to WAV PCM before returning.
 *
 * Protocol reference: https://github.com/rany2/edge-tts (MIT)
 */

import { Logger } from "@shared/services/Logger"
import { execFile } from "child_process"
import { createHash, randomUUID } from "crypto"
import * as fs from "fs"
import * as https from "https"
import * as os from "os"
import * as path from "path"
import * as tls from "tls"

const AUDIO_HEADER_SEPARATOR = Buffer.from("Path:audio\r\n\r\n", "utf8")

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
const VOICES_LIST_URL = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}`
const WS_HOST = "speech.platform.bing.com"
const WS_PATH = `/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`
const CHROMIUM_VERSION = "143.0.3650.75"
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_VERSION}`
export const EDGE_TTS_OUTPUT_FORMAT = "audio-24khz-96kbitrate-mono-mp3"

function isWavBuffer(buf: Buffer): boolean {
	return buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WAVE"
}

function getFfmpegPath(): string {
	try {
		const ffmpegModule = require("@ffmpeg-installer/ffmpeg")
		if (ffmpegModule?.path) return ffmpegModule.path as string
	} catch {
		// fallback below
	}
	return process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
}

async function convertMp3ToWav(mp3Buf: Buffer): Promise<Buffer> {
	const ts = Date.now()
	const inputPath = path.join(os.tmpdir(), `nexusai-edge-tts-${ts}.mp3`)
	const outputPath = path.join(os.tmpdir(), `nexusai-edge-tts-${ts}.wav`)

	await fs.promises.writeFile(inputPath, mp3Buf)

	try {
		await new Promise<void>((resolve, reject) => {
			execFile(
				getFfmpegPath(),
				[
					"-y",
					"-hide_banner",
					"-loglevel",
					"error",
					"-i",
					inputPath,
					"-f",
					"wav",
					"-acodec",
					"pcm_s16le",
					"-ar",
					"24000",
					"-ac",
					"1",
					outputPath,
				],
				{ timeout: 15000 },
				(err) => (err ? reject(err) : resolve()),
			)
		})

		return await fs.promises.readFile(outputPath)
	} finally {
		await Promise.allSettled([fs.promises.unlink(inputPath), fs.promises.unlink(outputPath)])
	}
}

export function extractEdgeAudioChunk(payload: Buffer): Buffer {
	// Newer Edge binary frames include an internal text header before audio bytes.
	// Example from logs: payload starts with 0x00 0x00 then "X-RequestId...".
	const pathIdx = payload.indexOf(Buffer.from("Path:audio", "utf8"))
	if (pathIdx !== -1) {
		const headerEnd = payload.indexOf(Buffer.from("\r\n\r\n", "utf8"), pathIdx)
		if (headerEnd !== -1 && headerEnd + 4 <= payload.length) {
			return payload.slice(headerEnd + 4)
		}
	}

	// Legacy fallback expected Path:audio\r\n\r\n immediately before bytes.
	const sepIdx = payload.indexOf(AUDIO_HEADER_SEPARATOR)
	if (sepIdx !== -1) {
		return payload.slice(sepIdx + AUDIO_HEADER_SEPARATOR.length)
	}

	// If no known internal header is present, assume the payload is pure audio.
	return payload
}

/**
 * Generate the Sec-MS-GEC header required by Microsoft Edge TTS (added ~2024).
 * Algorithm: SHA256( "{winFileTime_rounded_to_5min}|{token}" ) → uppercase hex.
 * Without this header the server accepts the WS upgrade but then resets the
 * connection (ECONNRESET) when the synthesis request arrives.
 */
function getSecMsGec(): string {
	// Windows FILETIME = 100-ns intervals since 1601-01-01
	// Offset from Unix epoch (1970-01-01) to Windows epoch (1601-01-01): 116444736000000000 × 100ns
	const WIN_EPOCH_OFFSET = 116444736000000000n
	const winTime = BigInt(Date.now()) * 10000n + WIN_EPOCH_OFFSET
	// Round down to nearest 5 minutes (5 × 60 × 10^7 = 3 000 000 000 units)
	const rounded = (winTime / 3000000000n) * 3000000000n
	// NOTE: no separator between ticks and token (Python reference: f"{ticks:.0f}{token}")
	const hashInput = `${rounded}${TRUSTED_CLIENT_TOKEN}`
	return createHash("sha256").update(hashInput, "ascii").digest("hex").toUpperCase()
}

export interface EdgeVoice {
	/** e.g. "pt-BR-FranciscaNeural" */
	ShortName: string
	/** e.g. "Portuguese (Brazil)" */
	Locale: string
	/** e.g. "Female" */
	Gender: string
	/** e.g. "pt-BR" */
	LocaleName?: string
	/** Friendly display name */
	FriendlyName?: string
}

let cachedVoices: EdgeVoice[] | null = null

/**
 * Fetch and cache the full Edge TTS voice list.
 */
export async function getEdgeVoiceList(): Promise<EdgeVoice[]> {
	if (cachedVoices) return cachedVoices

	const data = await fetchJson(VOICES_LIST_URL)
	// The API returns an array of voice objects; normalize to our minimal shape.
	cachedVoices = (data as EdgeVoice[]).filter((v) => v.ShortName && v.Locale)
	Logger.log(`[EdgeTTS] Loaded ${cachedVoices.length} voices`)
	return cachedVoices
}

export function buildEdgeTtsSpeechConfigMessage(timestamp: string): string {
	return (
		`X-Timestamp:${timestamp}\r\n` +
		`Content-Type:application/json; charset=utf-8\r\n` +
		`Path:speech.config\r\n\r\n` +
		JSON.stringify({
			context: {
				synthesis: {
					audio: {
						metadataoptions: { sentenceBoundaryEnabled: "false", wordBoundaryEnabled: "false" },
						outputFormat: EDGE_TTS_OUTPUT_FORMAT,
					},
				},
			},
		})
	)
}

/**
 * Synthesize text to a WAV buffer using the Edge TTS service.
 *
 * @param text    Text to speak (plain text, NOT SSML)
 * @param voice   Voice short name, e.g. "pt-BR-FranciscaNeural"
 * @returns Buffer containing riff-24khz-16bit-mono-pcm WAV data
 */
export async function synthesizeEdgeTts(text: string, voice: string): Promise<Buffer> {
	return new Promise<Buffer>((resolve, reject) => {
		const requestId = randomUUID().replace(/-/g, "").toUpperCase()
		const timestamp = new Date().toISOString()

		// Build SSML
		const ssml =
			`<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
			`<voice name='${voice}'>` +
			`<prosody rate='+0%' pitch='+0Hz'>${escapeXml(text)}</prosody>` +
			`</voice></speak>`

		// Speech config message
		const configMsg = buildEdgeTtsSpeechConfigMessage(timestamp)

		// SSML synthesis request message
		const ssmlMsg =
			`X-RequestId:${requestId}\r\n` +
			`Content-Type:application/ssml+xml\r\n` +
			`X-Timestamp:${timestamp}\r\n` +
			`Path:ssml\r\n\r\n` +
			ssml

		const audioChunks: Buffer[] = []
		const wsKey = Buffer.from(randomUUID()).toString("base64")

		// Random MUID cookie required by the API
		const muid = randomUUID().replace(/-/g, "").toUpperCase()
		const connectionId = randomUUID().replace(/-/g, "")
		const chrMajor = CHROMIUM_VERSION.split(".")[0]

		// Sec-MS-GEC and ConnectionId go in the query string (not headers), per Python reference:
		// session.ws_connect(f"{WSS_URL}&ConnectionId={id}&Sec-MS-GEC={token}&Sec-MS-GEC-Version={ver}")
		const wsPath =
			`${WS_PATH}&ConnectionId=${connectionId}` + `&Sec-MS-GEC=${getSecMsGec()}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`

		// Build HTTP upgrade request (raw string sent over TLS socket)
		const upgradeReq = [
			`GET ${wsPath} HTTP/1.1`,
			`Host: ${WS_HOST}`,
			`Upgrade: websocket`,
			`Connection: Upgrade`,
			`Sec-WebSocket-Key: ${wsKey}`,
			`Sec-WebSocket-Version: 13`,
			`Pragma: no-cache`,
			`Cache-Control: no-cache`,
			`Origin: chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold`,
			`User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrMajor}.0.0.0 Safari/537.36 Edg/${chrMajor}.0.0.0`,
			`Accept-Encoding: gzip, deflate, br, zstd`,
			`Accept-Language: en-US,en;q=0.9`,
			`Cookie: muid=${muid};`,
			`\r\n`,
		].join("\r\n")

		const timeout = setTimeout(() => {
			Logger.error(`[EdgeTTS] Synthesis timed out after 30s`)
			socket.destroy()
			reject(new Error("Edge TTS synthesis timed out"))
		}, 30000)

		// Use tls.connect() for direct control over the raw TLS socket.
		// https.request + upgrade event is unreliable in Electron/VS Code environments.
		const socket = tls.connect({ host: WS_HOST, port: 443, servername: WS_HOST }, () => {
			Logger.log(`[EdgeTTS] TLS connected, sending WS upgrade...`)
			socket.write(upgradeReq)
		})

		let upgraded = false
		let httpBuf = ""
		let wsBuf = Buffer.alloc(0)

		/** Send a masked text WebSocket frame (clients must mask per RFC 6455). */
		const sendFrame = (data: string) => {
			const payload = Buffer.from(data, "utf8")
			const len = payload.length
			const maskKey = Buffer.allocUnsafe(4)
			maskKey.writeUInt32BE(Math.floor(Math.random() * 0xffffffff) + 1, 0)
			const masked = Buffer.allocUnsafe(len)
			for (let i = 0; i < len; i++) masked[i] = payload[i] ^ maskKey[i % 4]
			if (len < 126) {
				const frame = Buffer.allocUnsafe(6 + len)
				frame[0] = 0x81
				frame[1] = 0x80 | len
				maskKey.copy(frame, 2)
				masked.copy(frame, 6)
				socket.write(frame)
			} else if (len < 65536) {
				const frame = Buffer.allocUnsafe(8 + len)
				frame[0] = 0x81
				frame[1] = 0x80 | 126
				frame.writeUInt16BE(len, 2)
				maskKey.copy(frame, 4)
				masked.copy(frame, 8)
				socket.write(frame)
			} else {
				const frame = Buffer.allocUnsafe(14 + len)
				frame[0] = 0x81
				frame[1] = 0x80 | 127
				frame.writeBigUInt64BE(BigInt(len), 2)
				maskKey.copy(frame, 10)
				masked.copy(frame, 14)
				socket.write(frame)
			}
		}

		const parseFrames = () => {
			while (wsBuf.length >= 2) {
				const opcode = wsBuf[0] & 0x0f
				const isMasked = (wsBuf[1] & 0x80) !== 0
				let payloadLen = wsBuf[1] & 0x7f
				let offset = 2

				if (payloadLen === 126) {
					if (wsBuf.length < 4) return
					payloadLen = wsBuf.readUInt16BE(2)
					offset = 4
				} else if (payloadLen === 127) {
					if (wsBuf.length < 10) return
					payloadLen = Number(wsBuf.readBigUInt64BE(2))
					offset = 10
				}

				if (isMasked) offset += 4
				if (wsBuf.length < offset + payloadLen) return

				const payload = wsBuf.slice(offset, offset + payloadLen)
				wsBuf = wsBuf.slice(offset + payloadLen)

				if (opcode === 0x8) {
					// Close frame — log code+reason for diagnostics
					const closeCode = payload.length >= 2 ? payload.readUInt16BE(0) : 0
					const closeReason = payload.length > 2 ? payload.slice(2).toString("utf8") : ""
					Logger.log(`[EdgeTTS] WS close frame: code=${closeCode} reason="${closeReason}"`)
					socket.destroy()
					return
				}

				if (opcode === 0x1) {
					const text = payload.toString("utf8")
					const pathMatch = text.match(/Path:([^\r\n]+)/)
					const pathVal = pathMatch ? pathMatch[1] : "unknown"
					if (pathVal === "response" || pathVal === "turn.end") {
						Logger.log(`[EdgeTTS] Text frame Path:${pathVal} → ${text.replace(/\r\n/g, " | ")}`)
					} else {
						Logger.log(`[EdgeTTS] Text frame Path:${pathVal} (${text.length}B)`)
					}
					if (text.includes("Path:turn.end")) {
						clearTimeout(timeout)
						socket.destroy()
						if (audioChunks.length === 0) {
							reject(new Error("Edge TTS returned no audio data"))
							return
						}
						const rawAudio = Buffer.concat(audioChunks)
						if (isWavBuffer(rawAudio)) {
							resolve(rawAudio)
							return
						}

						void convertMp3ToWav(rawAudio)
							.then((wav) => resolve(wav))
							.catch((convErr) => {
								Logger.error("[EdgeTTS] MP3->WAV conversion failed:", convErr)
								reject(new Error("Edge TTS audio conversion failed"))
							})
						return
					}
				} else if (opcode === 0x2) {
					const audio = extractEdgeAudioChunk(payload)
					if (audio.length > 0) {
						if (audioChunks.length === 0) Logger.log(`[EdgeTTS] ✅ First audio binary frame (${audio.length} bytes)`)
						audioChunks.push(audio)
					}
				}
			}
		}

		socket.on("data", (chunk: Buffer) => {
			if (!upgraded) {
				// Accumulate HTTP response until we see "\r\n\r\n"
				httpBuf += chunk.toString("binary")
				const headerEnd = httpBuf.indexOf("\r\n\r\n")
				if (headerEnd === -1) return

				const headers = httpBuf.slice(0, headerEnd)
				Logger.log(`[EdgeTTS] HTTP response: ${headers.split("\r\n")[0]}`)
				if (!headers.includes("101")) {
					clearTimeout(timeout)
					socket.destroy()
					reject(new Error(`Edge TTS WS upgrade failed: ${headers.split("\r\n")[0]}`))
					return
				}

				upgraded = true
				// Any bytes after the header end are the start of WS data
				const remainder = httpBuf.slice(headerEnd + 4)
				if (remainder.length > 0) {
					wsBuf = Buffer.concat([wsBuf, Buffer.from(remainder, "binary")])
					parseFrames()
				}

				// Now send the WS frames
				Logger.log(`[EdgeTTS] WS upgraded, sending config+SSML...`)
				sendFrame(configMsg)
				sendFrame(ssmlMsg)
				return
			}

			wsBuf = Buffer.concat([wsBuf, chunk])
			parseFrames()
		})

		socket.on("error", (err) => {
			clearTimeout(timeout)
			Logger.error(`[EdgeTTS] socket error: ${err.message}`)
			reject(err)
		})
		socket.on("close", () => {
			clearTimeout(timeout)
			if (audioChunks.length > 0) {
				const rawAudio = Buffer.concat(audioChunks)
				if (isWavBuffer(rawAudio)) {
					resolve(rawAudio)
					return
				}
				void convertMp3ToWav(rawAudio)
					.then((wav) => resolve(wav))
					.catch((convErr) => {
						Logger.error("[EdgeTTS] MP3->WAV conversion failed on socket close:", convErr)
						reject(new Error("Edge TTS audio conversion failed"))
					})
			} else {
				const err = new Error("Edge TTS socket closed without audio")
				Logger.error(`[EdgeTTS] ${err.message}`)
				reject(err)
			}
		})
	})
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchJson(url: string): Promise<unknown> {
	return new Promise((resolve, reject) => {
		https
			.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
				const chunks: Buffer[] = []
				res.on("data", (c: Buffer) => chunks.push(c))
				res.on("end", () => {
					try {
						resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")))
					} catch (e) {
						reject(e)
					}
				})
				res.on("error", reject)
			})
			.on("error", reject)
	})
}

function escapeXml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
}
