import { DeviceProtocol, DeviceType } from "@shared/iot/DeviceProfile"

/**
 * Identifies device type and protocol from mDNS service type strings and vendor strings.
 * Purely heuristic — no network I/O.
 */
export class DeviceIdentificationService {
	static identifyFromMdnsType(serviceType: string): { type: DeviceType; protocol: DeviceProtocol } {
		const t = serviceType.toLowerCase()

		if (t.includes("mqtt") || t.includes("_mqtt")) {
			return { type: DeviceType.MQTT_SENSOR, protocol: DeviceProtocol.MQTT }
		}
		if (t.includes("_ssh") || t.includes("_sftp") || t.includes("workstation") || t.includes("_remote-disc")) {
			return { type: DeviceType.COMPUTER, protocol: DeviceProtocol.SSH }
		}
		if (t.includes("_http") || t.includes("_https") || t.includes("_hap")) {
			return { type: DeviceType.SMART_BULB, protocol: DeviceProtocol.HTTP_REST }
		}
		if (t.includes("speaker") || t.includes("airplay") || t.includes("_raop") || t.includes("cast")) {
			return { type: DeviceType.SMART_SPEAKER, protocol: DeviceProtocol.HTTP_REST }
		}
		if (t.includes("router") || t.includes("gateway") || t.includes("_router")) {
			return { type: DeviceType.ROUTER, protocol: DeviceProtocol.HTTP_REST }
		}

		return { type: DeviceType.UNKNOWN, protocol: DeviceProtocol.UNKNOWN }
	}

	static identifyFromVendor(vendor: string): DeviceType {
		const v = vendor.toLowerCase()
		if (v.includes("apple")) return DeviceType.COMPUTER
		if (v.includes("sonos") || v.includes("bose") || v.includes("harman")) return DeviceType.SMART_SPEAKER
		if (v.includes("philips") || v.includes("lifx") || v.includes("govee") || v.includes("tuya")) return DeviceType.SMART_BULB
		return DeviceType.UNKNOWN
	}
}
