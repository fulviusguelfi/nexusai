import type { DeviceProfile, DeviceType } from "@shared/iot/DeviceProfile"
import type { ExtensionContext } from "vscode"

/**
 * Persistent registry of IoT device profiles, stored in VS Code globalState.
 * Mirror of the SshSessionRegistry runtime pattern, but backed by persistent storage.
 */
export class DeviceRegistry {
	private static readonly STORAGE_KEY = "iotDevices"
	private static context: ExtensionContext | undefined
	private static readonly changeListeners = new Set<() => void>()

	static initialize(ctx: ExtensionContext): void {
		DeviceRegistry.context = ctx
	}

	private static load(): DeviceProfile[] {
		if (!DeviceRegistry.context) return []
		return DeviceRegistry.context.globalState.get<DeviceProfile[]>(DeviceRegistry.STORAGE_KEY) ?? []
	}

	private static async save(profiles: DeviceProfile[]): Promise<void> {
		await DeviceRegistry.context?.globalState.update(DeviceRegistry.STORAGE_KEY, profiles)
		DeviceRegistry.notifyChange()
	}

	private static notifyChange(): void {
		for (const fn of DeviceRegistry.changeListeners) {
			fn()
		}
	}

	static onDidChange(listener: () => void): () => void {
		DeviceRegistry.changeListeners.add(listener)
		return () => DeviceRegistry.changeListeners.delete(listener)
	}

	static getAll(): DeviceProfile[] {
		return DeviceRegistry.load()
	}

	static getById(id: string): DeviceProfile | undefined {
		return DeviceRegistry.load().find((d) => d.id === id)
	}

	static getByType(type: DeviceType): DeviceProfile[] {
		return DeviceRegistry.load().filter((d) => d.type === type)
	}

	static getByIp(ip: string): DeviceProfile | undefined {
		return DeviceRegistry.load().find((d) => d.ip === ip)
	}

	static async upsert(profile: DeviceProfile): Promise<void> {
		const profiles = DeviceRegistry.load()
		const idx = profiles.findIndex((d) => d.id === profile.id)
		if (idx >= 0) {
			profiles[idx] = profile
		} else {
			profiles.push(profile)
		}
		await DeviceRegistry.save(profiles)
	}

	static async remove(id: string): Promise<void> {
		const profiles = DeviceRegistry.load().filter((d) => d.id !== id)
		await DeviceRegistry.save(profiles)
	}
}
