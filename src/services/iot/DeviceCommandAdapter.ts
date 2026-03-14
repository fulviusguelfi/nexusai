import type { DeviceProfile } from "@shared/iot/DeviceProfile"
import { DeviceProtocol, DeviceType } from "@shared/iot/DeviceProfile"

export interface CommandResult {
	success: boolean
	output: string
}

/**
 * Translates natural-language commands to protocol-specific actions for a registered device.
 * Each protocol branch issues the minimal real I/O needed.
 */
export class DeviceCommandAdapter {
	/**
	 * Execute a natural-language command on the given device profile.
	 * @param device  The registered DeviceProfile
	 * @param command Natural-language command string, e.g. "turn on", "set brightness 80%"
	 * @param cwd     Workspace path (used to look up active sessions from registries)
	 */
	static async execute(device: DeviceProfile, command: string, cwd: string): Promise<CommandResult> {
		switch (device.protocol) {
			case DeviceProtocol.MQTT:
				return DeviceCommandAdapter.executeMqtt(device, command, cwd)
			case DeviceProtocol.HTTP_REST:
				return DeviceCommandAdapter.executeHttp(device, command)
			case DeviceProtocol.SSH:
				return DeviceCommandAdapter.executeSsh(device, command, cwd)
			default:
				return { success: false, output: `Unsupported protocol: ${device.protocol as string}` }
		}
	}

	private static async executeMqtt(device: DeviceProfile, command: string, cwd: string): Promise<CommandResult> {
		const { MqttConnectionRegistry } = await import("@services/iot/MqttConnectionRegistry")
		const client = MqttConnectionRegistry.get(cwd)
		if (!client) {
			return { success: false, output: "No active MQTT connection. Use mqtt_connect first." }
		}

		const topic = device.capabilities[0] ?? `devices/${device.id}/command`
		const payload = JSON.stringify({ command, deviceId: device.id, ts: Date.now() })

		await new Promise<void>((resolve, reject) => {
			client.publish(topic, payload, { qos: 1 }, (err?: Error) => {
				if (err) reject(err)
				else resolve()
			})
		})

		return { success: true, output: `Command sent via MQTT to topic "${topic}": ${command}` }
	}

	private static async executeHttp(device: DeviceProfile, command: string): Promise<CommandResult> {
		const baseUrl = device.capabilities.find((c) => c.startsWith("http")) ?? `http://${device.ip}`
		const endpoint = DeviceCommandAdapter.mapCommandToHttpEndpoint(device.type, command)

		const url = `${baseUrl}${endpoint.path}`
		const body = endpoint.body ? JSON.stringify(endpoint.body) : undefined

		const { default: https } = await import("node:https")
		const { default: http } = await import("node:http")
		const parsedUrl = new URL(url)
		const lib = parsedUrl.protocol === "https:" ? https : http

		const responseBody = await new Promise<string>((resolve, reject) => {
			const req = lib.request(
				{
					method: endpoint.method,
					hostname: parsedUrl.hostname,
					port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
					path: parsedUrl.pathname + parsedUrl.search,
					headers: { "content-type": "application/json" },
				},
				(res) => {
					const chunks: Buffer[] = []
					res.on("data", (c: Buffer) => chunks.push(c))
					res.on("end", () => resolve(Buffer.concat(chunks).toString()))
					res.on("error", reject)
				},
			)
			req.on("error", reject)
			if (body) req.write(body)
			req.end()
		})

		return { success: true, output: `HTTP ${endpoint.method} ${url} → ${responseBody}` }
	}

	private static async executeSsh(device: DeviceProfile, command: string, cwd: string): Promise<CommandResult> {
		const { SshSessionRegistry } = await import("@services/ssh/SshSessionRegistry")
		const client = SshSessionRegistry.get(cwd)
		if (!client) {
			return { success: false, output: "No active SSH session. Use ssh_connect first." }
		}

		const shellCmd = DeviceCommandAdapter.mapCommandToShell(device.type, command)

		const output: string = await new Promise((resolve, reject) => {
			// biome-ignore lint/suspicious/noExplicitAny: ssh2 exec
			client.exec(shellCmd, (err: Error | undefined, stream: any) => {
				if (err) return reject(err)
				const parts: string[] = []
				stream.on("data", (d: Buffer) => parts.push(d.toString()))
				stream.stderr.on("data", (d: Buffer) => parts.push(d.toString()))
				stream.on("close", () => resolve(parts.join("")))
			})
		})

		return { success: true, output }
	}

	private static mapCommandToHttpEndpoint(
		type: DeviceType,
		command: string,
	): { method: string; path: string; body?: Record<string, unknown> } {
		const cmd = command.toLowerCase()

		// Philips Hue-style bulb/light
		if (type === DeviceType.SMART_BULB) {
			if (cmd.includes("on")) return { method: "PUT", path: "/api/lights/1/state", body: { on: true } }
			if (cmd.includes("off")) return { method: "PUT", path: "/api/lights/1/state", body: { on: false } }
			const brightnessMatch = /(\d+)%/.exec(cmd)
			if (brightnessMatch) {
				const bri = Math.round((Number.parseInt(brightnessMatch[1], 10) / 100) * 254)
				return { method: "PUT", path: "/api/lights/1/state", body: { bri } }
			}
		}

		// Generic REST fallback
		return { method: "POST", path: "/command", body: { command } }
	}

	private static mapCommandToShell(type: DeviceType, command: string): string {
		const cmd = command.toLowerCase()
		if (cmd.includes("reboot") || cmd.includes("restart")) return "sudo reboot"
		if (cmd.includes("shutdown")) return "sudo shutdown -h now"
		if (cmd.includes("status")) {
			if (type === DeviceType.ROUTER) return "uptime && iwconfig 2>/dev/null | grep ESSID || true"
			return "uptime"
		}
		// Passthrough for explicit shell commands
		return command
	}
}
