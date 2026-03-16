import { DeviceIdentificationService } from "@services/iot/DeviceIdentificationService"
import { DeviceRegistry } from "@services/iot/DeviceRegistry"
import { type DeviceProfile, DeviceProtocol, DeviceType } from "@shared/iot/DeviceProfile"

const DEFAULT_SCAN_TIMEOUT_MS = 8_000

/**
 * Reusable mDNS discovery service.
 * Scans the local network via bonjour/mDNS, builds DeviceProfile objects,
 * and persists results to DeviceRegistry.
 * Safe to call fire-and-forget — errors are swallowed internally.
 */
export class IotDiscoveryService {
	static async scan(timeoutMs = DEFAULT_SCAN_TIMEOUT_MS): Promise<DeviceProfile[]> {
		const found: DeviceProfile[] = []

		try {
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

			// Persist all discovered devices — DeviceRegistry.onDidChange will trigger panel refresh
			for (const profile of found) {
				await DeviceRegistry.upsert(profile)
			}
		} catch {
			// bonjour not available or scan failed — return empty results silently
		}

		return found
	}
}
