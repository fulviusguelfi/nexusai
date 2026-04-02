/**
 * VaultService — manages local secure vault entries.
 *
 * Metadata (id, label, type) is persisted in GlobalState as `vaultEntries[]`.
 * Actual values are stored in the encrypted `vaultSecrets` SecretKey as a JSON
 * blob `{ [id]: value }`.  Values NEVER reach the webview or the LLM — only the
 * extension host reads them (via `resolveValue`).
 */

import crypto from "node:crypto"
import type { StateManager } from "@core/storage/StateManager"
import type { UserVaultEntry, VaultEntryType } from "@shared/vault"

export class VaultService {
	constructor(private readonly stateManager: StateManager) {}

	// -------------------------------------------------------------------------
	// Helpers
	// -------------------------------------------------------------------------

	private readSecretBlob(): Record<string, string> {
		const raw = this.stateManager.getSecretKey("vaultSecrets")
		if (!raw) return {}
		try {
			return JSON.parse(raw) as Record<string, string>
		} catch {
			return {}
		}
	}

	private writeSecretBlob(blob: Record<string, string>): void {
		this.stateManager.setSecret("vaultSecrets", JSON.stringify(blob))
	}

	// -------------------------------------------------------------------------
	// Public API
	// -------------------------------------------------------------------------

	listEntries(): UserVaultEntry[] {
		return this.stateManager.getGlobalStateKey("vaultEntries") ?? []
	}

	async createEntry(label: string, type: VaultEntryType, value: string): Promise<UserVaultEntry> {
		const id = crypto.randomUUID()
		const entry: UserVaultEntry = { id, label, type, createdAt: Date.now() }

		// Persist metadata
		const entries = this.listEntries()
		this.stateManager.setGlobalState("vaultEntries", [...entries, entry])

		// Persist value
		const blob = this.readSecretBlob()
		blob[id] = value
		this.writeSecretBlob(blob)

		return entry
	}

	async deleteEntry(id: string): Promise<void> {
		const entries = this.listEntries().filter((e) => e.id !== id)
		this.stateManager.setGlobalState("vaultEntries", entries)

		const blob = this.readSecretBlob()
		delete blob[id]
		this.writeSecretBlob(blob)
	}

	/**
	 * Resolve a vault entry value by id.
	 * ONLY called from the extension host — never exposed via trpc/proto/state.
	 */
	resolveValue(id: string): string | undefined {
		return this.readSecretBlob()[id]
	}
}
