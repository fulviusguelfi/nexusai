import type { SshServerProfile } from "@shared/ssh/SshServerProfile"
import type { ExtensionContext } from "vscode"

/**
 * Persistent registry of SSH server profiles.
 * Public fields (host, port, user, authType) are stored in VS Code globalState.
 * Credentials (password / key content / key path) are stored in VS Code SecretStorage
 * and are NEVER returned through any LLM-visible tool response.
 */
export class SshServerProfileRegistry {
	private static readonly STORAGE_KEY = "sshServerProfiles"
	private static context: ExtensionContext | undefined
	private static readonly changeListeners = new Set<() => void>()

	static initialize(ctx: ExtensionContext): void {
		SshServerProfileRegistry.context = ctx
	}

	private static load(): SshServerProfile[] {
		if (!SshServerProfileRegistry.context) return []
		return SshServerProfileRegistry.context.globalState.get<SshServerProfile[]>(SshServerProfileRegistry.STORAGE_KEY) ?? []
	}

	private static async save(profiles: SshServerProfile[]): Promise<void> {
		await SshServerProfileRegistry.context?.globalState.update(SshServerProfileRegistry.STORAGE_KEY, profiles)
		SshServerProfileRegistry.notifyChange()
	}

	private static notifyChange(): void {
		for (const fn of SshServerProfileRegistry.changeListeners) {
			fn()
		}
	}

	static onDidChange(listener: () => void): () => void {
		SshServerProfileRegistry.changeListeners.add(listener)
		return () => SshServerProfileRegistry.changeListeners.delete(listener)
	}

	static getAll(): SshServerProfile[] {
		return SshServerProfileRegistry.load()
	}

	/** Case-insensitive match by name or id. */
	static getByName(name: string): SshServerProfile | undefined {
		const q = name.toLowerCase().trim()
		return SshServerProfileRegistry.load().find((p) => p.name.toLowerCase() === q || p.id === q)
	}

	static async upsert(profile: SshServerProfile, credential: string): Promise<void> {
		const profiles = SshServerProfileRegistry.load()
		const idx = profiles.findIndex((p) => p.id === profile.id)
		if (idx >= 0) {
			profiles[idx] = profile
		} else {
			profiles.push(profile)
		}
		await SshServerProfileRegistry.save(profiles)
		if (SshServerProfileRegistry.context && credential) {
			await SshServerProfileRegistry.context.secrets.store(profile.id, credential)
		}
	}

	/** Returns credential from SecretStorage — never exposed to the LLM. */
	static async getCredential(id: string): Promise<string | undefined> {
		if (!SshServerProfileRegistry.context) return undefined
		return SshServerProfileRegistry.context.secrets.get(id)
	}

	static async remove(id: string): Promise<void> {
		const profiles = SshServerProfileRegistry.load().filter((p) => p.id !== id)
		await SshServerProfileRegistry.save(profiles)
		if (SshServerProfileRegistry.context) {
			await SshServerProfileRegistry.context.secrets.delete(id)
		}
	}
}
