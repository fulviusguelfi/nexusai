import { generateKeyPairSync } from "node:crypto"

// NOTE (Block B): Requires the `ssh2` package. Run `npm install` after the Phase 3 branch is created.
// All tests using this fixture are test.skip until SSH tool handlers are implemented in
// src/core/task/tools/handlers/. The dynamic import inside `start()` keeps this file
// compilable even before npm install is run.

/** Minimal SSH channel interface — typed to match ssh2's ServerChannel at runtime. */
export interface SshChannel {
	write(data: string | Buffer): boolean
	exit(code: number): void
	end(): void
}

export class MockSshServer {
	// biome-ignore lint/suspicious/noExplicitAny: ssh2 types require npm install first
	private server: any = null
	private acceptedCredentials = new Map<string, string>() // user → password
	private acceptedPublicKeys: Buffer[] = []
	private executeHandlers = new Map<string, (channel: SshChannel) => void>()
	// biome-ignore lint/suspicious/noExplicitAny: runtime ssh2 client refs
	private activeClients: any[] = []

	async start(port = 2222): Promise<void> {
		// Dynamic import keeps this file compilable before `npm install` adds ssh2
		// biome-ignore lint/suspicious/noExplicitAny: ssh2 types require npm install first
		const ssh2Module: any = await import("ssh2")
		const ssh2: any = ssh2Module.default ?? ssh2Module

		const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
		const hostKey = privateKey.export({ type: "pkcs1", format: "pem" })

		// biome-ignore lint/suspicious/noExplicitAny: ssh2 Connection type
		this.server = new ssh2.Server({ hostKeys: [hostKey] }, (client: any) => {
			this.activeClients.push(client)
			client.on("close", () => {
				this.activeClients = this.activeClients.filter((c) => c !== client)
			})

			// biome-ignore lint/suspicious/noExplicitAny: ssh2 AuthContext type
			client.on("authentication", (ctx: any) => {
				if (ctx.method === "password") {
					const expected = this.acceptedCredentials.get(ctx.username)
					if (expected !== undefined && ctx.password === expected) {
						return ctx.accept()
					}
				} else if (ctx.method === "publickey") {
					// Accept if the key was registered via acceptKey()
					if (this.acceptedPublicKeys.length > 0) {
						return ctx.accept()
					}
				}
				ctx.reject()
			})

			client.on("ready", () => {
				// biome-ignore lint/suspicious/noExplicitAny: ssh2 accept callbacks
				client.on("session", (accept: any) => {
					const session = accept()
					// biome-ignore lint/suspicious/noExplicitAny: ssh2 exec info
					session.on("exec", (accept: any, _reject: any, info: any) => {
						const stream = accept() as SshChannel
						const handler = this.executeHandlers.get(info.command)
						if (handler) {
							handler(stream)
						} else {
							// Default: silently succeed for unknown commands (allows upload via exec)
							stream.exit(0)
							stream.end()
						}
					})
				})
			})

			client.on("end", () => client.end())
		})

		await new Promise<void>((resolve, reject) => {
			this.server.listen(port, "127.0.0.1", () => resolve())
			this.server.once("error", reject)
		})
	}

	async stop(): Promise<void> {
		if (!this.server) return
		// Force-close any active SSH client connections so server.close() can resolve
		for (const client of this.activeClients) {
			try {
				client.end()
			} catch {
				// ignore
			}
		}
		this.activeClients = []
		await new Promise<void>((resolve) => {
			const timer = setTimeout(() => {
				this.server = null
				resolve()
			}, 3000)
			this.server.close(() => {
				clearTimeout(timer)
				this.server = null
				resolve()
			})
		})
	}

	/** Register a username/password pair that the server will accept. */
	acceptPassword(user: string, pass: string): void {
		this.acceptedCredentials.set(user, pass)
	}

	/** Register a public key that the server will accept for key-based auth. */
	acceptKey(publicKey: Buffer): void {
		this.acceptedPublicKeys.push(publicKey)
	}

	/** Register a handler for a specific remote command. */
	onExecute(command: string, handler: (channel: SshChannel) => void): void {
		this.executeHandlers.set(command, handler)
	}
}
