import * as childProcess from "node:child_process"
import * as dgram from "node:dgram"
import { DeviceIdentificationService } from "@services/iot/DeviceIdentificationService"
import { DeviceRegistry } from "@services/iot/DeviceRegistry"
import { type DeviceProfile, DeviceProtocol, DeviceType } from "@shared/iot/DeviceProfile"
import { Logger } from "@shared/services/Logger"

const DEFAULT_SCAN_TIMEOUT_MS = 8_000

const SSDP_MULTICAST_ADDR = "239.255.255.250"
const SSDP_PORT = 1900
const SSDP_DISCOVER_MSG = Buffer.from(
	'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 3\r\nST: ssdp:all\r\n\r\n',
)

/**
 * Reusable device discovery service.
 * Scans the local network via:
 *   1. mDNS/Bonjour
 *   2. SSDP/UPnP (UDP multicast)
 *   3. ARP table (passive, no packets sent)
 * Safe to call fire-and-forget — errors are swallowed internally.
 */
export class IotDiscoveryService {
	static async scan(timeoutMs = DEFAULT_SCAN_TIMEOUT_MS): Promise<DeviceProfile[]> {
		Logger.debug("[IotDiscoveryService] Starting scan")

		const [mdnsResults, ssdpResults, arpResults] = await Promise.allSettled([
			IotDiscoveryService.scanViaMdns(timeoutMs),
			IotDiscoveryService.scanViaSsdp(timeoutMs),
			IotDiscoveryService.scanViaArp(),
		])

		const allFound: Map<string, DeviceProfile> = new Map()

		const merge = (profiles: DeviceProfile[]) => {
			for (const p of profiles) {
				if (!allFound.has(p.ip)) {
					allFound.set(p.ip, p)
				}
			}
		}

		if (mdnsResults.status === "fulfilled") {
			Logger.debug(`[IotDiscoveryService] mDNS found ${mdnsResults.value.length} devices`)
			merge(mdnsResults.value)
		} else {
			Logger.debug("[IotDiscoveryService] mDNS scan failed", mdnsResults.reason)
		}

		if (ssdpResults.status === "fulfilled") {
			Logger.debug(`[IotDiscoveryService] SSDP found ${ssdpResults.value.length} devices`)
			merge(ssdpResults.value)
		} else {
			Logger.debug("[IotDiscoveryService] SSDP scan failed", ssdpResults.reason)
		}

		if (arpResults.status === "fulfilled") {
			Logger.debug(`[IotDiscoveryService] ARP found ${arpResults.value.length} devices`)
			merge(arpResults.value)
		} else {
			Logger.debug("[IotDiscoveryService] ARP scan failed", arpResults.reason)
		}

		const found = Array.from(allFound.values())
		Logger.debug(`[IotDiscoveryService] Total unique devices found: ${found.length}`)

		for (const profile of found) {
			try {
				await DeviceRegistry.upsert(profile)
			} catch (e) {
				Logger.debug("[IotDiscoveryService] DeviceRegistry.upsert failed", e)
			}
		}

		return found
	}

	private static async scanViaMdns(timeoutMs: number): Promise<DeviceProfile[]> {
		const found: DeviceProfile[] = []

		// biome-ignore lint/suspicious/noExplicitAny: bonjour dynamic import
		const bonjourMod: any = await import("bonjour-service")
		const Bonjour = bonjourMod.default ?? bonjourMod.Bonjour ?? bonjourMod
		const bonjour = new Bonjour()

		await new Promise<void>((resolve) => {
			const browser = bonjour.findAll(
				{},
				// biome-ignore lint/suspicious/noExplicitAny: bonjour service record
				(svc: any) => {
					const ip: string = svc.referer?.address ?? svc.host ?? ""
					if (!ip) return

					const identified = DeviceIdentificationService.identifyFromMdnsType(svc.type as string)
					const id = `mdns-${ip}-${(svc.type as string).replace(/[^a-z0-9]/gi, "-")}`.toLowerCase()

					const profile: DeviceProfile = {
						id,
						name: svc.name as string,
						ip,
						type: identified.type as DeviceType,
						protocol: identified.protocol as DeviceProtocol,
						capabilities: [],
						lastSeen: Date.now(),
						trustedLocal: true,
					}
					found.push(profile)
				},
			)

			setTimeout(() => {
				browser.stop()
				bonjour.destroy()
				resolve()
			}, timeoutMs)
		})

		return found
	}

	private static async scanViaSsdp(timeoutMs: number): Promise<DeviceProfile[]> {
		const found: DeviceProfile[] = []
		const seenIps = new Set<string>()

		return new Promise<DeviceProfile[]>((resolve) => {
			const socket = dgram.createSocket("udp4")

			const cleanup = () => {
				try {
					socket.close()
				} catch {
					// already closed
				}
				resolve(found)
			}

			const timer = setTimeout(cleanup, timeoutMs)

			socket.on("error", () => {
				clearTimeout(timer)
				cleanup()
			})

			socket.on("message", (msg, rinfo) => {
				const ip = rinfo.address
				if (seenIps.has(ip)) return
				seenIps.add(ip)

				const text = msg.toString()
				const serverLine = text.match(/^SERVER:(.+)$/im)?.[1]?.trim() ?? ""
				const stLine = text.match(/^ST:(.+)$/im)?.[1]?.trim() ?? ""
				const usn = text.match(/^USN:(.+)$/im)?.[1]?.trim() ?? ""

				const combined = `${serverLine} ${stLine} ${usn}`.toLowerCase()
				const identified = DeviceIdentificationService.identifyFromMdnsType(combined)

				const name =
					serverLine ||
					usn
						.split("::")[0]
						.replace(/^uuid:/i, "")
						.substring(0, 24) ||
					`ssdp-${ip}`

				const profile: DeviceProfile = {
					id: `ssdp-${ip}`,
					name,
					ip,
					type: identified.type,
					protocol: DeviceProtocol.UPNP,
					capabilities: [],
					lastSeen: Date.now(),
					trustedLocal: true,
				}
				found.push(profile)
			})

			socket.bind(0, () => {
				socket.send(SSDP_DISCOVER_MSG, SSDP_PORT, SSDP_MULTICAST_ADDR, (err) => {
					if (err) {
						clearTimeout(timer)
						cleanup()
					}
				})
			})
		})
	}

	// Exposed as a separate method so tests can stub it via sinon
	protected static execArp(): string {
		return childProcess.execSync("arp -a", { timeout: 5_000, encoding: "utf-8" }) as string
	}

	private static async scanViaArp(): Promise<DeviceProfile[]> {
		const found: DeviceProfile[] = []

		const output = IotDiscoveryService.execArp()

		// Parse lines like: "192.168.1.1  aa-bb-cc-dd-ee-ff  dynamic"
		const lineRegex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+([\w-:]{11,17})/g
		let match: RegExpExecArray | null

		// biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop
		while ((match = lineRegex.exec(output)) !== null) {
			const ip = match[1]
			const mac = match[2].replaceAll("-", ":").toLowerCase()

			// Skip broadcast/multicast MACs
			if (mac === "ff:ff:ff:ff:ff:ff" || mac.startsWith("01:") || mac === "00:00:00:00:00:00") continue

			found.push({
				id: `arp-${ip}`,
				name: `Device ${ip}`,
				ip,
				mac,
				type: DeviceType.UNKNOWN,
				protocol: DeviceProtocol.UNKNOWN,
				capabilities: [],
				lastSeen: Date.now(),
				trustedLocal: true,
			})
		}

		return found
	}
}
