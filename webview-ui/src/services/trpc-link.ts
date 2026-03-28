import type { TRPCLink } from "@trpc/client"
import { TRPCClientError } from "@trpc/client"
import type { AnyTRPCRouter } from "@trpc/server"
import { observable } from "@trpc/server/observable"
import { PLATFORM_CONFIG } from "../config/platform.config"

/**
 * tRPC link that transports requests over VSCode postMessage.
 *
 * Webview → extension: window sends `trpc_request` via vscode.postMessage
 * Extension → webview: window receives `trpc_response` via message event
 */
export function createPostMessageLink<TRouter extends AnyTRPCRouter>(): TRPCLink<TRouter> {
	return () =>
		({ op }) =>
			observable((observer) => {
				const id = `trpc-${Date.now()}-${Math.random().toString(36).slice(2)}`

				const handleMessage = (event: MessageEvent<unknown>) => {
					const data = event.data as Record<string, unknown> | null
					if (!data || data.type !== "trpc_response") return
					const res = data.trpc_response as { id: string; result?: unknown; error?: string } | undefined
					if (!res || res.id !== id) return

					window.removeEventListener("message", handleMessage)

					if (res.error !== undefined) {
						observer.error(new TRPCClientError(res.error))
					} else {
						observer.next({ result: { type: "data", data: res.result } })
						observer.complete()
					}
				}

				window.addEventListener("message", handleMessage)

				PLATFORM_CONFIG.postMessage({
					type: "trpc_request",
					trpc_request: { id, type: op.type, path: op.path, input: op.input },
				})

				return () => window.removeEventListener("message", handleMessage)
			})
}
