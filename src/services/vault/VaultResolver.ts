/**
 * VaultResolver — intercepts [VAULT:id] tokens in tool parameters before execution.
 *
 * Usage:
 *   const resolved = await VaultResolver.resolveTokens(text, vaultService)
 *
 * The regex matches `[VAULT:<uuid>]` placeholders that the LLM passes through
 * from the user's chat message.  They are replaced with the actual secret value
 * before the tool handler runs.  The values are masked in all log output.
 */

import { Logger } from "@shared/services/Logger"
import type { VaultService } from "./VaultService"

// Matches [VAULT:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx]
const VAULT_TOKEN_RE = /\[VAULT:([a-f0-9-]{36})\]/gi

export class VaultResolver {
	/**
	 * Replace all [VAULT:id] tokens in `text` with their resolved values.
	 * Unknown ids are left as-is and a warning is logged.
	 */
	static resolveTokens(text: string, vault: VaultService): string {
		return text.replace(VAULT_TOKEN_RE, (_match, id: string) => {
			const value = vault.resolveValue(id)
			if (value === undefined) {
				Logger.warn(`[VaultResolver] unknown vault id: ${id}`)
				return _match // leave placeholder intact
			}
			// Value is intentionally not logged
			return value
		})
	}

	/**
	 * Resolve vault tokens in every string parameter of a ToolUse block.
	 * Returns a shallow copy of params with resolved values.
	 */
	static resolveBlockParams(
		params: Record<string, string | undefined>,
		vault: VaultService,
	): Record<string, string | undefined> {
		const resolved: Record<string, string | undefined> = {}
		for (const [key, val] of Object.entries(params)) {
			resolved[key] = typeof val === "string" ? VaultResolver.resolveTokens(val, vault) : val
		}
		return resolved
	}
}
