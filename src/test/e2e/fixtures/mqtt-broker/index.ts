import * as net from "node:net"

/**
 * Minimal MQTT 3.1.1 broker for E2E testing.
 * Handles CONNECT → CONNACK, PUBLISH QoS 0/1 → PUBACK, SUBSCRIBE → SUBACK,
 * PINGREQ → PINGRESP, DISCONNECT → close.
 * Does NOT implement topic routing, message persistence, or auth.
 */
export class MockMqttBroker {
	private server: net.Server | null = null
	/** Messages published to the broker during the test */
	public readonly publishedMessages: Array<{ topic: string; payload: string }> = []

	async start(port = 1884): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.server = net.createServer((socket) => {
				let buf = Buffer.alloc(0)

				socket.on("data", (chunk: Buffer) => {
					buf = Buffer.concat([buf, chunk])

					while (buf.length >= 2) {
						// ── Decode variable-length remaining-length field ──────────
						let multiplier = 1
						let remainingLen = 0
						let idx = 1 // byte index into buf

						let digit: number
						do {
							if (idx >= buf.length) return // incomplete — wait for more data
							digit = buf[idx++]
							remainingLen += (digit & 0x7f) * multiplier
							multiplier *= 128
							if (multiplier > 128 * 128 * 128) return // malformed
						} while ((digit & 0x80) !== 0)

						const packetLen = idx + remainingLen
						if (buf.length < packetLen) return // incomplete — wait for more data

						const pkt = buf.subarray(0, packetLen)
						buf = buf.subarray(packetLen)

						const pktType = (pkt[0] >> 4) & 0x0f

						switch (pktType) {
							case 1: {
								// CONNECT → CONNACK (session_present=0, return_code=0 = accepted)
								socket.write(Buffer.from([0x20, 0x02, 0x00, 0x00]))
								break
							}

							case 3: {
								// PUBLISH
								const qos = (pkt[0] >> 1) & 0x03
								let offset = idx // start of variable header
								const topicLen = (pkt[offset] << 8) | pkt[offset + 1]
								offset += 2
								const topic = pkt.subarray(offset, offset + topicLen).toString()
								offset += topicLen
								if (qos > 0) {
									const pktIdHi = pkt[offset]
									const pktIdLo = pkt[offset + 1]
									offset += 2
									if (qos === 1) {
										// PUBACK
										socket.write(Buffer.from([0x40, 0x02, pktIdHi, pktIdLo]))
									}
								}
								const payload = pkt.subarray(offset).toString()
								this.publishedMessages.push({ topic, payload })
								break
							}

							case 8: {
								// SUBSCRIBE → SUBACK (grant QoS 0 for all subscriptions)
								const pktIdHi = pkt[idx]
								const pktIdLo = pkt[idx + 1]
								// SUBACK: type(0x90) + remaining_len(3) + pktId(2) + returnCode(1)
								socket.write(Buffer.from([0x90, 0x03, pktIdHi, pktIdLo, 0x00]))
								break
							}

							case 12: {
								// PINGREQ → PINGRESP
								socket.write(Buffer.from([0xd0, 0x00]))
								break
							}

							case 14: {
								// DISCONNECT
								socket.end()
								break
							}
							// other packet types ignored
						}
					}
				})

				socket.on("error", () => {
					/* ignore client errors */
				})
			})

			this.server.listen(port, "127.0.0.1", () => resolve())
			this.server.once("error", reject)
		})
	}

	async stop(): Promise<void> {
		return new Promise<void>((resolve) => {
			if (!this.server) {
				resolve()
				return
			}
			this.server.close(() => {
				this.server = null
				resolve()
			})
		})
	}
}
