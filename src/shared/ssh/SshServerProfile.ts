export type SshAuthType = "password" | "key_path" | "key_content"

export interface SshServerProfile {
	/** Stable identifier — slug derived from the server name (e.g. "larry") */
	id: string
	/** Human-readable display name (e.g. "Larry") */
	name: string
	host: string
	port: number
	user: string
	authType: SshAuthType
	/** Unix ms — updated on every successful connection */
	lastConnectedAt?: number
}
