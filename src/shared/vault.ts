/**
 * Shared types for the local secure vault.
 *
 * UserVaultEntry holds only metadata — the actual value is stored in VS Code
 * SecretStorage under the key `vaultEntry:<id>` and NEVER leaves the extension host.
 */

export type VaultEntryType = "password" | "card" | "document" | "text"

export interface UserVaultEntry {
	id: string
	label: string
	type: VaultEntryType
	createdAt: number
}
