export enum DeviceType {
	COMPUTER = "computer",
	SMART_BULB = "smart_bulb",
	SMART_SPEAKER = "smart_speaker",
	MQTT_SENSOR = "mqtt_sensor",
	ROUTER = "router",
	UNKNOWN = "unknown",
}

export enum DeviceProtocol {
	SSH = "ssh",
	MQTT = "mqtt",
	HTTP_REST = "http_rest",
	UPNP = "upnp",
	UNKNOWN = "unknown",
}

export interface DeviceProfile {
	id: string
	name: string
	ip: string
	mac?: string
	vendor?: string
	type: DeviceType
	protocol: DeviceProtocol
	/** Opaque JSON credentials (masked when returned to the LLM) */
	credentials?: Record<string, string>
	capabilities: string[]
	lastSeen: number // unix ms
	/** When true, this device IP is exempt from the SSRF guard in HttpRequestToolHandler */
	trustedLocal: boolean
	notes?: string
}
