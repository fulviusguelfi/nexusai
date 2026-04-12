/**
 * EdgeTtsService
 *
 * Synthesizes speech using the Microsoft Edge Read Aloud service (same voices
 * as the Edge browser's built-in TTS). No API key required — uses the same
 * public token the Edge browser uses.
 *
 * Output: raw PCM WAV (riff-24khz-16bit-mono-pcm), ready for RhubarbService.
 *
 * Protocol reference: https://github.com/rany2/edge-tts (MIT)
 */

import { Logger } from "@shared/services/Logger"
import { randomUUID } from "crypto"
import * as https from "https"

const AUDIO_HEADER_SEPARATOR = Buffer.from("Path:audio\r\n\r\n", "utf8")

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
const VOICES_LIST_URL = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}`
const WS_HOST = "speech.platform.bing.com"
const WS_PATH = `/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`

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
			`<prosody rate='0%' pitch='0%'>${escapeXml(text)}</prosody>` +
			`</voice></speak>`

		// Speech config message
		const configMsg =
			`X-Timestamp:${timestamp}\r\n` +
			`Content-Type:application/json; charset=utf-8\r\n` +
			`Path:speech.config\r\n\r\n` +
			JSON.stringify({
				context: {
					synthesis: {
						audio: {
							metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false },
							outputFormat: "riff-24khz-16bit-mono-pcm",
						},
					},
				},
			})

		// SSML synthesis request message
		const ssmlMsg =
			`X-RequestId:${requestId}\r\n` +
			`Content-Type:application/ssml+xml\r\n` +
			`X-Timestamp:${timestamp}\r\n` +
			`Path:ssml\r\n\r\n` +
			ssml

		const audioChunks: Buffer[] = []

		// Manual WebSocket handshake over HTTPS (avoids 'ws' package dependency)
		const key = Buffer.from(randomUUID()).toString("base64")

		const options: https.RequestOptions = {
			hostname: WS_HOST,
			port: 443,
			path: WS_PATH,
			method: "GET",
			headers: {
				Upgrade: "websocket",
				Connection: "Upgrade",
				"Sec-WebSocket-Key": key,
				"Sec-WebSocket-Version": "13",
				Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
			},
		}

		const req = https.request(options)
		req.on("error", reject)
		req.on("upgrade", (res, socket) => {
			if (res.statusCode !== 101) {
				reject(new Error(`Edge TTS WS upgrade failed: ${res.statusCode}`))
				return
			}

			// WebSocket frame parser state
			let buf = Buffer.alloc(0)

			/** Send a masked text WebSocket frame (clients must mask per RFC 6455). */
			const sendFrame = (data: string) => {
				const payload = Buffer.from(data, "utf8")
				const len = payload.length
				// Zero mask is valid per RFC 6455
				if (len < 126) {
					const frame = Buffer.allocUnsafe(6 + len)
					frame[0] = 0x81 // FIN + text opcode
					frame[1] = 0x80 | len
					frame.fill(0, 2, 6) // zero mask
					payload.copy(frame, 6)
					socket.write(frame)
				} else if (len < 65536) {
					const frame = Buffer.allocUnsafe(8 + len)
					frame[0] = 0x81
					frame[1] = 0x80 | 126
					frame.writeUInt16BE(len, 2)
					frame.fill(0, 4, 8) // zero mask
					payload.copy(frame, 8)
					socket.write(frame)
				} else {
					const frame = Buffer.allocUnsafe(14 + len)
					frame[0] = 0x81
					frame[1] = 0x80 | 127
					frame.writeBigUInt64BE(BigInt(len), 2)
					frame.fill(0, 10, 14) // zero mask
					payload.copy(frame, 14)
					socket.write(frame)
				}
			}

			const parseFrames = () => {
				while (buf.length >= 2) {
					const opcode = buf[0] & 0x0f
					const masked = (buf[1] & 0x80) !== 0
					let payloadLen = buf[1] & 0x7f
					let offset = 2

					if (payloadLen === 126) {
						if (buf.length < 4) return
						payloadLen = buf.readUInt16BE(2)
						offset = 4
					} else if (payloadLen === 127) {
						if (buf.length < 10) return
						payloadLen = Number(buf.readBigUInt64BE(2))
						offset = 10
					}

					if (masked) offset += 4
					if (buf.length < offset + payloadLen) return

					const payload = buf.slice(offset, offset + payloadLen)
					buf = buf.slice(offset + payloadLen)

					if (opcode === 0x8) {
						// Close frame
						socket.destroy()
						return
					}

					if (opcode === 0x1) {
						// Text frame — check for turn.end
						const text = payload.toString("utf8")
						if (text.includes("Path:turn.end")) {
							socket.destroy()
							if (audioChunks.length === 0) {
								reject(new Error("Edge TTS returned no audio data"))
								return
							}
							resolve(Buffer.concat(audioChunks))
							return
						}
					} else if (opcode === 0x2) {
						// Binary frame — each frame has its own "Path:audio\r\n\r\n" header
						const sepIdx = payload.indexOf(AUDIO_HEADER_SEPARATOR)
						const audioStart = sepIdx !== -1 ? sepIdx + AUDIO_HEADER_SEPARATOR.length : 0
						const audio = payload.slice(audioStart)
						if (audio.length > 0) audioChunks.push(audio)
					}
				}
			}

			socket.on("data", (chunk: Buffer) => {
				buf = Buffer.concat([buf, chunk])
				parseFrames()
			})

			socket.on("error", reject)
			socket.on("close", () => {
				if (audioChunks.length > 0) {
					resolve(Buffer.concat(audioChunks))
				} else {
					reject(new Error("Edge TTS socket closed without audio"))
				}
			})

			// Send speech config then SSML
			sendFrame(configMsg)
			sendFrame(ssmlMsg)
		})

		req.end()
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
